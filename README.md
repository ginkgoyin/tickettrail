# TicketTrail

## 中文

`TicketTrail` 是一个以票务信息沉淀、行程可视化和票根生成归档为核心的跨平台项目规划稿。第一阶段优先做桌面端，建议从 Windows 版本起步；在业务模型和数据结构稳定后，再扩展到 macOS 与 Android。

推荐中文名：`票迹`

推荐英文名：`TicketTrail`

命名含义：

- `Ticket` 表达机票、火车票等票务信息管理。
- `Trail` 表达出行轨迹、地图路线和历史归档能力。

备选名称：

- `RouteKeeper`：更强调路线与记录保存。
- `ItinStub`：更强调 itinerary 与票根存档。
- `TripLedger`：更强调结构化出行账本。

本目录当前包含：

- `README.md`：项目定位、命名方案与阶段目标。
- `docs/requirements-analysis.md`：结构化需求分析报告。

第一阶段目标：

1. 建立统一的票务数据模型，覆盖机票与火车票。
2. 支持录入、编辑、检索、归档和可视化展示票务信息。
3. 根据出发地与目的地生成地图行程连线和方向标识。
4. 根据票务信息自动生成票根图并可保存导出。

## English

`TicketTrail` is a cross-platform project concept centered on ticket information archiving, itinerary visualization, and ticket-stub image generation. The first phase should prioritize desktop, starting with Windows; once the business model and data structures are stable, the product can expand to macOS and Android.

Recommended Chinese name: `票迹`

Recommended English name: `TicketTrail`

Name rationale:

- `Ticket` reflects management of flight tickets, train tickets, and similar travel records.
- `Trail` reflects trip traces, map routes, and historical archiving.

Alternative names:

- `RouteKeeper`: emphasizes route management and record keeping.
- `ItinStub`: emphasizes itineraries and ticket-stub archiving.
- `TripLedger`: emphasizes a structured travel ledger.

This directory currently contains:

- `README.md`: project positioning, naming options, and phase goals.
- `docs/requirements-analysis.md`: structured requirements analysis report.
- `docs/technical-implementation-plan.md`: implementation-ready technical architecture, module plan, API draft, and engineering standards.
- `docs/development-setup.md`: scaffold status and local startup guidance.
- `src/`: React-based Windows-first frontend scaffold.
- `src-tauri/`: Tauri 2 desktop shell and Rust command scaffold.
- `database/schema.sql`: initial SQLite schema draft.

Phase 1 goals:

1. Build a unified ticket data model covering flights and trains.
2. Support ticket record creation, editing, search, archiving, and visualization.
3. Generate map route lines and direction markers from origin and destination data.
4. Auto-generate ticket-stub images from ticket details and support persistence/export.
