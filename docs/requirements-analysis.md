# TicketTrail 需求分析报告

## 1. 项目概述

### 中文

`TicketTrail` 是一个面向个人票务归档与行程管理的跨平台软件项目。系统用于记录机票、火车票等票务信息，自动组织为结构化行程记录，并基于出发地与目的地生成地图轨迹。同时，系统需要根据录入的信息生成具有视觉呈现能力的票根图，用于保存、展示与后续导出。

第一阶段建议聚焦 Windows 桌面端，优先验证数据模型、地图渲染、票根生成和本地数据持久化。后续在领域模型稳定后，扩展到 macOS 与 Android，以复用核心业务层与数据结构。

### English

`TicketTrail` is a cross-platform software project for personal ticket archiving and itinerary management. The system records ticket information such as flights and train rides, organizes it into structured itinerary records, and generates map-based travel paths from origin and destination data. It also needs to generate visually rendered ticket-stub images from the entered data for storage, display, and later export.

The first phase should focus on Windows desktop to validate the data model, map rendering, ticket-stub generation, and local persistence. Once the domain model stabilizes, the product can expand to macOS and Android by reusing the core business layer and shared data structures.

## 2. 产品目标

### 中文

核心目标如下：

1. 帮助用户长期保存和查询票务信息，减少票据分散与丢失。
2. 将票务信息自动转化为可理解的行程数据，而不是仅做原始字段存储。
3. 让用户直观看到跨城市、跨国家的旅行轨迹。
4. 自动生成统一风格的电子票根图，作为记录与回顾材料。
5. 为后续扩展多端同步、OCR 导入、分享导出和统计分析打下基础。

### English

The core goals are:

1. Help users preserve and query ticket records over time, reducing scattered and lost ticket data.
2. Transform ticket inputs into understandable itinerary data rather than storing raw fields only.
3. Let users visually understand travel paths across cities and countries.
4. Auto-generate consistently styled digital ticket stubs for archival and review.
5. Lay the groundwork for future expansion into sync, OCR import, sharing/export, and analytics.

## 3. 核心业务逻辑

### 中文

系统的核心业务闭环为：

1. 用户录入票务信息。
2. 系统校验字段完整性与格式合法性。
3. 系统将票务信息标准化为统一的行程记录模型。
4. 系统根据地点信息解析地图坐标或地理实体。
5. 系统生成地图路线数据与票根图数据。
6. 系统保存原始票务记录、标准化记录、可视化衍生内容及关联元数据。
7. 用户可在列表、详情页、地图页、票根页中查看、检索、编辑和导出。

对后端而言，核心不是“画图”本身，而是持续产出稳定、可复用的标准化数据，包括：

- 票务原始数据
- 标准化交通段数据
- 地理位置映射数据
- 票根渲染输入数据
- 导出与归档数据

### English

The core business loop is:

1. The user enters ticket information.
2. The system validates completeness and field format correctness.
3. The system normalizes the ticket input into a unified itinerary record model.
4. The system resolves map coordinates or geographic entities from location data.
5. The system generates map route data and ticket-stub rendering data.
6. The system persists the raw ticket record, normalized travel record, derived visual assets, and related metadata.
7. The user can view, search, edit, and export data from list, detail, map, and ticket-stub views.

From a backend perspective, the real core is not the drawing itself but the stable production of reusable normalized data, including:

- Raw ticket data
- Normalized transport segment data
- Geo-mapped location data
- Ticket-stub render input data
- Export and archival data

## 4. 核心功能模块

### 中文

建议拆分为以下模块：

1. 票务录入模块  
支持手动录入机票、火车票，后续可扩展 OCR 导入、邮件导入、截图识别导入。

2. 票务标准化模块  
将不同票种映射为统一领域对象，例如 `Ticket`、`Journey`、`Segment`、`Location`。

3. 行程管理模块  
以单段或多段方式组织用户出行记录，支持同一趟旅行下的多个交通段归并。

4. 地图可视化模块  
根据起点、终点及中转点生成折线、箭头方向、地点标记和地图视图范围。

5. 票根生成模块  
根据票种和模板生成视觉票根图，后续可支持不同主题风格和导出尺寸。

6. 数据存储与归档模块  
负责本地数据库、图片文件、导出文件和元数据管理。

7. 检索筛选模块  
支持按出发地、目的地、票种、日期区间、航空公司、车次等条件查询。

8. 导出与分享模块  
支持导出票根图、行程卡片、结构化数据文件，后续可扩展 PDF 和分享链接。

### English

The system should be divided into the following modules:

1. Ticket entry module  
Supports manual entry of flights and train tickets, with future extension to OCR import, email import, and screenshot recognition.

2. Ticket normalization module  
Maps different ticket types into unified domain objects such as `Ticket`, `Journey`, `Segment`, and `Location`.

3. Itinerary management module  
Organizes trips as single-segment or multi-segment journeys and supports grouping multiple transport segments under one trip.

4. Map visualization module  
Generates polylines, direction arrows, place markers, and map view bounds from origin, destination, and transfer points.

5. Ticket-stub generation module  
Generates visual ticket-stub images from ticket type and templates, with future support for multiple themes and export sizes.

6. Storage and archival module  
Handles local database records, image files, exported files, and metadata management.

7. Search and filter module  
Supports querying by origin, destination, ticket type, date range, airline, train number, and related conditions.

8. Export and sharing module  
Supports exporting ticket-stub images, itinerary cards, and structured data, with future expansion into PDF and shareable links.

## 5. 领域模型建议

### 中文

建议的核心实体如下：

- `UserProfile`
  表示本地用户配置、时区、偏好设置和默认语言。

- `Ticket`
  表示原始票务记录，包含票种、票号、供应商、录入来源、附件等。

- `Journey`
  表示一次完整出行，可由一个或多个 `Segment` 构成。

- `Segment`
  表示单个交通段，如“上海 -> 悉尼”的航班，或“上海虹桥 -> 南京南”的高铁。

- `Location`
  表示地点实体，可细分为机场、火车站、城市、国家，并关联经纬度。

- `Carrier`
  表示承运方，如航空公司、铁路运营方。

- `RenderedArtifact`
  表示衍生渲染结果，如票根图、地图缩略图、导出卡片。

### English

The recommended core entities are:

- `UserProfile`
  Represents local user settings, timezone, preferences, and default language.

- `Ticket`
  Represents the raw ticket record, including ticket type, ticket number, provider, input source, and attachments.

- `Journey`
  Represents a complete trip that may contain one or more `Segment` records.

- `Segment`
  Represents a single transport leg, such as a flight from Shanghai to Sydney or a train from Shanghai Hongqiao to Nanjing South.

- `Location`
  Represents a place entity, which may be an airport, station, city, or country and is linked to coordinates.

- `Carrier`
  Represents the operator, such as an airline or rail provider.

- `RenderedArtifact`
  Represents derived visual outputs such as ticket-stub images, map thumbnails, and export cards.

## 6. 输入规范

### 中文

第一阶段建议采用结构化表单输入，避免直接依赖 OCR。输入规范建议如下：

通用字段：

- 票种：`flight` / `train`
- 出发地点名称
- 到达地点名称
- 出发时间
- 到达时间
- 时区信息
- 承运方名称
- 班次号或车次号
- 座位/舱位信息
- 订单号或票号
- 备注

机票附加字段：

- 出发机场三字码
- 到达机场三字码
- 航站楼
- 舱位等级

火车票附加字段：

- 出发车站名
- 到达车站名
- 车厢号
- 座位号
- 车次类型

输入校验规则：

- 起飞/发车时间必须早于或不等于到达时间，跨时区场景除外，需要转换为统一时间轴校验。
- 航班号与车次号需要符合基础格式规则。
- 地点至少应能定位到城市级；若无法识别精确机场/车站，应允许降级保存。
- 同一张票在短时间内重复录入时，应触发重复提醒而非静默覆盖。

### English

Phase 1 should use structured form-based input rather than depending on OCR. The recommended input contract is:

Common fields:

- Ticket type: `flight` / `train`
- Origin location name
- Destination location name
- Departure time
- Arrival time
- Timezone information
- Carrier name
- Flight number or train number
- Seat or cabin information
- Order number or ticket number
- Notes

Flight-specific fields:

- Origin airport IATA code
- Destination airport IATA code
- Terminal
- Cabin class

Train-specific fields:

- Origin station name
- Destination station name
- Coach number
- Seat number
- Train service type

Validation rules:

- Departure time must be earlier than or equal to arrival time, except when cross-timezone conversion requires normalization to a unified timeline.
- Flight numbers and train numbers must pass basic format checks.
- Locations should resolve at least to city level; if an exact airport or station cannot be resolved, graceful degraded storage should still be allowed.
- If the same ticket is entered again within a short interval, the system should raise a duplicate warning instead of silently overwriting data.

## 7. 输出规范

### 中文

系统需要提供以下输出：

1. 结构化票务记录  
用于列表展示、检索和详情页。

2. 标准化行程记录  
用于地图绘制、统计分析和多段行程合并。

3. 票根渲染数据  
用于驱动前端或渲染引擎生成视觉票根图。

4. 地图轨迹数据  
至少包括起点、终点、经纬度、方向信息、显示边界。

5. 导出文件  
如 PNG、JPEG、后续扩展 PDF、JSON、CSV。

建议后端输出接口采用统一响应结构，例如：

- `status`
- `message`
- `data`
- `error_code`
- `trace_id`

### English

The system needs to provide the following outputs:

1. Structured ticket records  
For list display, search, and detail views.

2. Normalized itinerary records  
For map rendering, analytics, and multi-segment trip grouping.

3. Ticket-stub render payloads  
To drive the frontend or rendering engine in creating visual ticket stubs.

4. Map route data  
At minimum including origin, destination, coordinates, direction information, and viewport bounds.

5. Exported files  
Such as PNG, JPEG, and later PDF, JSON, and CSV.

The backend should expose a unified response shape, for example:

- `status`
- `message`
- `data`
- `error_code`
- `trace_id`

## 8. 边界条件与异常场景

### 中文

需要重点处理以下边界条件：

1. 跨时区与跨日期  
例如上海起飞、悉尼到达，表面时间顺序可能与本地时间直觉不一致。

2. 同城多机场、多车站  
例如上海存在浦东、虹桥机场与多个火车站，地点映射必须避免混淆。

3. 机场/车站缺失编码  
用户可能只知道“上海”与“悉尼”，系统应允许模糊保存并延后补全。

4. 中转与联程  
一张票可能对应多个航段或车段，不能简单假设“一票一段”。

5. 重复票据  
相同行程可能因截图、手工录入、不同来源导入而重复出现。

6. 历史与未来行程并存  
系统既要支持回顾历史票据，也要支持未来行程提醒与规划。

7. 无网络或离线场景  
桌面端可能长期离线，本地数据完整性必须优先保障。

8. 国际化字符  
地点、承运方、备注可能包含中英文、日文、韩文及特殊字符。

### English

The following edge cases need careful handling:

1. Cross-timezone and cross-date travel  
For example, a Shanghai departure and Sydney arrival may appear inconsistent in local clock time without normalization.

2. Multiple airports or stations within one city  
For example, Shanghai has Pudong, Hongqiao, and multiple train stations, so place resolution must avoid ambiguity.

3. Missing airport or station codes  
Users may only know “Shanghai” and “Sydney,” so the system should allow fuzzy storage and deferred completion.

4. Transfers and connected trips  
One ticket may contain multiple flight or train segments, so the model cannot assume one ticket equals one segment.

5. Duplicate tickets  
The same trip may appear multiple times through screenshots, manual input, or imports from different sources.

6. Historical and future trips together  
The system should support both retrospective archiving and future itinerary tracking.

7. Offline or low-connectivity usage  
The desktop app may operate offline for long periods, so local integrity must be prioritized.

8. Internationalized characters  
Locations, carriers, and notes may contain Chinese, English, Japanese, Korean, and special characters.

## 9. 潜在技术难点

### 中文

1. 地理解析精度  
从用户输入的地点文本稳定映射到经纬度、机场、车站是难点，尤其在模糊输入和多语言场景下。

2. 时间处理复杂度  
航班天然涉及时区、夏令时、跨日，若时间模型设计不严谨，后续排序、展示和统计都会出错。

3. 多票种统一模型设计  
机票与火车票字段差异较大，但又需要统一查询与地图展示，领域抽象要足够稳。

4. 票根图生成一致性  
票根图既要美观，又要适配不同票种、分辨率和导出尺寸，需要将数据层和模板层清晰分离。

5. 地图绘制与离线能力平衡  
若地图依赖在线服务，需要考虑缓存、离线回退与跨平台兼容性。

6. 未来多端同步  
如果后续增加云同步，需要提前考虑主键设计、冲突处理和本地优先策略。

### English

1. Geo-resolution accuracy  
It is difficult to reliably map user-entered place text to coordinates, airports, and stations, especially with fuzzy multilingual input.

2. Time-handling complexity  
Flights inherently involve timezones, daylight saving time, and date rollover; a weak time model will break sorting, display, and analytics later.

3. Unified multi-ticket-type modeling  
Flights and train tickets differ significantly in fields, yet the system still needs unified query and map behavior, so the domain abstraction must be stable.

4. Consistent ticket-stub generation  
Ticket stubs must be visually appealing while supporting different ticket types, resolutions, and export sizes, which requires clean separation between data and templates.

5. Balancing map rendering with offline support  
If mapping depends on online services, caching, offline fallback, and cross-platform compatibility become important.

6. Future multi-device sync  
If cloud sync is added later, ID strategy, conflict resolution, and local-first behavior should be considered early.

## 10. 后端架构建议

### 中文

从后端工程角度，建议采用“本地优先 + 核心领域清晰分层”的架构：

- 应用层：处理用例编排，如创建票务记录、更新行程、导出票根。
- 领域层：定义 `Ticket`、`Journey`、`Segment` 等核心实体和规则。
- 基础设施层：封装本地数据库、文件存储、地图服务、模板渲染。

第一阶段即使做桌面端，也建议保持 API 风格思维，便于后续迁移到本地服务或云服务。

数据存储建议：

- 结构化数据：SQLite
- 图片与导出文件：本地文件系统
- 配置数据：JSON 或 SQLite 配置表

### English

From a backend engineering perspective, a local-first architecture with clear domain layering is recommended:

- Application layer: orchestrates use cases such as creating ticket records, updating journeys, and exporting ticket stubs.
- Domain layer: defines core entities and rules such as `Ticket`, `Journey`, and `Segment`.
- Infrastructure layer: encapsulates local database access, file storage, map services, and template rendering.

Even in a desktop-first phase, it is still useful to think in API-shaped contracts so the system can later evolve into a local service or cloud-backed architecture.

Recommended storage:

- Structured data: SQLite
- Images and exported assets: local filesystem
- Configuration data: JSON or SQLite config tables

## 11. 非功能性要求

### 中文

建议明确以下非功能需求：

- 数据可靠性：保存后可追溯、可恢复、避免静默丢失。
- 性能：单条录入与查询应快速响应，地图与票根生成不能明显卡顿。
- 可扩展性：新增票种时不应大幅重构核心模型。
- 可维护性：领域规则、渲染模板、地图逻辑应解耦。
- 可国际化：支持中英文界面与多语言地点显示。
- 可审计性：关键变更要保留更新时间、来源与版本痕迹。

### English

The following non-functional requirements should be explicit:

- Reliability: saved data must be traceable, recoverable, and protected from silent loss.
- Performance: single-record entry and query should feel fast, and map/ticket generation should not noticeably lag.
- Extensibility: adding new ticket types should not require major refactors of the core model.
- Maintainability: domain rules, rendering templates, and mapping logic should remain decoupled.
- Internationalization: support Chinese/English UI and multilingual place display.
- Auditability: important changes should retain update time, source, and version traces.

## 12. 里程碑建议

### 中文

建议按以下顺序推进：

1. `MVP-1`：完成机票与火车票的手工录入、本地存储、列表查看。
2. `MVP-2`：完成地图轨迹绘制与单段详情展示。
3. `MVP-3`：完成票根图自动生成与导出。
4. `MVP-4`：支持多段联程、重复检测、筛选检索。
5. `Next`：扩展 OCR 导入、云同步、多端版本。

### English

The suggested delivery sequence is:

1. `MVP-1`: manual entry, local storage, and list views for flight and train tickets.
2. `MVP-2`: map route rendering and single-segment detail views.
3. `MVP-3`: automatic ticket-stub generation and export.
4. `MVP-4`: multi-segment trips, duplicate detection, and search/filter features.
5. `Next`: OCR import, cloud sync, and multi-platform expansion.

## 13. 结论

### 中文

这个项目的真正难点不在“做一个记录表单”，而在于建立一套能长期扩展的票务领域模型，并让地图可视化、票根生成、数据归档三者共享同一套稳定的数据基础。若第一阶段把模型、时间、地理位置和衍生渲染输入定义清楚，后续做 macOS、Android 和云同步时会顺畅很多。

### English

The real difficulty of this project is not building a simple form, but creating a long-term extensible ticket domain model that can support map visualization, ticket-stub generation, and archival workflows on top of one stable data foundation. If the first phase defines the model, time logic, geo-resolution, and rendering payloads clearly, later macOS, Android, and cloud-sync expansion will become much smoother.
