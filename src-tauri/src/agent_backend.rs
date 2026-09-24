use crate::hooks::{self, HookEvent};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use cron::Schedule;
use rand::{distributions::Alphanumeric, Rng};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use std::{
    collections::HashMap,
    env,
    net::SocketAddr,
    str::FromStr,
    sync::{Arc, Mutex},
    time::Duration as StdDuration,
};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::{
    process::Command,
    sync::Semaphore,
    task::{JoinHandle, JoinSet},
    time::timeout,
};
use tower_http::cors::CorsLayer;
use tracing::{error, info};
use uuid::Uuid;

pub const ALLOWED_PROGRAMS_ENV: &str = "LOCALPULSE_ALLOWED_PROGRAMS";

#[derive(Clone)]
struct AppState {
    db: SqlitePool,
    token: Arc<String>,
    client: Client,
    slots: Arc<Semaphore>,
    app: AppHandle,
    active_executions: Arc<ActiveExecutions>,
    hook_token: Arc<String>,
    hook_data_dir: Arc<std::path::PathBuf>,
}

#[derive(Default)]
struct ActiveExecutions(Mutex<Vec<JoinHandle<()>>>);

impl ActiveExecutions {
    fn add(&self, task: JoinHandle<()>) -> Result<(), JoinHandle<()>> {
        match self.0.lock() {
            Ok(mut tasks) => {
                tasks.retain(|task| !task.is_finished());
                tasks.push(task);
                Ok(())
            }
            Err(_) => Err(task),
        }
    }

    fn abort_all(&self) {
        if let Ok(mut tasks) = self.0.lock() {
            for task in tasks.drain(..) {
                task.abort();
            }
        }
    }
}

impl Drop for ActiveExecutions {
    fn drop(&mut self) {
        self.abort_all();
    }
}

#[derive(Clone)]
struct ExecutionState {
    db: SqlitePool,
    client: Client,
    slots: Arc<Semaphore>,
    app: AppHandle,
}

impl AppState {
    fn execution_state(&self) -> ExecutionState {
        ExecutionState {
            db: self.db.clone(),
            client: self.client.clone(),
            slots: self.slots.clone(),
            app: self.app.clone(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Trigger {
    Cron { expression: String },
    Once { run_at: DateTime<Utc> },
    Interval { seconds: u64 },
    Manual,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Action {
    Http {
        method: String,
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
        body: Option<Value>,
        #[serde(default = "default_http_timeout")]
        timeout_seconds: u64,
    },
    Command {
        program: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default = "default_command_timeout")]
        timeout_seconds: u64,
    },
    Notification {
        title: String,
        body: String,
        #[serde(default = "default_channels")]
        channels: Vec<String>,
    },
}

fn default_http_timeout() -> u64 {
    30
}
fn default_command_timeout() -> u64 {
    600
}
fn default_channels() -> Vec<String> {
    vec!["native".into()]
}

#[derive(Debug, Serialize, Deserialize)]
struct JobInput {
    name: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
    trigger: Trigger,
    action: Action,
    #[serde(default)]
    retry_config: RetryConfig,
}
fn default_enabled() -> bool {
    true
}
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
struct RetryConfig {
    #[serde(default)]
    max_attempts: u32,
    #[serde(default = "default_backoff")]
    backoff_seconds: u64,
}
fn default_backoff() -> u64 {
    5
}

#[derive(Debug, Serialize, FromRow)]
struct Job {
    id: String,
    name: String,
    enabled: bool,
    trigger: Value,
    action: Value,
    retry_config: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
#[derive(Debug, Serialize, FromRow)]
struct Execution {
    id: String,
    job_id: String,
    status: String,
    started_at: DateTime<Utc>,
    finished_at: Option<DateTime<Utc>>,
    exit_code: Option<i32>,
    stdout: Option<String>,
    stderr: Option<String>,
    result: Option<Value>,
    error: Option<String>,
    attempt: i32,
}

#[derive(Serialize)]
struct Api<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}
fn ok<T: Serialize>(data: T) -> Json<Api<T>> {
    Json(Api {
        success: true,
        data: Some(data),
        error: None,
    })
}
fn fail<T: Serialize>(
    status: StatusCode,
    message: impl Into<String>,
) -> (StatusCode, Json<Api<T>>) {
    (
        status,
        Json(Api {
            success: false,
            data: None,
            error: Some(message.into()),
        }),
    )
}

async fn health() -> Json<Api<Value>> {
    ok(json!({"status":"ok", "service":"localpulse"}))
}

fn authorized(headers: &HeaderMap, token: &str) -> bool {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == format!("Bearer {token}"))
        .unwrap_or(false)
}
async fn auth(headers: &HeaderMap, state: &AppState) -> Result<(), (StatusCode, Json<Api<Value>>)> {
    if authorized(headers, &state.token) {
        Ok(())
    } else {
        Err(fail(
            StatusCode::UNAUTHORIZED,
            "missing or invalid bearer token",
        ))
    }
}

async fn list_jobs(
    State(s): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Api<Vec<Job>>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    let rows = sqlx::query_as::<_, Job>("SELECT id,name,enabled,trigger,action,retry_config,created_at,updated_at FROM jobs ORDER BY created_at DESC").fetch_all(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}
async fn get_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Api<Job>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    let row = sqlx::query_as::<_, Job>("SELECT id,name,enabled,trigger,action,retry_config,created_at,updated_at FROM jobs WHERE id=?").bind(id).fetch_optional(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    row.map(ok)
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "job not found"))
}

async fn create_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<JobInput>,
) -> Result<(StatusCode, Json<Api<Job>>), (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    validate(&input)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    sqlx::query("INSERT INTO jobs (id,name,enabled,trigger,action,retry_config,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(&id).bind(&input.name).bind(input.enabled).bind(sqlx::types::Json(&input.trigger)).bind(sqlx::types::Json(&input.action)).bind(sqlx::types::Json(&input.retry_config)).bind(now).bind(now).execute(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let job = load_job(&s.db, &id)
        .await
        .map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok((StatusCode::CREATED, ok(job)))
}
async fn update_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<JobInput>,
) -> Result<Json<Api<Job>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    validate(&input)?;
    let result = sqlx::query("UPDATE jobs SET name=?,enabled=?,trigger=?,action=?,retry_config=?,updated_at=? WHERE id=?").bind(&input.name).bind(input.enabled).bind(sqlx::types::Json(&input.trigger)).bind(sqlx::types::Json(&input.action)).bind(sqlx::types::Json(&input.retry_config)).bind(Utc::now()).bind(&id).execute(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(fail(StatusCode::NOT_FOUND, "job not found"));
    }
    Ok(ok(load_job(&s.db, &id).await.map_err(|e| {
        fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?))
}
async fn delete_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Api<Value>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    sqlx::query("DELETE FROM jobs WHERE id=?")
        .bind(id)
        .execute(&s.db)
        .await
        .map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(json!({"deleted":true})))
}
async fn set_enabled(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    enabled: bool,
) -> Result<Json<Api<Job>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    let result = sqlx::query("UPDATE jobs SET enabled=?,updated_at=? WHERE id=?")
        .bind(enabled)
        .bind(Utc::now())
        .bind(&id)
        .execute(&s.db)
        .await
        .map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(fail(StatusCode::NOT_FOUND, "job not found"));
    }
    Ok(ok(load_job(&s.db, &id).await.map_err(|_| {
        fail(StatusCode::NOT_FOUND, "job not found")
    })?))
}
async fn enable_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    path: Path<String>,
) -> Result<Json<Api<Job>>, (StatusCode, Json<Api<Value>>)> {
    set_enabled(State(s), headers, path, true).await
}
async fn disable_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    path: Path<String>,
) -> Result<Json<Api<Job>>, (StatusCode, Json<Api<Value>>)> {
    set_enabled(State(s), headers, path, false).await
}
async fn run_job(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Api<Value>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    let job = load_job(&s.db, &id)
        .await
        .map_err(|_| fail(StatusCode::NOT_FOUND, "job not found"))?;
    let exec_id = Uuid::new_v4().to_string();
    let s2 = s.execution_state();
    let task = tokio::spawn(async move {
        if let Err(e) = execute(s2, job, exec_id.clone()).await {
            error!(%exec_id, %e, "job execution failed")
        }
    });
    if let Err(task) = s.active_executions.add(task) {
        task.abort();
        return Err(fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            "execution manager unavailable",
        ));
    }
    Ok(ok(json!({"queued":true,"job_id":id})))
}
async fn executions(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Api<Vec<Execution>>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    let rows = sqlx::query_as::<_, Execution>("SELECT id,job_id,status,started_at,finished_at,exit_code,stdout,stderr,result,error,attempt FROM executions WHERE job_id=? ORDER BY started_at DESC LIMIT 100").bind(id).fetch_all(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}
async fn get_execution(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Api<Execution>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    sqlx::query_as::<_, Execution>("SELECT id,job_id,status,started_at,finished_at,exit_code,stdout,stderr,result,error,attempt FROM executions WHERE id=?").bind(id).fetch_optional(&s.db).await.map_err(|e| fail(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.map(ok).ok_or_else(|| fail(StatusCode::NOT_FOUND, "execution not found"))
}

#[derive(Debug, Deserialize)]
struct Notify {
    title: String,
    body: String,
    #[serde(default = "default_channels")]
    channels: Vec<String>,
}
async fn notify(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(n): Json<Notify>,
) -> Result<Json<Api<Value>>, (StatusCode, Json<Api<Value>>)> {
    auth(&headers, &s).await?;
    send_notification(&s.app, &n.title, &n.body, &n.channels)
        .await
        .map_err(|e| fail(StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(ok(json!({"sent":true})))
}

async fn hook_event(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(event): Json<HookEvent>,
) -> Result<Json<Api<Value>>, (StatusCode, Json<Api<Value>>)> {
    if !authorized(&headers, &s.hook_token) {
        return Err(fail(StatusCode::UNAUTHORIZED, "invalid hook token"));
    }
    if !["claude", "codex"].contains(&event.agent.as_str())
        || !["permission", "stop", "tool"].contains(&event.event.as_str())
        || event.cwd.len() > 4096
    {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid hook event"));
    }
    if let Some(project) = hooks::notification_project(&s.hook_data_dir, &event) {
        let agent = if event.agent == "claude" {
            "Claude Code"
        } else {
            "Codex"
        };
        let action = match event.event.as_str() {
            "permission" => "请求权限",
            "stop" => "回复完成",
            _ => "工具操作完成",
        };
        let title = format!("{agent} · {action}");
        let body = format!("项目：{project}");
        send_notification(&s.app, &title, &body, &["native".into()])
            .await
            .map_err(|e| fail(StatusCode::BAD_GATEWAY, e.to_string()))?;
    }
    Ok(ok(json!({"received":true})))
}

fn validate(input: &JobInput) -> Result<(), (StatusCode, Json<Api<Value>>)> {
    if input.name.trim().is_empty() {
        return Err(fail(StatusCode::BAD_REQUEST, "name is required"));
    }
    if let Action::Command { program, .. } = &input.action {
        let allowed = env::var(ALLOWED_PROGRAMS_ENV).unwrap_or_default();
        if !allowed
            .split(',')
            .map(str::trim)
            .filter(|x| !x.is_empty())
            .any(|x| x == program)
        {
            return Err(fail(
                StatusCode::FORBIDDEN,
                format!("program is not in {ALLOWED_PROGRAMS_ENV}"),
            ));
        }
    }
    if let Trigger::Cron { expression } = &input.trigger {
        validate_cron_expression(expression).map_err(|e| {
            fail(
                StatusCode::BAD_REQUEST,
                format!("invalid cron expression: {e}"),
            )
        })?;
    }
    Ok(())
}

pub fn validate_cron_expression(expression: &str) -> Result<(), String> {
    Schedule::from_str(expression.trim())
        .map(|_| ())
        .map_err(|error| error.to_string())
}
async fn load_job(db: &SqlitePool, id: &str) -> anyhow::Result<Job> {
    Ok(sqlx::query_as("SELECT id,name,enabled,trigger,action,retry_config,created_at,updated_at FROM jobs WHERE id=?").bind(id).fetch_one(db).await?)
}

async fn execute(s: ExecutionState, job: Job, exec_id: String) -> anyhow::Result<()> {
    let _permit = s.slots.acquire().await?;
    let started = Utc::now();
    sqlx::query("INSERT INTO executions (id,job_id,status,started_at,attempt) VALUES (?,?,?, ?,1)")
        .bind(&exec_id)
        .bind(&job.id)
        .bind("running")
        .bind(started)
        .execute(&s.db)
        .await?;
    let action: Action = serde_json::from_value(job.action)?;
    let result: anyhow::Result<(i32, String, String, Value)> = match action {
        Action::Http {
            method,
            url,
            headers,
            body,
            timeout_seconds,
        } => {
            let mut req = s.client.request(method.parse()?, url);
            for (k, v) in headers {
                req = req.header(k, v);
            }
            if let Some(body) = body {
                req = req.json(&body);
            }
            let response = timeout(StdDuration::from_secs(timeout_seconds), req.send()).await??;
            let status = response.status().as_u16();
            let text = response.text().await.unwrap_or_default();
            Ok((
                status as i32,
                String::new(),
                text,
                json!({"http_status": status}),
            ))
        }
        Action::Command {
            program,
            args,
            timeout_seconds,
        } => {
            let output = timeout(
                StdDuration::from_secs(timeout_seconds),
                Command::new(program).args(args).output(),
            )
            .await??;
            let code = output.status.code().unwrap_or(-1);
            Ok((
                code,
                String::from_utf8_lossy(&output.stdout).to_string(),
                String::from_utf8_lossy(&output.stderr).to_string(),
                json!({"success": output.status.success()}),
            ))
        }
        Action::Notification {
            title,
            body,
            channels,
        } => {
            send_notification(&s.app, &title, &body, &channels).await?;
            Ok((
                0,
                String::new(),
                String::new(),
                json!({"channels": channels}),
            ))
        }
    };
    let finished = Utc::now();
    match result {
        Ok((code, out, err, res)) if code < 400 => {
            sqlx::query("UPDATE executions SET status='success',finished_at=?,exit_code=?,stdout=?,stderr=?,result=? WHERE id=?").bind(finished).bind(code).bind(out).bind(err).bind(res).bind(exec_id).execute(&s.db).await?;
        }
        Ok((code, out, err, res)) => {
            sqlx::query("UPDATE executions SET status='failed',finished_at=?,exit_code=?,stdout=?,stderr=?,result=?,error=? WHERE id=?").bind(finished).bind(code).bind(out).bind(err).bind(res).bind("action returned an error").bind(exec_id).execute(&s.db).await?;
        }
        Err(e) => {
            sqlx::query("UPDATE executions SET status='failed',finished_at=?,error=? WHERE id=?")
                .bind(finished)
                .bind(e.to_string())
                .bind(exec_id)
                .execute(&s.db)
                .await?;
        }
    }
    Ok(())
}

async fn send_notification(
    app: &AppHandle,
    title: &str,
    body: &str,
    channels: &[String],
) -> anyhow::Result<()> {
    if !channels.iter().any(|c| c == "native") {
        return Ok(());
    }

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| anyhow::anyhow!("native notification failed: {error}"))?;

    Ok(())
}

async fn scheduler(s: AppState) {
    // The scheduler polls once per second. Keep the last fired Unix second per
    // job so a matching trigger cannot enqueue the same job twice.
    let mut last_fired: HashMap<String, i64> = HashMap::new();
    let mut executions = JoinSet::new();
    let mut ticker = tokio::time::interval(StdDuration::from_secs(1));
    loop {
        ticker.tick().await;
        while executions.try_join_next().is_some() {}

        if let Ok(jobs) = sqlx::query_as::<_, Job>("SELECT id,name,enabled,trigger,action,retry_config,created_at,updated_at FROM jobs WHERE enabled=1").fetch_all(&s.db).await {
            let now = Utc::now();
            let now_second = now.timestamp();
            for job in jobs {
                let trigger: Result<Trigger,_> = serde_json::from_value(job.trigger.clone());
                if due_at(&trigger.unwrap_or(Trigger::Manual), now) && last_fired.get(&job.id) != Some(&now_second) {
                    last_fired.insert(job.id.clone(), now_second);
                    let id = Uuid::new_v4().to_string();
                    let s2=s.execution_state();
                    executions.spawn(async move {
                        if let Err(e)=execute(s2,job,id).await { error!(%e,"scheduled execution failed") }
                    });
                }
            }
        }
    }
}
fn due_at(trigger: &Trigger, now: chrono::DateTime<Utc>) -> bool {
    match trigger {
        Trigger::Manual => false,
        Trigger::Interval { seconds } => now.timestamp() % (*seconds as i64).max(1) == 0,
        Trigger::Once { run_at } => (now - *run_at).num_seconds() == 0,
        Trigger::Cron { expression } => Schedule::from_str(expression.trim())
            .ok()
            .and_then(|x| x.after(&(now - Duration::seconds(1))).next())
            // Cron occurrences have second precision. Comparing timestamps
            // avoids firing once before and once after the same occurrence.
            .map(|n| n.timestamp() == now.timestamp())
            .unwrap_or(false),
    }
}

pub async fn run(
    token: Option<String>,
    shutdown: Option<tokio::sync::oneshot::Receiver<()>>,
    app: AppHandle,
    hook_data_dir: std::path::PathBuf,
) -> anyhow::Result<()> {
    let hook_token = hooks::ensure_token(&hook_data_dir).map_err(anyhow::Error::msg)?;
    let path = env::var("LOCALPULSE_DATABASE").unwrap_or_else(|_| "localpulse.db".into());
    let database_url = if path.starts_with("sqlite:") {
        path
    } else {
        format!("sqlite://{path}?mode=rwc")
    };
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled BOOLEAN NOT NULL,trigger JSON NOT NULL,action JSON NOT NULL,retry_config JSON NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").execute(&db).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY,job_id TEXT NOT NULL,status TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,exit_code INTEGER,stdout TEXT,stderr TEXT,result JSON,error TEXT,attempt INTEGER NOT NULL DEFAULT 1)").execute(&db).await?;
    let token = token.unwrap_or_else(|| {
        let t: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(40)
            .map(char::from)
            .collect();
        println!("LOCALPULSE_API_TOKEN={t}");
        t
    });
    let state = AppState {
        db,
        token: Arc::new(token),
        client: Client::new(),
        slots: Arc::new(Semaphore::new(4)),
        app,
        active_executions: Arc::new(ActiveExecutions::default()),
        hook_token: Arc::new(hook_token),
        hook_data_dir: Arc::new(hook_data_dir),
    };
    let app = Router::new()
        .route("/api/v1/health", get(health))
        .route("/health", get(health))
        .route("/api/v1/notify", post(notify))
        .route("/api/v1/hook-events", post(hook_event))
        .route("/api/v1/jobs", get(list_jobs).post(create_job))
        .route(
            "/api/v1/jobs/:id",
            get(get_job).put(update_job).delete(delete_job),
        )
        .route("/api/v1/jobs/:id/run", post(run_job))
        .route("/api/v1/jobs/:id/enable", post(enable_job))
        .route("/api/v1/jobs/:id/disable", post(disable_job))
        .route("/api/v1/jobs/:id/executions", get(executions))
        .route("/api/v1/executions/:id", get(get_execution))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());
    let host = env::var("LOCALPULSE_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port = env::var("LOCALPULSE_PORT").unwrap_or_else(|_| "7788".into());
    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    info!(%addr, "LocalPulse listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    // Bind before starting the scheduler. If another Agent already owns the
    // port, this instance must not leave a scheduler running in the background.
    let scheduler = scheduler(state.clone());
    tokio::pin!(scheduler);
    if let Some(mut shutdown) = shutdown {
        tokio::select! {
            result = axum::serve(listener, app) => { result?; },
            _ = &mut shutdown => {},
            _ = &mut scheduler => {},
        }
    } else {
        tokio::select! {
            result = axum::serve(listener, app) => { result?; },
            _ = &mut scheduler => {},
        }
    }
    state.active_executions.abort_all();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{due_at, validate_cron_expression, Trigger};
    use chrono::{TimeZone, Utc};

    #[test]
    fn accepts_a_valid_cron_expression() {
        assert!(validate_cron_expression(" 0 0/5 * * * * * ").is_ok());
    }

    #[test]
    fn rejects_an_invalid_cron_expression() {
        assert!(validate_cron_expression("not a cron expression").is_err());
    }

    #[test]
    fn cron_fires_only_during_the_matching_second() {
        let trigger = Trigger::Cron {
            expression: "0/10 * * * * ?".into(),
        };
        let before = Utc.with_ymd_and_hms(2026, 9, 17, 14, 0, 9).unwrap();
        let matching = Utc.with_ymd_and_hms(2026, 9, 17, 14, 0, 10).unwrap();
        let after = Utc.with_ymd_and_hms(2026, 9, 17, 14, 0, 11).unwrap();

        assert!(!due_at(&trigger, before));
        assert!(due_at(&trigger, matching));
        assert!(!due_at(&trigger, after));
    }
}
