# Repository Guidelines

## Project Structure & Module Organization

LocalPulse combines a React/Vite UI with a Tauri 2 Rust desktop shell.

- `src/` contains the frontend: pages, reusable components, API helpers, constants, and styles.
- `src-tauri/src/` contains the Tauri entrypoint and embedded Axum/Tokio agent backend; `src-tauri/icons/` contains platform assets.
- `public/` contains static web assets; `dist/` is generated Vite output and should not be edited manually.
- `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` define desktop packaging and Rust dependencies.
- `.github/workflows/release.yml` builds Windows and macOS bundles from version tags.

## Build, Test, and Development Commands

Use pnpm for JavaScript dependencies (Node.js 18+ and pnpm 10+ are expected):

```bash
pnpm install                         # Install dependencies
pnpm dev                             # Start the Vite UI on 127.0.0.1:1420
pnpm build                           # Create the production frontend in dist/
cargo tauri dev --manifest-path src-tauri/Cargo.toml  # Run the desktop app
pnpm format                          # Format frontend/config files
pnpm format:check                    # Verify Prettier formatting
cargo test --manifest-path src-tauri/Cargo.toml       # Run Rust tests
```

Before testing command execution, set `LOCALPULSE_ALLOWED_PROGRAMS` to a comma-separated allowlist. The local agent listens on `127.0.0.1:7788`.

## Coding Style & Naming Conventions

Prettier is authoritative for JavaScript, JSX, CSS, `index.html`, and `vite.config.js`: two spaces, single quotes, no semicolons, trailing commas, and a 100-column width. Run `pnpm format:check` before submitting. Use PascalCase for React components and page files, camelCase for functions and variables, and clear snake_case only where it matches API or database fields. Follow idiomatic Rust formatting with `cargo fmt`.

## Testing Guidelines

There is currently no frontend test framework configured. Validate UI changes with `pnpm build` and manual desktop/API checks; add focused Rust tests alongside backend logic when changing agent behavior. Run `cargo test --manifest-path src-tauri/Cargo.toml` for Rust changes and keep test names descriptive.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style subjects, matching existing history (for example, `feat: add optional cron scheduling` or `docs: add MIT license`). Keep commits focused. Pull requests should explain the behavior change, list validation commands, link related issues when applicable, and include screenshots or recordings for UI changes. Mention configuration, migration, or platform-specific implications explicitly.

## Security & Configuration

Do not commit API tokens, local database files, signing credentials, or machine-specific allowlists. Treat the bearer token and command allowlist as sensitive configuration. Keep local HTTP/API changes authenticated except for the documented health endpoint, and review command-execution changes carefully.
