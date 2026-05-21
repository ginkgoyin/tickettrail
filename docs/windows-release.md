# TicketTrail Windows 发布说明

## 目标

当前项目已经具备 Windows 桌面端的基础打包能力。
这一版发布流程主要面向：

- 本地生成可分发安装包
- 通过 GitHub Actions 生成 Windows 构建产物
- 后续再补签名、自动更新和正式版本号策略

## 本地打包前提

本机需要先具备：

- `Node.js` 与 `npm`
- `Rust / cargo`
- `Visual Studio Build Tools`
- Tauri Windows 构建依赖

安装依赖后，在项目根目录执行：

```powershell
npm.cmd install
npm.cmd run release:windows
```

或分两步执行：

```powershell
npm.cmd run build
npm.cmd run tauri:build:windows
```

## 当前打包脚本

`package.json` 中已经加入：

- `npm.cmd run tauri:build`
  生成 Tauri 桌面构建
- `npm.cmd run tauri:build:windows`
  生成 Windows `nsis` 安装包
- `npm.cmd run release:windows`
  先构建前端，再执行 Windows 安装包打包

## 产物位置

Windows 打包成功后，常见产物会出现在：

```text
src-tauri\target\release\bundle\
```

重点关注：

- `nsis\`
- 其中的 `.exe` 安装包

## GitHub Actions

仓库已经加入工作流：

```text
.github/workflows/windows-build.yml
```

它会在以下场景触发：

- `workflow_dispatch`
- 推送到 `main`

工作流当前会：

1. 安装 Node.js 依赖
2. 安装 Rust 工具链
3. 构建前端
4. 运行 Tauri Windows 打包
5. 上传 `bundle` 目录作为 artifact

## 当前边界

这一版还没有补：

- 代码签名
- 自动更新元数据
- GitHub Release 自动发布
- 正式版本号递增策略
- 多渠道安装包产物管理

## 建议下一步

发布链路继续完善时，优先顺序建议是：

1. 补 GitHub Release 自动上传
2. 补版本号管理规范
3. 再考虑代码签名和自动更新
