# TicketTrail Windows 发布说明

## 目标

当前项目已经具备 Windows 桌面端的基础打包能力。这一版发布流程主要覆盖：

- 本地生成可分发安装包
- 通过 GitHub Actions 生成 Windows 构建产物
- 在推送版本标签时自动创建 GitHub Release 并上传安装包

后续再补代码签名、自动更新和更正式的版本治理。

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

或拆成两步执行：

```powershell
npm.cmd run build
npm.cmd run tauri:build:windows
```

## 当前打包脚本

`package.json` 中已经包含：

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
- 推送形如 `v0.1.0`、`v0.2.0` 的版本标签

工作流当前会：

1. 安装 Node.js 依赖
2. 安装 Rust 工具链
3. 构建前端
4. 运行 Tauri Windows 打包
5. 上传 `bundle` 目录作为 artifact
6. 如果当前是 `v*` 标签，则自动创建 GitHub Release 并上传安装包

## 自动发布用法

如果要触发 GitHub Release 自动上传，推荐流程是：

```powershell
npm.cmd run version:sync -- 0.1.1
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "Bump version to 0.1.1"
git tag v0.1.1
git push origin v0.1.1
```

推送标签后，GitHub Actions 会自动构建，并把生成的 Windows 安装包挂到对应的 Release 页面。

## 版本号规范

当前项目已经加入两条版本工具脚本：

- `npm.cmd run version:sync -- 0.1.1`
  同步 `package.json`、`src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml`
- `npm.cmd run version:check`
  校验三处版本号是否一致；如果当前是 `v*` 标签构建，还会检查标签版本是否与项目版本一致

建议每次正式发版都先执行 `version:sync`，再提交、打标签、推送。

## 当前边界

这一版还没有补齐：

- 代码签名
- 自动更新元数据
- 正式版本号递增规范
- 多渠道安装包管理

## 建议下一步

发布链路继续完善时，建议优先顺序是：

1. 补版本号管理规范
2. 再考虑代码签名
3. 最后再接自动更新
