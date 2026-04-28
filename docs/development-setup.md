# TicketTrail 开发启动说明
# TicketTrail Development Setup

## 中文

当前仓库已经具备第一版桌面端骨架：
当前仓库已经具备第一版桌面端骨架，并且 MVP 已经接入真实本地数据链路：

- `src/`：React 前端页面与基础组件
- `src-tauri/`：Tauri 容器与 Rust 命令入口
- `database/schema.sql`：SQLite 初始 schema
- `docs/technical-implementation-plan.md`：详细技术实现方案
- 当前表单保存会通过 Tauri 命令写入本地 SQLite
- 当前票务列表会优先读取本地 SQLite 中的真实数据

本机当前环境已经补齐 `Rust / cargo` 和 Windows Build Tools，并已通过 `npm.cmd run build` 与 `cargo check` 验证。

建议本地安装完成后执行：

```powershell
npm.cmd install
npm.cmd run dev
```

如需桌面端联调，再执行：

```powershell
npm.cmd run tauri:dev
```

## English

The repository now includes the first desktop scaffold:

- `src/`: React frontend pages and base components
- `src-tauri/`: Tauri shell and Rust command entrypoints
- `database/schema.sql`: initial SQLite schema
- `docs/technical-implementation-plan.md`: detailed implementation plan

`Rust / cargo` are not currently available in this machine environment, so this commit focuses on landing the scaffold rather than compiling the Tauri application.

After local setup is complete, run:

```powershell
npm.cmd install
npm.cmd run dev
```

For desktop integration testing, then run:

```powershell
npm.cmd run tauri:dev
```
