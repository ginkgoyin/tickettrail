# BL-003 Blank Screen After Adding Record - Analysis

## 1. Issue Summary

- 应用最初可以打开。
- 测试者尝试新增一条记录。
- 完成新增流程后，整个应用页面变成空白，界面内容不可见。
- 由于空白页，后续手工验证基本被阻断。

## 2. Current Reproduction Status

- 本轮我**没有亲手在桌面 UI 中完成一次交互式复现**。
- 我做的是静态代码路径排查，而不是带 DevTools 的现场复现。
- 因此，这里不能声明“已经复现”；当前状态应视为：**已有测试者复现记录，本轮代码分析支持该问题高度可疑，但仍需要下一轮实际抓取首个运行时错误**。

## 3. Relevant Code Paths

### Add/save handler

- `src/App.tsx`
  - `handleSubmitTicket`
  - 新增时调用 `createTicket(draft)`，然后立即：
    - `setTickets((current) => [nextTicket, ...current])`
    - `setSelectedId(nextTicket.id)`
    - `setDetailVersion((current) => current + 1)`

### State update after create

- `src/App.tsx`
  - `visibleTickets` 由 `tickets` 和筛选条件即时重新计算
  - `selectedTicket` 会立即切到新建记录

### Data reload after create

- `src/App.tsx`
  - `useEffect([selectedId, detailVersion])`
  - 调用 `getTicketDetail(selectedId)`，把新建记录的 detail 拉回来

### Detail selection after create

- `src/App.tsx`
  - `selectedTicket = visibleTickets.find(...) ?? visibleTickets[0] ?? null`
  - 新建后通常会立即把详情区切到这张新票

### Dashboard / statistics refresh after create

- `src/components/Dashboard.tsx`
  - `activeDetail`
  - `scopeDetails` 的加载 effect
  - `buildScopeMapPayload`
  - `itinerarySummary`
  - `scopeSummary`
- `src/components/StatisticsPanel.tsx`
  - 本轮未深入展开，但它也会在新增后立刻收到新的 `visibleTickets`

### Map / visualization render after create

- `src/components/Dashboard.tsx`
  - `buildMapSvgFromSegments(activeDetail.map, activeDetail.segments)`
  - `buildStubSvg(activeDetail.stub, stubTheme, activeDetail.segments)`
- `src/components/RouteMap.tsx`
  - 使用 `route.origin.longitude` / `route.origin.latitude`
  - 使用 `route.viewport`
- `src/lib/visualization.ts`
  - `projectPoint`
  - `buildMapSvgFromSegments`
  - `buildStubSvg`

### Frontend service layer

- `src/lib/ticketService.ts`
  - `createTicket`
  - `getTicketDetail`
  - Tauri 环境下分别走：
    - `invoke<TicketRecord>("create_ticket", { draft })`
    - `invoke<TicketDetailPayload>("get_ticket_detail", { ticketId })`

### TypeScript models

- `src/types/ticket.ts`
  - `TicketRecord`
  - `TicketDetailPayload`
  - `MapRoutePayload`
  - `MapSegmentPayload`
  - `StubPreviewPayload`

### Tauri command / database path

- `src-tauri/src/commands.rs`
  - `create_ticket`
  - `get_ticket_detail`
- `src-tauri/src/db.rs`
  - `create_ticket`
  - `build_ticket_record`
  - `get_ticket_detail`
  - `ticket_row_to_record`
  - `build_ticket_detail`
  - `resolve_map_point`

## 4. Most Likely Failure Points

基于当前代码，**最可能**的失败点不是“保存动作本身”，而是“保存成功后立刻触发的渲染链路”。

### 候选 1：新增后的 detail / map / stub 数据里有字段缺失，而 Dashboard 没有防御式渲染

支持理由：

- `Dashboard` 中有大量直接调用：
  - `value.replace(...)`
  - `value.toFixed(...)`
  - `array.reduce(...)`
  - `array.map(...)`
  - `dangerouslySetInnerHTML`
- 一旦某个 detail 字段不是预期字符串/数字，React render 可能直接抛异常，整页空白。

### 候选 2：新增后 `scopeDetails` 会立刻批量拉取 detail，并构建集合地图；如果新记录地图数据不完整，集合地图也可能把整页带崩

支持理由：

- `Dashboard` 不仅渲染当前选中票，还会立即对 `ticketsInView.slice(0, 24)` 逐条执行 `getTicketDetail`
- 然后 `buildScopeMapPayload` 会对所有点位做：
  - `Math.min(...allPoints.map(point => point.latitude))`
  - `Math.max(...allPoints.map(point => point.longitude))`
- `RouteMap` 也会马上消费这些坐标和 viewport

### 候选 3：Rust 返回的 create/detail 数据形状虽然总体对得上，但某些字段语义不稳定，导致前端把“可空/待补”的值当成“必有值”

支持理由：

- `create_ticket` 返回的是 `build_ticket_record(...)` 直接构造的结果
- `get_ticket_detail` 返回的是从数据库再读、再重建的 detail
- 新增后前端同时会用到：
  - `create_ticket` 的返回值更新 `tickets`
  - `get_ticket_detail` 的返回值更新 `selectedDetail`
- 这两条路径如果某些字段处理不完全一致，新增后的第一轮渲染就可能出现 shape 差异

### 候选 4：地图坐标或 viewport 值对新建记录来说存在非预期值，导致 `RouteMap` 或 SVG 投影逻辑报错

支持理由：

- `RouteMap` 直接使用：
  - `center: [route.origin.longitude, route.origin.latitude]`
  - `fitBounds(route.viewport...)`
  - `setLngLat([point.longitude, point.latitude])`
- `visualization.ts` 直接做经纬度投影计算
- 如果某个值是 `undefined`、`NaN` 或结构缺失，地图相关渲染是高风险区

## 5. Evidence From Code

### 证据 A：新增后会立刻把整页切到新记录，并刷新 detail

- 文件：`src/App.tsx`
- 位置/函数：`handleSubmitTicket`
- 风险说明：
  - 创建成功后不是只更新列表，而是立刻：
    - 把新记录插入 `tickets`
    - 选中新记录
    - 强制 detail 重新加载
  - 这意味着只要“新记录相关 detail 渲染”有一个地方出错，用户会立刻看到整页异常
- 代码期望的数据形状：
  - `createTicket` 返回合法 `TicketRecord`
  - 随后 `getTicketDetail` 返回合法 `TicketDetailPayload`
- 可能缺失的数据：
  - `selectedDetail.map.viewport`
  - `selectedDetail.stub.*`
  - `selectedDetail.attachments`
  - 某些 string/number 字段为空或不是预期类型

### 证据 B：Dashboard 有很多没有兜底的字符串和数字操作

- 文件：`src/components/Dashboard.tsx`
- 位置/函数：
  - `formatDateTime`
  - `itinerarySummary`
  - `buildScopeMapPayload`
  - 渲染区中的 `.toFixed()`、`.replace()`、`.map()`、`.reduce()`
- 风险说明：
  - 例如：
    - `formatDateTime(value)` 直接 `value.replace("T", " ")`
    - `activeDetail.map.viewport.minLatitude.toFixed(2)`
    - `attachment.createdAt.replace("T", " ").slice(0, 16)`
    - `ticket.departureTimeLocal.replace("T", " ")`
  - 如果新增后的 payload 里某个字段不是字符串或数字，Dashboard 会直接抛异常
- 代码期望的数据形状：
  - 所有时间字段是可用字符串
  - 所有地图坐标和 viewport 都是有效数字
  - `segments`、`attachments` 都是数组
- 可能缺失的数据：
  - `map.viewport.*`
  - `map.origin.latitude` / `longitude`
  - `attachment.createdAt`
  - `stub.notes`

### 证据 C：集合地图会在新增后立即加载当前可见票据的 detail，而不是只处理当前票

- 文件：`src/components/Dashboard.tsx`
- 位置/函数：`useEffect(() => loadScopeDetails(), [ticketsInView])`
- 风险说明：
  - 新增后不仅当前票 detail 要加载，当前筛选范围前 24 条票的 detail 都要重新参与 scope map 计算
  - 这放大了新增一条记录后出错的概率
  - 即使单票 detail 勉强可渲染，scope map 链路仍可能因新数据打崩
- 代码期望的数据形状：
  - `getTicketDetail` 对所有票都返回完整的 `segments` 和 `map` 坐标
- 可能缺失的数据：
  - 某条新票 `segments[].origin/destination.latitude/longitude`

### 证据 D：RouteMap 对地图数值字段几乎没有容错

- 文件：`src/components/RouteMap.tsx`
- 位置/函数：
  - 初始化 `new maplibregl.Map`
  - `syncRoute`
- 风险说明：
  - 直接使用：
    - `route.origin.longitude`
    - `route.origin.latitude`
    - `segment.origin.longitude`
    - `route.viewport.minLongitude`
  - 如果新建记录 detail 中这些值有问题，地图组件可能在 mount/update 时抛错
- 代码期望的数据形状：
  - `route.origin/destination` 含有效经纬度
  - `route.viewport` 完整
  - 每个 segment 的起终点都含有效坐标
- 可能缺失的数据：
  - 坐标、viewport、segment 坐标

### 证据 E：SVG / 票根构造函数默认很多字段一定是字符串

- 文件：`src/lib/visualization.ts`
- 位置/函数：
  - `escapeXml`
  - `getCarrierBrand`
  - `buildMapSvgFromSegments`
  - `buildStubSvg`
- 风险说明：
  - `escapeXml(value: string)` 直接 `.replace(...)`
  - `carrierName.toLowerCase()`
  - `stub.transportBadge.toLowerCase()`
  - `stub.departureTimeLocal.replace("T", " ")`
  - 如果 detail/stub 中任一字符串字段是 `undefined`，这里会在生成 SVG 时直接抛错
- 代码期望的数据形状：
  - `stub` 的所有主要字段始终有值
  - `route` / `segment` 中的 label、坐标和 direction 都完整
- 可能缺失的数据：
  - `stub.transportBadge`
  - `stub.carrierName`
  - `stub.departureTimeLocal`
  - `route.lineLabel`

### 证据 F：前端保存后依赖 Tauri 返回的数据与 TypeScript 模型完全匹配，没有中间归一化层

- 文件：`src/lib/ticketService.ts`
- 位置/函数：
  - `createTicket`
  - `getTicketDetail`
- 风险说明：
  - Tauri 路径下，前端直接信任：
    - `invoke<TicketRecord>("create_ticket", { draft })`
    - `invoke<TicketDetailPayload>("get_ticket_detail", { ticketId })`
  - 中间没有前端归一化/校验层
  - 只要 Rust 返回 shape 与 UI 某个隐含假设不一致，新增后的第一帧就可能炸
- 代码期望的数据形状：
  - Tauri 端严格满足 `TicketRecord` 和 `TicketDetailPayload`
- 可能缺失的数据：
  - 任何未被 UI 视为可空的字段

### 证据 G：Rust 端 create / detail 虽然总体一致，但新增后走的是“create 返回 + detail 再取”的双路径

- 文件：`src-tauri/src/db.rs`
- 位置/函数：
  - `create_ticket`
  - `build_ticket_record`
  - `get_ticket_detail`
  - `ticket_row_to_record`
  - `build_ticket_detail`
- 风险说明：
  - `create_ticket` 返回 `build_ticket_record(...)`
  - 后续 `get_ticket_detail` 又从数据库重新组装 detail
  - 这两条路径使用的数据来源不同：
    - 一条是当前 draft 直接构造
    - 一条是 DB row + `raw_payload_json` 再重建
  - 如果二者对空字符串、`segments`、location code、notes、时间等处理略有差异，新增后的即时渲染很容易暴露问题
- 代码期望的数据形状：
  - `TicketRecordPayload` 与 `TicketDetailPayload.ticket` 的语义一致
  - `build_ticket_detail` 构出来的 `map/stub/segments` 全量可用
- 可能缺失的数据：
  - 目前静态代码里没看到明确“必然缺失”的字段，但 shape 一致性仍需实际抓包/日志验证

## 6. Recommended Debugging Steps

下一轮建议按下面顺序做安全调试，不要一开始就改结构：

1. 运行 `npm run tauri:dev`
2. 打开桌面应用并实际重走“新增一条记录”的流程
3. 第一时间抓取：
   - 前端控制台首个 React/runtime error
   - 启动终端里的 Tauri/Rust 日志
4. 重点观察报错是否来自：
   - `Dashboard.tsx`
   - `RouteMap.tsx`
   - `visualization.ts`
   - `get_ticket_detail`
5. 检查新增后返回的数据：
   - `create_ticket` 返回的 `TicketRecord`
   - `get_ticket_detail` 返回的 `TicketDetailPayload`
6. 对比新建前后：
   - `list_tickets()` 的该记录
   - `get_ticket_detail()` 的该记录
7. 如需加日志，作为**单独批准的修复/调试任务**处理，不要在本轮分析里直接动代码

## 7. Minimal Fix Strategy

这里给的是最小修复策略，不在本轮实现。

1. **先阻止整页空白**
   - 在最容易炸的详情/地图/票根渲染链路上增加防御式判断
   - 目标是即便 detail 有问题，也只让局部卡片失败，不要全页白屏

2. **对新增后返回的新票数据做最小归一化**
   - 检查 `create_ticket` 和 `get_ticket_detail` 的关键字段是否稳定
   - 必要时在前端 service 层做最小 shape guard

3. **优先保护 Dashboard 和地图相关渲染**
   - `replace` / `toFixed` / `toLowerCase` / `dangerouslySetInnerHTML` 的输入要先做类型保护

4. **补回归测试（能补哪里补哪里）**
   - 如果适合前端 helper/service 层，就加回归测试
   - 如果是纯桌面运行态问题，则至少更新 `docs/TEST_PLAN.md` 和手工回归清单

5. **修复后手工验证**
   - 新建一张机票
   - 新建一张火车票
   - 验证新增后页面不空白、详情可见、列表可继续操作

## 8. Files Likely To Change In A Future Fix

以下文件是后续最可能需要改动的候选，但本轮**没有修改**：

- `src/App.tsx`
- `src/components/Dashboard.tsx`
- `src/components/RouteMap.tsx`
- `src/lib/visualization.ts`
- `src/lib/ticketService.ts`
- `src/types/ticket.ts`
- `src-tauri/src/db.rs`

## 9. Risks

### 风险 1：只修“白屏表象”，没修数据形状不一致

- 如果只是 try/catch 或简单判空，而没有搞清楚 create/detail 返回 shape 是否稳定，问题可能转成“页面不白了，但内容不对”

### 风险 2：借修 bug 之名，提前做大重构

- 当前阶段不适合顺手把 `App.tsx` 或 `db.rs` 大拆
- BL-003 应该先做最小修复和行为验证

### 风险 3：修复时破坏现有 fallback 测试

- `ticketService` 有 web fallback 测试
- 如果修复时改变前端模型语义，需要同步检查已有 `Vitest` 用例

### 风险 4：Rust / TypeScript 模型改动不同步

- 这个项目强依赖 Tauri 返回 shape
- Rust payload 和 TS 接口一旦不一致，会放大为运行时错误而不是编译错误
