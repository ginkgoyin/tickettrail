# TicketTrail Development Setup

## 中文

当前项目已经具备完整的本地开发能力，推荐区分“开发调试”和“日常使用”两种启动方式。

### 开发调试

在项目根目录执行：

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

这会同时启动：

- Vite 开发服务器
- Tauri 桌面容器
- Rust 本地命令层

如果你更习惯双击，也可以直接运行：

```text
scripts\run-tickettrail-dev.bat
```

### 日常使用

如果你只是想打开程序，不需要开发环境，应该使用下面任一入口：

```text
src-tauri\target\release\tickettrail.exe
src-tauri\target\release\bundle\nsis\TicketTrail_0.1.0_x64-setup.exe
```

### 重要说明

不要直接双击下面这个文件：

```text
src-tauri\target\debug\tickettrail.exe
```

原因是：

- 它是开发调试版可执行文件
- 它依赖 `http://localhost:1420`
- 没有先运行 `npm.cmd run tauri:dev` 时，就会看到 `ERR_CONNECTION_REFUSED`

也就是说，这个文件不是“可独立使用的成品程序”。

## English

Use `npm.cmd run tauri:dev` for development. The debug binary at `src-tauri\target\debug\tickettrail.exe` is not a standalone app and depends on the local Vite server. For normal use, open the release executable or installer instead.
