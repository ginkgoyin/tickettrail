# TicketTrail Windows 发布说明

## 中文

当前项目已经具备 Windows 本地打包和 GitHub Release 上传能力。

## 可直接运行的文件

真正可以独立启动的 Windows 程序是：

```text
src-tauri\target\release\tickettrail.exe
```

安装包是：

```text
src-tauri\target\release\bundle\nsis\TicketTrail_0.1.0_x64-setup.exe
```

## 不要误用调试版

下面这个文件不是独立发布版：

```text
src-tauri\target\debug\tickettrail.exe
```

它属于开发调试产物，只能配合：

```powershell
npm.cmd run tauri:dev
```

一起使用。单独双击时，它会尝试访问 `localhost:1420`，因此会出现 `ERR_CONNECTION_REFUSED`。

## 本地打包

在项目根目录执行：

```powershell
npm.cmd install
npm.cmd run release:windows
```

或者分开执行：

```powershell
npm.cmd run build
npm.cmd run tauri:build:windows
```

## 产物位置

常见输出目录：

```text
src-tauri\target\release\
src-tauri\target\release\bundle\nsis\
```

## 自动发布

仓库已经包含：

```text
.github/workflows/windows-build.yml
```

当你推送 `main` 或者推送 `v*` 标签时，GitHub Actions 会执行 Windows 构建。推送版本标签时，还会自动创建 GitHub Release 并上传安装包。

## 版本同步

发版前建议执行：

```powershell
npm.cmd run version:sync -- 0.1.1
npm.cmd run version:check
```

## English

Use the release executable or installer for standalone Windows usage. Do not launch `src-tauri\target\debug\tickettrail.exe` directly unless you are running `npm.cmd run tauri:dev`, because the debug binary depends on the local Vite server at `localhost:1420`.
