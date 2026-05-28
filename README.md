# TicketTrail

## 中文

`TicketTrail` 是一个以票务信息归档、行程可视化和票根导出为核心的桌面项目，当前重点是 Windows 桌面端。

项目当前已经具备这些能力：

- 票据录入、编辑、删除、归档
- 单段与多段行程管理
- 地图路线展示与集合地图
- 票根 SVG / PNG 导出
- 附件保存、备份、恢复
- OCR / 文本智能导入
- 统计、筛选、时间线和常用视图

## 启动方式

### 1. 日常使用

优先使用下面两个入口之一：

- 安装包：
  `src-tauri\target\release\bundle\nsis\TicketTrail_0.1.0_x64-setup.exe`
- 独立运行版：
  `src-tauri\target\release\tickettrail.exe`

### 2. 开发调试

开发版需要本地启动 Vite 服务和 Tauri 容器，请在项目根目录运行：

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

也可以直接双击：

- `scripts\run-tickettrail-dev.bat`

### 3. 不要直接双击这个文件

不要直接双击：

```text
src-tauri\target\debug\tickettrail.exe
```

这是开发调试产物，它会尝试连接 `http://localhost:1420`。如果没有先运行 `npm.cmd run tauri:dev`，就会出现你看到的 `ERR_CONNECTION_REFUSED`。

### 4. 一键打开发布版

如果你已经打过 Windows 发布包，也可以直接双击：

- `scripts\run-tickettrail-release.bat`

它会优先打开：

```text
src-tauri\target\release\tickettrail.exe
```

如果发布版不存在，脚本会提示你先执行构建。

## 目录说明

- `src/`：React 前端
- `src-tauri/`：Tauri 与 Rust
- `database/schema.sql`：SQLite 结构
- `docs/development-setup.md`：开发环境与启动说明
- `docs/windows-release.md`：Windows 打包与发布说明

## English

`TicketTrail` is a Windows-first desktop app for ticket archiving, itinerary visualization, map rendering, ticket-stub export, OCR-assisted import, and structured travel records.

For normal use, launch the release build or installer:

- `src-tauri\target\release\tickettrail.exe`
- `src-tauri\target\release\bundle\nsis\TicketTrail_0.1.0_x64-setup.exe`

Do not double-click `src-tauri\target\debug\tickettrail.exe` by itself. That debug binary expects the local Vite dev server from `npm.cmd run tauri:dev`, so it will fail with `ERR_CONNECTION_REFUSED` when launched standalone.
