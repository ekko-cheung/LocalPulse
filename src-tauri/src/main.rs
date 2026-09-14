#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};
use std::{fs, sync::{Arc, Mutex}};
use tokio::{runtime::Runtime, sync::oneshot, task::JoinHandle};

mod agent;

struct AgentProcess { runtime: Runtime, task: Mutex<Option<(JoinHandle<anyhow::Result<()>>, oneshot::Sender<()>)>>, last_error: Arc<Mutex<Option<String>>> }

#[tauri::command]
fn start_agent(app: tauri::AppHandle, state: tauri::State<'_, AgentProcess>, token: String) -> Result<String, String> {
    if token.trim().is_empty() { return Err("请先配置 API Token".into()); }
    let mut process = state.task.lock().map_err(|_| "无法获取 Agent 状态".to_string())?;
    if process.as_ref().is_some_and(|(task, _)| !task.is_finished()) { return Ok("running".into()); }
    let data_dir = app.path().app_data_dir().map_err(|e| format!("无法获取应用数据目录：{e}"))?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("无法创建应用数据目录：{e}"))?;
    let database = data_dir.join("localpulse.db");
    std::env::set_var("LOCALPULSE_DATABASE", database.to_string_lossy().to_string());
    let log_path = data_dir.join("agent.log");
    std::env::set_var("LOCALPULSE_LOG_FILE", log_path.to_string_lossy().to_string());
    let (sender, receiver) = oneshot::channel();
    if let Ok(mut error) = state.last_error.lock() { *error = None; }
    let last_error = Arc::clone(&state.last_error);
    let task = state.runtime.spawn(async move { let result = agent::run(Some(token), Some(receiver), app).await; if let Err(error) = &result { if let Ok(mut last) = last_error.lock() { *last = Some(error.to_string()); } } result });
    *process = Some((task, sender));
    Ok("started".into())
}

#[tauri::command]
fn stop_agent(state: tauri::State<'_, AgentProcess>) -> Result<String, String> {
    let mut process = state.task.lock().map_err(|_| "无法获取 Agent 状态".to_string())?;
    if let Some((task, sender)) = process.take() { let _ = sender.send(()); task.abort(); }
    Ok("stopped".into())
}

#[tauri::command]
fn agent_status(state: tauri::State<'_, AgentProcess>) -> Result<String, String> {
    let mut process = state.task.lock().map_err(|_| "无法获取 Agent 状态".to_string())?;
    if let Some((task, _)) = process.as_ref() {
        if !task.is_finished() { return Ok("running".into()); }
        *process = None;
    }
    if let Ok(error) = state.last_error.lock() { if let Some(error) = error.as_ref() { return Err(error.clone()); } }
    Ok("stopped".into())
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "localpulse=info".into()))
        .init();
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AgentProcess { runtime: Runtime::new().expect("failed to create Tokio runtime"), task: Mutex::new(None), last_error: Arc::new(Mutex::new(None)) })
        .invoke_handler(tauri::generate_handler![start_agent, stop_agent, agent_status])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "打开应用", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("application icon is missing"))
                .menu(&menu)
                .tooltip("LocalPulse 任务调度 Agent")
                .show_menu_on_left_click(true)
                .icon_as_template(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        #[cfg(target_os = "macos")]
                        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                let _ = window.app_handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building LocalPulse desktop")
        .run(|app, event| {
            match event {
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { .. } => {
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                tauri::RunEvent::Exit => {
                    if let Some(state) = app.try_state::<AgentProcess>() {
                        if let Ok(mut process) = state.task.lock() {
                            if let Some((task, sender)) = process.take() { let _ = sender.send(()); task.abort(); }
                        }
                    }
                }
                _ => {}
            }
        });
}
