# LocalPulse

LocalPulse 是一个轻量级跨平台桌面 Agent，用于本机任务调度、HTTP 自动化、执行本地程序和发送系统通知。

项目使用 React + Vite 构建界面，使用 Tauri 2 作为桌面容器。Axum API、Tokio 调度器、执行器和 SQLite 数据库都运行在同一个 Tauri 进程中。

## 功能

- 本地 HTTP API：`127.0.0.1:7788`
- Cron、指定时间、固定间隔和手动触发
- HTTP 请求、本地程序和系统通知
- SQLite 持久化与执行历史
- Bearer Token 鉴权和本地程序白名单
- React Router 管理界面
- macOS 菜单栏和 Windows 系统托盘
- 关闭窗口后继续在后台运行

## 环境要求

- Rust stable
- Node.js 18+
- pnpm 10+
- Tauri 2 所需的系统依赖

## 开发运行

```bash
pnpm install
pnpm build
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

应用会在 Tauri 进程内部启动 Agent。首次启动时，GUI 会要求输入 API Token；之后启动时会自动使用已保存的 Token。

如需执行本地程序，请先配置程序白名单：

```bash
export LOCALPULSE_ALLOWED_PROGRAMS="python,node,/Users/you/scripts/backup.sh"
```

## API

健康检查不需要 Token：

```bash
curl http://127.0.0.1:7788/api/v1/health
```

其他接口都需要 Bearer Token。

## 项目结构

```text
src/                    React 前端
src-tauri/src/          Tauri 外壳和内嵌 Agent 后端
src-tauri/icons/        跨平台应用图标
dist/                   Vite 构建产物
```

## 格式化

```bash
pnpm format
pnpm format:check
```

Husky 和 lint-staged 会在提交前自动格式化暂存的前端文件。

## 发布构建

推送版本标签即可触发 GitHub Actions 构建：

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow 会构建 Windows 和 macOS 未签名安装包，并上传为 GitHub Actions Artifacts。后续可以通过 GitHub Secrets 增加代码签名和 notarization。

英文文档请查看 [README.md](README.md)。

