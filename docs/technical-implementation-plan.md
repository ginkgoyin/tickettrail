# TicketTrail 技术实现方案
# TicketTrail Technical Implementation Plan

## 1. 目标与落地范围
## 1. Goals and Delivery Scope

### 中文

本方案基于既有需求分析结果，面向 `TicketTrail` 第一阶段落地实施。目标是在 Windows 平台优先交付一个可用的桌面端产品，支持机票与火车票信息录入、结构化存储、地图行程展示、票根图生成、查询筛选与导出，并为未来扩展到 macOS、Android 以及 OCR 导入、云同步能力预留稳定的技术基础。

### English

This plan is based on the existing requirements analysis and targets the first production-ready phase of `TicketTrail`. The goal is to deliver a usable desktop application on Windows first, supporting flight and train ticket entry, structured storage, map itinerary visualization, ticket-stub generation, search/filtering, and export, while preserving a stable foundation for future macOS, Android, OCR import, and cloud sync expansion.

## 2. 总体技术路线
## 2. Overall Technical Direction

### 中文

建议采用 `TypeScript` 作为主开发语言，桌面端采用 `Tauri 2 + React`，后端业务层采用 `Rust`。该组合兼顾 Windows 首发的性能、安装包体积、跨平台能力和后续 macOS 支持。Android 版本建议在第二阶段评估复用 React 前端层，核心业务规则继续以共享的数据契约和领域模型为中心复用，而不是直接复制桌面实现。

第一阶段推荐架构为“本地优先、前后端边界清晰”的单机应用：

- 前端：`React + TypeScript`
- 桌面容器：`Tauri 2`
- 核心服务层：`Rust`
- 本地数据库：`SQLite`
- ORM / 数据访问：`sqlx`
- 地图展示：前端 `MapLibre GL JS`
- 地理数据解析：Rust 服务层封装 geocoding provider 和本地缓存
- 票根绘制：优先采用服务层生成标准渲染 JSON，前端使用 `SVG + Canvas` 导出 PNG
- 数据校验：前后端双层校验，前端轻校验，后端强校验

### English

The recommended stack is `TypeScript` as the primary language, `Tauri 2 + React` for the desktop shell, and `Rust` for the backend service layer. This combination balances Windows-first performance, small bundle size, cross-platform capability, and smooth macOS expansion later. For Android, phase two should evaluate reusing the React presentation layer, while continuing to reuse the shared domain model and data contracts rather than copying the desktop implementation directly.

The recommended phase-one architecture is a local-first single-device application with a clean frontend/backend boundary:

- Frontend: `React + TypeScript`
- Desktop container: `Tauri 2`
- Core service layer: `Rust`
- Local database: `SQLite`
- ORM / data access: `sqlx`
- Map rendering: frontend `MapLibre GL JS`
- Geo-resolution: Rust service layer wrapping geocoding providers and local cache
- Ticket-stub rendering: service layer produces standard render JSON, frontend uses `SVG + Canvas` to export PNG
- Validation: dual-layer validation, lightweight on frontend and authoritative on backend

## 3. 分层架构设计
## 3. Layered Architecture

### 中文

建议采用工业级分层设计，避免界面逻辑、领域规则和基础设施代码耦合。

1. `presentation` 层  
负责表单、列表、详情、地图、票根预览、导出交互，不直接操作数据库。

2. `application` 层  
负责用例编排，例如“创建票务记录”“生成票根”“查询行程”“导出图片”，处理事务、权限边界、幂等控制和错误映射。

3. `domain` 层  
负责核心实体、值对象、规则校验、状态流转，是长期最稳定的一层。

4. `infrastructure` 层  
负责 SQLite、文件系统、地图 provider、地理编码缓存、日志、配置读写。

### English

An industrial layered architecture is recommended to keep UI logic, domain rules, and infrastructure code decoupled.

1. `presentation` layer  
Handles forms, lists, detail views, maps, ticket-stub previews, and export interactions without directly manipulating the database.

2. `application` layer  
Orchestrates use cases such as “create ticket record,” “generate ticket stub,” “query itinerary,” and “export image,” handling transactions, idempotency, boundaries, and error mapping.

3. `domain` layer  
Contains core entities, value objects, validation rules, and state transitions. This should remain the most stable layer over time.

4. `infrastructure` layer  
Implements SQLite, filesystem storage, map providers, geocoding cache, logging, and configuration persistence.

## 4. 模块划分
## 4. Module Breakdown

### 中文

第一阶段建议拆分为以下核心模块：

- `ticket-entry`
  负责机票、火车票表单录入，支持草稿保存、字段联动、格式校验。
- `ticket-domain`
  负责统一票务模型、分段行程模型、位置模型、承运方模型。
- `journey-service`
  负责根据输入生成 `Journey` 和 `Segment`，处理多段票、排序、归组。
- `geo-service`
  负责机场、车站、城市的解析与坐标获取，提供本地缓存、模糊匹配和降级策略。
- `map-service`
  负责生成地图绘制所需的线路、箭头方向、标注点、视口范围。
- `stub-render-service`
  负责将业务数据转换为票根渲染载荷。
- `asset-service`
  负责 PNG、缩略图、导出文件、缓存清理和文件索引。
- `search-service`
  负责组合筛选、全文搜索、排序和分页。
- `export-service`
  负责导出 PNG、JSON、CSV，后续扩展 PDF。
- `audit-service`
  负责记录创建时间、更新时间、来源、版本号与操作追踪。

### English

Phase one should be split into the following core modules:

- `ticket-entry`
  Handles flight/train forms, draft saving, field dependency behavior, and format validation.
- `ticket-domain`
  Defines the unified ticket model, journey/segment model, location model, and carrier model.
- `journey-service`
  Builds `Journey` and `Segment` from user input, handling multi-leg tickets, ordering, and grouping.
- `geo-service`
  Resolves airports, stations, and cities into coordinates with local caching, fuzzy matching, and fallback logic.
- `map-service`
  Produces route lines, arrow directions, markers, and viewport bounds for map rendering.
- `stub-render-service`
  Converts business data into a ticket-stub render payload.
- `asset-service`
  Manages PNGs, thumbnails, exported files, cache cleanup, and file indexing.
- `search-service`
  Provides combined filtering, text search, sorting, and pagination.
- `export-service`
  Handles PNG, JSON, and CSV export, with PDF planned later.
- `audit-service`
  Records creation/update time, source, version, and operation trace data.

## 5. 领域模型与数据结构
## 5. Domain Model and Data Structures

### 中文

建议采用“原始票据 + 标准化行程 + 派生产物”三层模型，避免未来演进时互相污染。

核心实体如下：

- `TicketRecord`
  保存用户输入原始信息和来源元数据，是最接近录入界面的对象。
- `Journey`
  表示一次完整出行，可包含一个或多个 `Segment`。
- `Segment`
  表示单段交通，例如上海飞悉尼、上海虹桥到南京南。
- `Location`
  表示机场、车站、城市或国家，并带有坐标与解析置信度。
- `Carrier`
  表示航空公司或铁路运营方。
- `RenderedArtifact`
  表示票根图、地图缩略图、导出卡片等派生产物。

推荐关键字段如下：

```text
TicketRecord
- id: UUID
- ticket_type: enum(flight, train)
- source_type: enum(manual, ocr, import, api)
- external_ref: string?
- raw_payload: json
- normalized_status: enum(pending, normalized, failed)
- journey_id: UUID?
- created_at: datetime_utc
- updated_at: datetime_utc
- version: integer

Journey
- id: UUID
- title: string
- journey_type: enum(single_leg, multi_leg)
- start_time_utc: datetime_utc
- end_time_utc: datetime_utc
- primary_ticket_type: enum(flight, train, mixed)
- status: enum(planned, completed, archived)
- created_at: datetime_utc
- updated_at: datetime_utc

Segment
- id: UUID
- journey_id: UUID
- segment_index: integer
- transport_type: enum(flight, train)
- carrier_id: UUID?
- code: string
- departure_location_id: UUID?
- arrival_location_id: UUID?
- departure_name_raw: string
- arrival_name_raw: string
- departure_time_local: datetime
- arrival_time_local: datetime
- departure_timezone: string
- arrival_timezone: string
- departure_time_utc: datetime_utc
- arrival_time_utc: datetime_utc
- seat_info: string?
- class_info: string?
- metadata: json

Location
- id: UUID
- location_type: enum(airport, station, city, country, unknown)
- code: string?
- name_zh: string?
- name_en: string?
- latitude: decimal
- longitude: decimal
- timezone: string?
- country_code: string?
- confidence_score: decimal
- source: enum(user, cache, provider)

RenderedArtifact
- id: UUID
- owner_type: enum(ticket, journey, segment)
- owner_id: UUID
- artifact_type: enum(ticket_stub_png, map_thumbnail_png, export_json, export_csv)
- render_version: string
- file_path: string
- checksum: string
- created_at: datetime_utc
```

### English

The recommended model uses a three-layer structure: raw ticket data, normalized itinerary data, and derived artifacts. This prevents future evolution in one area from polluting the others.

Core entities:

- `TicketRecord`
  Stores raw user input and source metadata and remains the closest object to the entry form.
- `Journey`
  Represents one complete trip and may contain one or more `Segment` records.
- `Segment`
  Represents a single transport leg, such as Shanghai to Sydney by flight or Shanghai Hongqiao to Nanjing South by train.
- `Location`
  Represents an airport, station, city, or country together with coordinates and resolution confidence.
- `Carrier`
  Represents the airline or rail operator.
- `RenderedArtifact`
  Represents derived outputs such as ticket-stub images, map thumbnails, and exported cards.

The recommended key fields are shown in the schema above.

## 6. 数据库设计草案
## 6. Database Design Draft

### 中文

建议 SQLite 表结构采用“核心表 + 关联表 + 缓存表 + 审计表”模式。

核心表：

- `ticket_records`
- `journeys`
- `segments`
- `locations`
- `carriers`
- `rendered_artifacts`

辅助表：

- `ticket_attachments`
- `journey_tags`
- `segment_duplicates`
- `saved_filters`
- `app_settings`

缓存表：

- `geo_resolution_cache`
- `map_tile_cache_index`

审计表：

- `audit_logs`
- `migration_history`

关键索引建议：

- `segments(departure_time_utc)`
- `segments(arrival_time_utc)`
- `segments(departure_location_id, arrival_location_id)`
- `ticket_records(ticket_type, created_at)`
- `journeys(status, start_time_utc)`
- `locations(code, location_type)`
- `rendered_artifacts(owner_type, owner_id, artifact_type)`

### English

The SQLite schema should follow a “core tables + relation tables + cache tables + audit tables” pattern.

Core tables:

- `ticket_records`
- `journeys`
- `segments`
- `locations`
- `carriers`
- `rendered_artifacts`

Supporting tables:

- `ticket_attachments`
- `journey_tags`
- `segment_duplicates`
- `saved_filters`
- `app_settings`

Cache tables:

- `geo_resolution_cache`
- `map_tile_cache_index`

Audit tables:

- `audit_logs`
- `migration_history`

Recommended indexes:

- `segments(departure_time_utc)`
- `segments(arrival_time_utc)`
- `segments(departure_location_id, arrival_location_id)`
- `ticket_records(ticket_type, created_at)`
- `journeys(status, start_time_utc)`
- `locations(code, location_type)`
- `rendered_artifacts(owner_type, owner_id, artifact_type)`

## 7. 核心业务流程
## 7. Core Business Flows

### 中文

`创建票务记录` 主流程：

1. 前端提交结构化表单。
2. 应用层进行幂等键检查和基础校验。
3. 领域层执行强校验与标准化转换。
4. 地理服务解析出发地与目的地。
5. 生成 `Journey`、`Segment` 和地图渲染数据。
6. 生成票根渲染载荷。
7. 写入 SQLite。
8. 异步生成票根 PNG 与地图缩略图。
9. 返回详情数据与任务状态。

`编辑票务记录` 主流程：

1. 读取当前版本号。
2. 提交变更并校验并发版本。
3. 对受影响的 `Journey` / `Segment` / `RenderedArtifact` 执行重算。
4. 更新数据库并记录审计日志。

`导出票根` 主流程：

1. 读取最新票根渲染数据。
2. 若缓存失效则重新渲染。
3. 输出到用户指定目录或默认导出目录。
4. 返回文件路径、文件大小、导出时间。

### English

`Create ticket record` flow:

1. The frontend submits a structured form.
2. The application layer performs idempotency and basic validation.
3. The domain layer performs strong validation and normalization.
4. The geo service resolves the origin and destination.
5. The system generates `Journey`, `Segment`, and map payload data.
6. The system builds the ticket-stub render payload.
7. The data is persisted into SQLite.
8. Ticket-stub PNG and map thumbnail are generated asynchronously.
9. The API returns detail data and task status.

`Edit ticket record` flow:

1. Read the current version.
2. Submit changes and verify optimistic concurrency.
3. Recompute affected `Journey`, `Segment`, and `RenderedArtifact` data.
4. Update the database and append an audit log.

`Export ticket stub` flow:

1. Read the latest ticket-stub render data.
2. Re-render if the cache is stale.
3. Write to the user-selected folder or default export directory.
4. Return file path, file size, and export timestamp.

## 8. 核心算法思路
## 8. Core Algorithm Ideas

### 中文

1. `时间归一化算法`  
所有排序、去重、统计统一使用 `UTC` 时间轴；界面展示仍保留原始本地时区字段。输入时必须保存 `local time + timezone + utc time` 三元组，避免跨时区航班排序错误。

2. `地理解析算法`  
采用“精确码匹配 > 本地缓存别名匹配 > provider 模糊查询 > 用户确认降级保存”的四级策略。机场优先用 IATA，车站优先用名称加城市组合进行识别。

3. `重复票务识别算法`  
构造去重指纹：
`ticket_type + carrier + code + departure_time_utc + departure_name_normalized + arrival_name_normalized`
对完全相同指纹直接预警；对相似指纹计算相似度分数并提示人工确认。

4. `多段行程归组算法`  
若多个 `Segment` 在时间上连续、地点相连、来源相同或用户手动指定同一行程，则归组到同一 `Journey`。第一阶段可采用规则引擎，后续再升级为更复杂的自动归并。

5. `地图路径生成算法`  
单段场景输出一条 `LineString`；多段场景输出多个折线段并计算方向箭头角度。地图视口通过所有坐标点的 bounding box 自动计算。

6. `票根图生成算法`  
业务层只输出模板无关的 `RenderPayload`，包含标题区、时间区、地点区、承运信息区、附加信息区。前端模板引擎基于 payload 渲染 SVG，再导出 PNG。这样后续更换视觉主题不影响业务层。

### English

1. `Time normalization`  
All sorting, deduplication, and analytics should use a unified `UTC` timeline, while the UI keeps the original local timezone values for display. Each input should persist the tuple `local time + timezone + utc time` to avoid cross-timezone ordering bugs.

2. `Geo-resolution`  
Use a four-level strategy: exact code match, local cached alias match, provider fuzzy lookup, and user-confirmed degraded save. Airports should prefer IATA codes, and stations should prefer station-name-plus-city matching.

3. `Duplicate detection`  
Build a fingerprint:
`ticket_type + carrier + code + departure_time_utc + departure_name_normalized + arrival_name_normalized`
Exact fingerprint matches trigger direct warnings; near matches produce a similarity score and request user confirmation.

4. `Multi-segment grouping`  
If multiple `Segment` records are time-adjacent, location-connected, share origin context, or are explicitly grouped by the user, they should be assigned to the same `Journey`. Phase one can use a rule-based engine, with more advanced auto-grouping added later.

5. `Map route generation`  
Single-leg trips output one `LineString`; multi-leg trips output multiple polylines and compute arrow headings. The viewport is calculated from the bounding box of all coordinates.

6. `Ticket-stub generation`  
The service layer should emit a template-agnostic `RenderPayload` containing title, time, location, carrier, and extra-info blocks. The frontend template engine renders SVG from that payload and exports PNG, allowing future visual redesign without changing the business layer.

## 9. API 草案
## 9. API Draft

### 中文

虽然第一阶段是本地桌面应用，仍建议按 REST 风格或 command/query 风格定义稳定接口，便于后续接入本地 HTTP 服务或云端 API。

推荐统一响应结构：

```json
{
  "status": "success",
  "message": "ok",
  "data": {},
  "error_code": null,
  "trace_id": "01HXYZ..."
}
```

核心接口草案：

```text
POST   /tickets
GET    /tickets
GET    /tickets/{ticketId}
PUT    /tickets/{ticketId}
DELETE /tickets/{ticketId}

GET    /journeys
GET    /journeys/{journeyId}

POST   /geo/resolve
POST   /renders/ticket-stub
POST   /exports/ticket-stub/{ticketId}
GET    /artifacts/{artifactId}

GET    /search/tickets
POST   /duplicates/check
```

`POST /tickets` 请求体示例：

```json
{
  "ticketType": "flight",
  "sourceType": "manual",
  "carrierName": "China Eastern",
  "code": "MU561",
  "departure": {
    "name": "Shanghai Pudong International Airport",
    "code": "PVG",
    "timezone": "Asia/Shanghai",
    "timeLocal": "2026-05-01T10:30:00"
  },
  "arrival": {
    "name": "Sydney Airport",
    "code": "SYD",
    "timezone": "Australia/Sydney",
    "timeLocal": "2026-05-01T21:00:00"
  },
  "seatInfo": "12A",
  "classInfo": "Economy",
  "notes": "Window seat"
}
```

`GET /tickets` 查询参数建议：

- `ticketType`
- `carrier`
- `from`
- `to`
- `departureDateStart`
- `departureDateEnd`
- `keyword`
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

### English

Even though phase one is a desktop-local application, the system should still define stable REST-like or command/query-style contracts so it can later evolve into a local HTTP service or cloud-backed API.

The recommended unified response structure is shown above.

Recommended core endpoints:

```text
POST   /tickets
GET    /tickets
GET    /tickets/{ticketId}
PUT    /tickets/{ticketId}
DELETE /tickets/{ticketId}

GET    /journeys
GET    /journeys/{journeyId}

POST   /geo/resolve
POST   /renders/ticket-stub
POST   /exports/ticket-stub/{ticketId}
GET    /artifacts/{artifactId}

GET    /search/tickets
POST   /duplicates/check
```

## 10. 输入输出规范
## 10. Input and Output Specification

### 中文

输入规范：

- 前端字段命名统一使用 `camelCase`
- 后端数据库字段统一使用 `snake_case`
- 所有时间入库统一保存 UTC，展示时再格式化
- 所有地理坐标统一采用 `WGS84`
- 所有文件导出都需要附带 `checksum` 与生成版本号

输出规范：

- 列表接口返回轻量数据，不直接返回大体积渲染内容
- 详情接口返回标准化字段、解析结果、派生资源引用
- 导出接口返回文件路径、mime type、大小、创建时间
- 错误响应必须返回 `error_code` 和 `trace_id`

### English

Input rules:

- Frontend payload fields should use `camelCase`
- Backend database fields should use `snake_case`
- All stored times should persist in UTC and be formatted for display later
- All coordinates should use `WGS84`
- Every exported file should include a `checksum` and render version

Output rules:

- List endpoints should return lightweight records and not embed large render payloads
- Detail endpoints should return normalized fields, resolution results, and derived artifact references
- Export endpoints should return file path, MIME type, size, and creation time
- Error responses must include `error_code` and `trace_id`

## 11. 边界条件与处理策略
## 11. Edge Cases and Handling Strategy

### 中文

- 跨时区航班：必须保存起飞时区与到达时区，禁止仅依赖本地字符串时间。
- 未识别机场/车站：允许先保存为 `unknown location`，并标记待补全状态。
- 多段票据：一个 `TicketRecord` 可以映射多个 `Segment`。
- 重复录入：不自动覆盖，改为提示用户合并、忽略或继续保存。
- 历史旧票：允许时间字段不完整，但状态需标明 `partial_data`。
- 离线模式：地理解析失败时允许仅保存原始名称，待网络可用时补解析。
- 国际化字符：数据库、导出文件名、渲染层均统一 UTF-8。

### English

- Cross-timezone flights: departure and arrival timezones must be stored explicitly; never rely only on local time strings.
- Unresolved airports/stations: allow saving as `unknown location` and mark the record as incomplete.
- Multi-leg tickets: one `TicketRecord` may map to multiple `Segment` records.
- Duplicate entry: never overwrite silently; ask the user to merge, ignore, or save anyway.
- Historical tickets: incomplete time fields can be allowed, but the record should be marked as `partial_data`.
- Offline mode: if geo-resolution fails, persist the raw place text and resolve later when connectivity returns.
- International characters: database, exported filenames, and rendering should consistently use UTF-8.

## 12. 工程规范与质量保障
## 12. Engineering Standards and Quality Assurance

### 中文

建议采用以下工程规范：

- 代码风格：前端 `ESLint + Prettier`，Rust 使用 `clippy + rustfmt`
- 测试分层：单元测试、应用服务测试、SQLite 集成测试、渲染快照测试
- 日志规范：分级日志 `debug / info / warn / error`
- 错误模型：业务错误与系统错误分离
- 数据迁移：使用版本化 migration，禁止手改线上库结构
- 提交规范：按功能维度拆分 commit，提交信息清晰描述范围与目的

建议最低测试覆盖重点：

- 时间归一化
- 地理解析降级逻辑
- 重复票务识别
- 多段行程归组
- 票根渲染 payload 生成
- 导出流程完整性

### English

The following engineering standards are recommended:

- Code style: frontend with `ESLint + Prettier`, Rust with `clippy + rustfmt`
- Test layers: unit tests, application-service tests, SQLite integration tests, and render snapshot tests
- Logging: leveled logs with `debug / info / warn / error`
- Error model: business errors separated from system errors
- Data migration: versioned migrations only; never hand-edit production schema
- Commit style: split commits by feature scope and write clear messages describing the purpose

Minimum high-priority test coverage should include:

- Time normalization
- Geo-resolution fallback logic
- Duplicate detection
- Multi-segment grouping
- Ticket-stub render payload generation
- Export pipeline integrity

## 13. 迭代计划
## 13. Delivery Roadmap

### 中文

建议按以下里程碑推进：

1. `Milestone 1`  
完成领域模型、SQLite schema、票务录入、列表与详情。

2. `Milestone 2`  
完成地点解析缓存、地图线路绘制、单段行程展示。

3. `Milestone 3`  
完成票根渲染引擎、PNG 导出、资源文件管理。

4. `Milestone 4`  
完成重复识别、搜索筛选、多段行程归组。

5. `Milestone 5`  
评估 OCR 导入、云同步、macOS 打包与 Android 方案。

### English

The delivery roadmap should proceed through these milestones:

1. `Milestone 1`  
Complete the domain model, SQLite schema, ticket entry, list view, and detail view.

2. `Milestone 2`  
Complete geo-resolution caching, route rendering, and single-leg itinerary display.

3. `Milestone 3`  
Complete the ticket-stub rendering engine, PNG export, and artifact management.

4. `Milestone 4`  
Complete duplicate detection, search/filtering, and multi-segment grouping.

5. `Milestone 5`  
Evaluate OCR import, cloud sync, macOS packaging, and the Android implementation path.

## 14. 结论
## 14. Conclusion

### 中文

这套方案的关键在于先把“票务原始数据、标准化行程、地图数据、票根渲染数据”彻底解耦，再通过本地优先架构实现稳定落地。若第一阶段严格按此分层实现，后续增加新票种、切换视觉模板、扩展平台和接入云能力时，整体改造成本会明显更低。

### English

The key to this plan is the strict separation of raw ticket data, normalized journeys, map data, and ticket-stub render data, all delivered on top of a local-first architecture. If phase one follows this layering rigorously, future work such as adding new ticket types, changing visual templates, expanding to more platforms, and integrating cloud features will be significantly cheaper and safer.
