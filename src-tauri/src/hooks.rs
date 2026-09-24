use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::Manager;
use uuid::Uuid;

const MARKER: &str = "--localpulse-hook";
const EVENTS: [(&str, &str); 3] = [
    ("permission", "PermissionRequest"),
    ("stop", "Stop"),
    ("tool", "PostToolUse"),
];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookRule {
    pub id: String,
    pub agent: String,
    pub scope: String,
    pub project: Option<String>,
    pub permission: bool,
    pub stop: bool,
    pub tool: bool,
}

#[derive(Default, Serialize, Deserialize)]
struct HookStore {
    rules: Vec<HookRule>,
}

#[derive(Serialize)]
pub struct HookOverview {
    rules: Vec<HookRule>,
    claude_installed: bool,
    codex_installed: bool,
}

#[derive(Deserialize)]
pub struct HookEvent {
    pub agent: String,
    pub event: String,
    pub cwd: String,
}

pub fn ensure_token(data_dir: &Path) -> Result<String, String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let path = data_dir.join("hook-token");
    if path.exists() {
        return read_token(&path);
    }
    let token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(&path) {
        Ok(mut file) => file
            .write_all(token.as_bytes())
            .map_err(|e| e.to_string())?,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            return read_token(&path)
        }
        Err(error) => return Err(error.to_string()),
    }
    Ok(token)
}

fn read_token(path: &Path) -> Result<String, String> {
    let token = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if token.len() != 48 || !token.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err("hook 凭据文件无效".into());
    }
    Ok(token)
}

fn store_path(data_dir: &Path) -> PathBuf {
    data_dir.join("hook-rules.json")
}

fn load(data_dir: &Path) -> Result<HookStore, String> {
    let path = store_path(data_dir);
    if !path.exists() {
        return Ok(HookStore::default());
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("无法读取 hooks 规则：{e}"))
}

fn save(data_dir: &Path, store: &HookStore) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    write_json(
        &store_path(data_dir),
        &serde_json::to_vec_pretty(store).map_err(|e| e.to_string())?,
    )
}

fn config_path(home: &Path, agent: &str) -> Result<PathBuf, String> {
    match agent {
        "claude" => Ok(home.join(".claude/settings.json")),
        "codex" => Ok(home.join(".codex/hooks.json")),
        _ => Err("不支持的 AI Agent".into()),
    }
}

fn read_config(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    let value: Value = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Agent 配置不是有效 JSON：{e}"))?;
    if !value.is_object() {
        return Err("Agent 配置必须是 JSON 对象".into());
    }
    Ok(value)
}

fn is_managed(value: &Value) -> bool {
    value.get("type").and_then(Value::as_str) == Some("command")
        && (value
            .get("command")
            .and_then(Value::as_str)
            .is_some_and(|command| command.contains(MARKER))
            || value
                .get("args")
                .and_then(Value::as_array)
                .is_some_and(|args| args.iter().any(|arg| arg.as_str() == Some(MARKER))))
}

fn strip_managed(config: &mut Value) {
    if let Some(hooks) = config.get_mut("hooks").and_then(Value::as_object_mut) {
        for groups in hooks.values_mut() {
            if let Some(groups) = groups.as_array_mut() {
                for group in groups.iter_mut() {
                    if let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                        handlers.retain(|handler| !is_managed(handler));
                    }
                }
                groups.retain(|group| {
                    group
                        .get("hooks")
                        .and_then(Value::as_array)
                        .is_none_or(|handlers| !handlers.is_empty())
                });
            }
        }
        hooks.retain(|_, groups| groups.as_array().is_none_or(|items| !items.is_empty()));
    }
}

fn quote(path: &Path) -> String {
    let text = path.to_string_lossy();
    #[cfg(windows)]
    {
        format!("\"{}\"", text)
    }
    #[cfg(not(windows))]
    {
        format!("'{}'", text.replace('\'', "'\\''"))
    }
}

fn command(exe: &Path, token_path: &Path, agent: &str, event: &str) -> String {
    format!(
        "{} {MARKER} {agent} {event} {}",
        quote(exe),
        quote(token_path)
    )
}

fn write_config(path: &Path, value: &Value) -> Result<(), String> {
    let parent = path.parent().ok_or("无效的 Agent 配置路径")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    write_json(
        path,
        &serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?,
    )
}

fn write_json(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = path.with_extension(format!("localpulse-{}.tmp", Uuid::new_v4()));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let result = (|| -> std::io::Result<()> {
        let mut file = options.open(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.map_err(|e| e.to_string())
}

fn sync_agent(home: &Path, data_dir: &Path, store: &HookStore, agent: &str) -> Result<(), String> {
    let path = config_path(home, agent)?;
    let mut config = read_config(&path)?;
    strip_managed(&mut config);
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let token_path = data_dir.join("hook-token");
    let hooks = config
        .as_object_mut()
        .ok_or("Agent 配置必须是 JSON 对象")?
        .entry("hooks")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Agent hooks 配置必须是 JSON 对象")?;
    for (event, name) in EVENTS {
        if !store.rules.iter().any(|rule| {
            rule.agent == agent
                && match event {
                    "permission" => rule.permission,
                    "stop" => rule.stop,
                    _ => rule.tool,
                }
        }) {
            continue;
        }
        let groups = hooks
            .entry(name)
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or(format!("Agent 的 {name} hooks 必须是数组"))?;
        let handler = if agent == "claude" {
            json!({
                "type": "command",
                "command": exe.to_string_lossy(),
                "args": [MARKER, agent, event, token_path.to_string_lossy()],
                "timeout": 3
            })
        } else {
            let handler = json!({
                "type": "command",
                "command": command(&exe, &token_path, agent, event),
                "timeout": 3
            });
            #[cfg(windows)]
            let handler = {
                let mut handler = handler;
                let ps_quote = |path: &Path| path.to_string_lossy().replace('\'', "''");
                handler["commandWindows"] = json!(format!(
                    "powershell.exe -NoProfile -NonInteractive -Command \"& '{}' {MARKER} {agent} {event} '{}'\"",
                    ps_quote(&exe), ps_quote(&token_path)
                ));
                handler
            };
            handler
        };
        groups.push(json!({"hooks": [handler]}));
    }
    if path.exists() || store.rules.iter().any(|rule| rule.agent == agent) {
        write_config(&path, &config)?;
    }
    Ok(())
}

fn installed(home: &Path, agent: &str) -> Result<bool, String> {
    let value = read_config(&config_path(home, agent)?)?;
    Ok(value
        .get("hooks")
        .and_then(Value::as_object)
        .is_some_and(|hooks| {
            hooks.values().any(|groups| {
                groups.as_array().is_some_and(|groups| {
                    groups.iter().any(|group| {
                        group
                            .get("hooks")
                            .and_then(Value::as_array)
                            .is_some_and(|handlers| handlers.iter().any(is_managed))
                    })
                })
            })
        }))
}

#[tauri::command]
pub fn list_hook_integrations(app: tauri::AppHandle) -> Result<HookOverview, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(HookOverview {
        rules: load(&data_dir)?.rules,
        claude_installed: installed(&home, "claude")?,
        codex_installed: installed(&home, "codex")?,
    })
}

#[tauri::command]
pub fn add_hook_rule(
    app: tauri::AppHandle,
    agent: String,
    scope: String,
    project: Option<String>,
    permission: bool,
    stop: bool,
    tool: bool,
) -> Result<HookOverview, String> {
    config_path(&app.path().home_dir().map_err(|e| e.to_string())?, &agent)?;
    if !permission && !stop && !tool {
        return Err("请至少选择一种提醒事件".into());
    }
    let project = match scope.as_str() {
        "global" => None,
        "project" => {
            let path = project.ok_or("请选择项目目录")?;
            let path = fs::canonicalize(path).map_err(|e| format!("项目目录不可用：{e}"))?;
            if !path.is_dir() {
                return Err("项目路径必须是目录".into());
            }
            Some(path.to_string_lossy().to_string())
        }
        _ => return Err("无效的安装范围".into()),
    };
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    ensure_token(&data_dir)?;
    let mut store = load(&data_dir)?;
    if let Some(rule) = store
        .rules
        .iter_mut()
        .find(|rule| rule.agent == agent && rule.scope == scope && rule.project == project)
    {
        rule.permission = permission;
        rule.stop = stop;
        rule.tool = tool;
    } else {
        store.rules.push(HookRule {
            id: Uuid::new_v4().to_string(),
            agent: agent.clone(),
            scope,
            project,
            permission,
            stop,
            tool,
        });
    }
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    sync_agent(&home, &data_dir, &store, &agent)?;
    save(&data_dir, &store)?;
    list_hook_integrations(app)
}

#[tauri::command]
pub fn remove_hook_rule(app: tauri::AppHandle, id: String) -> Result<HookOverview, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut store = load(&data_dir)?;
    let rule = store
        .rules
        .iter()
        .find(|rule| rule.id == id)
        .ok_or("规则不存在")?;
    let agent = rule.agent.clone();
    store.rules.retain(|rule| rule.id != id);
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    sync_agent(&home, &data_dir, &store, &agent)?;
    save(&data_dir, &store)?;
    list_hook_integrations(app)
}

pub fn notification_project(data_dir: &Path, event: &HookEvent) -> Option<String> {
    let Ok(store) = load(data_dir) else {
        return None;
    };
    let cwd = fs::canonicalize(&event.cwd).unwrap_or_else(|_| PathBuf::from(&event.cwd));
    store
        .rules
        .iter()
        .filter(|rule| {
            rule.agent == event.agent
                && (rule.scope == "global"
                    || rule
                        .project
                        .as_ref()
                        .is_some_and(|project| cwd.starts_with(project)))
                && match event.event.as_str() {
                    "permission" => rule.permission,
                    "stop" => rule.stop,
                    "tool" => rule.tool,
                    _ => false,
                }
        })
        .max_by_key(|rule| rule.scope == "project")
        .map(|rule| {
            let path = rule.project.as_deref().map(Path::new).unwrap_or(&cwd);
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("项目")
                .chars()
                .take(80)
                .collect()
        })
}

pub fn run_hook_cli(args: &[String]) {
    if args.len() != 5 || !["claude", "codex"].contains(&args[2].as_str()) {
        println!("{{}}");
        return;
    }
    let mut input = String::new();
    let _ = std::io::stdin().take(1_048_576).read_to_string(&mut input);
    let value: Value = serde_json::from_str(&input).unwrap_or(Value::Null);
    let cwd = value.get("cwd").and_then(Value::as_str).unwrap_or("");
    if cwd.is_empty() {
        println!("{{}}");
        return;
    }
    let payload = json!({"agent": args[2], "event": args[3], "cwd": cwd});
    if let Ok(token) = read_token(Path::new(&args[4])) {
        let port = std::env::var("LOCALPULSE_PORT").unwrap_or_else(|_| "7788".into());
        if let Ok(addr) = format!("127.0.0.1:{port}").parse::<SocketAddr>() {
            if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(400)) {
                let _ = stream.set_write_timeout(Some(Duration::from_millis(400)));
                let body = payload.to_string();
                let request = format!(
                    "POST /api/v1/hook-events HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    token.trim(), body.len(), body
                );
                let _ = stream.write_all(request.as_bytes());
            }
        }
    }
    println!("{{}}");
}
