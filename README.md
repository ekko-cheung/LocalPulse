# LocalPulse

LocalPulse is a lightweight cross-platform desktop agent for local task scheduling, HTTP automation, command execution, and native notifications.

It combines a React + Vite interface with a Tauri 2 desktop shell. The Axum API, Tokio scheduler, executors, and SQLite database run inside the same Tauri process.

## Features

- Local HTTP API on `127.0.0.1:7788`
- Cron, one-time, interval, and manual triggers
- HTTP requests, local commands, and native notifications
- SQLite persistence and execution history
- Bearer token authentication and command allowlist
- React Router dashboard, task management, history, and settings pages
- macOS menu bar and Windows system tray support
- Hides to the tray when the main window is closed

## Requirements

- Rust stable
- Node.js 18+
- pnpm 10+
- Tauri 2 system dependencies

## Development

```bash
pnpm install
pnpm build
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

The application starts the Agent internally. On first launch, the UI asks for an API token. On later launches, the saved token is used to start the Agent automatically.

To allow local commands, configure the allowlist before launching:

```bash
export LOCALPULSE_ALLOWED_PROGRAMS="python,node,/Users/you/scripts/backup.sh"
```

## API

Health checks do not require authentication:

```bash
curl http://127.0.0.1:7788/api/v1/health
```

All other endpoints require the configured Bearer token. Example:

```bash
curl -X POST http://127.0.0.1:7788/api/v1/jobs \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"name":"daily-report","trigger":{"type":"interval","seconds":3600},"action":{"type":"http","method":"POST","url":"http://127.0.0.1:8080/report","body":{"factory":"VN01"}}}'
```

## Project structure

```text
src/                    React frontend
src-tauri/src/          Tauri shell and embedded Agent backend
src-tauri/icons/        Cross-platform application icons
dist/                   Vite production output
```

## Formatting

```bash
pnpm format
pnpm format:check
```

Husky and lint-staged format staged frontend files automatically before commit.

## Releases

Push a version tag to trigger the GitHub Actions build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds unsigned Windows and macOS bundles and uploads them as GitHub Actions artifacts. Code signing and notarization can be added later with repository secrets.

For Chinese documentation, see [README-zh.md](README-zh.md).

