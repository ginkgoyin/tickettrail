import { useMemo, useState } from "react";
import type { TicketRecord, TicketSegmentDraft, TicketType } from "../types/ticket";

type ArchiveFilterPatch = {
  query?: string;
  ticketType?: "all" | TicketType;
};

interface StatisticsPanelProps {
  activeArchiveContext: {
    query: string;
    ticketType: "all" | TicketType;
    status: "all" | "saved" | "used" | "archived";
    sort: string;
  };
  onApplyArchiveFilter: (patch: ArchiveFilterPatch) => void;
  tickets: TicketRecord[];
  totalCount: number;
}

interface RankedItem {
  label: string;
  count: number;
}

type AnalyticsMode = "all" | TicketType;

function collectSegments(ticket: TicketRecord): TicketSegmentDraft[] {
  return [
    {
      carrierName: ticket.carrierName,
      code: ticket.code,
      departure: ticket.departure,
      arrival: ticket.arrival,
      departureTimeLocal: ticket.departureTimeLocal,
      arrivalTimeLocal: ticket.arrivalTimeLocal,
      classInfo: ticket.classInfo,
      seatInfo: ticket.seatInfo,
      notes: ticket.notes,
    },
    ...(ticket.segments ?? []),
  ];
}

function tally(items: string[]) {
  const counter = new Map<string, number>();

  items
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      counter.set(item, (counter.get(item) ?? 0) + 1);
    });

  return Array.from(counter.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function inferRegionLabel(name: string, timezone: string) {
  const lowerName = name.toLowerCase();

  if (
    timezone === "Asia/Shanghai" ||
    /shanghai|beijing|guangzhou|shenzhen|nanjing|chongqing|zhangjiajie/.test(lowerName)
  ) {
    return "China";
  }
  if (
    timezone === "Australia/Sydney" ||
    timezone === "Australia/Melbourne" ||
    /sydney|melbourne/.test(lowerName)
  ) {
    return "Australia";
  }
  if (timezone === "Asia/Tokyo" || /tokyo|narita|haneda/.test(lowerName)) {
    return "Japan";
  }
  if (timezone === "Asia/Singapore" || /singapore/.test(lowerName)) {
    return "Singapore";
  }
  if (timezone === "Asia/Hong_Kong" || /hong kong/.test(lowerName)) {
    return "Hong Kong";
  }

  if (timezone.includes("/")) {
    return timezone.split("/")[0];
  }

  return "Unknown";
}

function buildMonthlyCounts(tickets: TicketRecord[]) {
  const buckets = new Map<string, number>();

  tickets.forEach((ticket) => {
    const monthKey = ticket.departureTimeLocal.slice(0, 7) || ticket.createdAt.slice(0, 7);
    if (monthKey) {
      buckets.set(monthKey, (buckets.get(monthKey) ?? 0) + 1);
    }
  });

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([label, count]) => ({ label, count }));
}

function formatYearLabel(value: string) {
  return value === "all" ? "All years" : value;
}

function RankedList({
  activeLabel,
  items,
  onPickItem,
  title,
}: {
  title: string;
  items: RankedItem[];
  activeLabel?: string;
  onPickItem?: (item: RankedItem) => void;
}) {
  return (
    <article className="detail-card analytics-card">
      <span>{title}</span>
      {items.length ? (
        <div className="analytics-list">
          {items.slice(0, 5).map((item, index) => (
            onPickItem ? (
              <button
                className={
                  activeLabel === item.label
                    ? "analytics-list-button analytics-list-button-active"
                    : "analytics-list-button"
                }
                key={`${title}-${item.label}`}
                onClick={() => onPickItem(item)}
                type="button"
              >
                <span className="analytics-list-item">
                  <strong>{`${index + 1}. ${item.label}`}</strong>
                  <span>{item.count}</span>
                </span>
              </button>
            ) : (
              <div className="analytics-list-item" key={`${title}-${item.label}`}>
                <strong>{`${index + 1}. ${item.label}`}</strong>
                <span>{item.count}</span>
              </div>
            )
          ))}
        </div>
      ) : (
        <strong>No data yet</strong>
      )}
    </article>
  );
}

export function StatisticsPanel({
  activeArchiveContext,
  onApplyArchiveFilter,
  tickets,
  totalCount,
}: StatisticsPanelProps) {
  const [mode, setMode] = useState<AnalyticsMode>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.departureTimeLocal.slice(0, 4) || ticket.createdAt.slice(0, 4))
          .filter(Boolean),
      ),
    ).sort((left, right) => right.localeCompare(left));

    return ["all", ...years];
  }, [tickets]);

  const scopedTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (mode !== "all" && ticket.ticketType !== mode) {
        return false;
      }

      if (selectedYear !== "all") {
        const ticketYear = ticket.departureTimeLocal.slice(0, 4) || ticket.createdAt.slice(0, 4);
        if (ticketYear !== selectedYear) {
          return false;
        }
      }

      return true;
    });
  }, [mode, selectedYear, tickets]);

  const analytics = useMemo(() => {
    const allSegments = scopedTickets.flatMap(collectSegments);
    const carrierCounts = tally(allSegments.map((segment) => segment.carrierName));
    const cityCounts = tally(
      allSegments.flatMap((segment) => [segment.departure.name, segment.arrival.name]),
    );
    const regionCounts = tally(
      allSegments.flatMap((segment) => [
        inferRegionLabel(segment.departure.name, segment.departure.timezone),
        inferRegionLabel(segment.arrival.name, segment.arrival.timezone),
      ]),
    );
    const monthlyCounts = buildMonthlyCounts(scopedTickets);
    const totalSegments = allSegments.length;
    const flightCount = scopedTickets.filter((ticket) => ticket.ticketType === "flight").length;
    const trainCount = scopedTickets.filter((ticket) => ticket.ticketType === "train").length;
    const chartMax = Math.max(...monthlyCounts.map((item) => item.count), 1);

    return {
      carrierCounts,
      cityCounts,
      regionCounts,
      monthlyCounts,
      totalSegments,
      chartMax,
      flightCount,
      trainCount,
      averageSegments:
        scopedTickets.length > 0 ? (totalSegments / scopedTickets.length).toFixed(1) : "0.0",
    };
  }, [scopedTickets]);

  const archiveScopeQuery = selectedYear === "all" ? "" : selectedYear;
  const normalizedActiveQuery = activeArchiveContext.query.trim().toLowerCase();
  const activeModeMatches =
    activeArchiveContext.ticketType === mode ||
    (mode === "all" && activeArchiveContext.ticketType === "all");
  const activeScopeSummary = useMemo(() => {
    const labels: string[] = [];

    if (activeArchiveContext.ticketType !== "all") {
      labels.push(activeArchiveContext.ticketType === "flight" ? "Flight" : "Rail");
    }
    if (activeArchiveContext.status !== "all") {
      labels.push(activeArchiveContext.status);
    }
    if (activeArchiveContext.query.trim()) {
      labels.push(activeArchiveContext.query.trim());
    }

    return labels;
  }, [activeArchiveContext]);

  const handleApplyScopeToArchive = () => {
    onApplyArchiveFilter({
      query: archiveScopeQuery,
      ticketType: mode,
    });
  };

  const handleClearAnalyticsContext = () => {
    onApplyArchiveFilter({
      query: "",
      ticketType: "all",
    });
  };

  const regionActiveLabel = useMemo(() => {
    const query = activeArchiveContext.query.trim().toLowerCase();
    if (!query || !activeModeMatches) {
      return "";
    }

    return (
      analytics.regionCounts.find((item) => item.label.toLowerCase() === query)?.label || ""
    );
  }, [activeArchiveContext.query, activeModeMatches, analytics.regionCounts]);

  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div>
          <h3>Travel insights</h3>
        </div>
        <span className="status-pill">
          {scopedTickets.length} in view / {totalCount} total
        </span>
      </div>
      {activeScopeSummary.length ? (
        <div className="context-chip-row">
          {activeScopeSummary.map((item) => (
            <span className="field-meta-chip context-chip analytics-context-chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="analytics-toolbar">
        <div className="analytics-toggle-group">
          <button
            className={`theme-chip ${mode === "all" ? "active" : ""}`}
            onClick={() => setMode("all")}
            type="button"
          >
            All
          </button>
          <button
            className={`theme-chip ${mode === "flight" ? "active" : ""}`}
            onClick={() => setMode("flight")}
            type="button"
          >
            Flights
          </button>
          <button
            className={`theme-chip ${mode === "train" ? "active" : ""}`}
            onClick={() => setMode("train")}
            type="button"
          >
            Rail
          </button>
        </div>

        <label className="analytics-year-picker">
          <span>Scope</span>
          <select
            onChange={(event) => setSelectedYear(event.target.value)}
            value={selectedYear}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {formatYearLabel(year)}
              </option>
            ))}
          </select>
        </label>

        <button className="ghost-button compact-button" onClick={handleApplyScopeToArchive} type="button">
          Apply scope to archive
        </button>
        <button className="ghost-button compact-button" onClick={handleClearAnalyticsContext} type="button">
          Clear analytics context
        </button>
      </div>

      <div className="analytics-summary-grid">
        <article className="detail-card analytics-card">
          <span>Total segments</span>
          <strong>{analytics.totalSegments}</strong>
        </article>
        <article className="detail-card analytics-card">
          <span>Avg segments / trip</span>
          <strong>{analytics.averageSegments}</strong>
        </article>
        <article className="detail-card analytics-card">
          <span>Flights / rail</span>
          <strong>{`${analytics.flightCount} / ${analytics.trainCount}`}</strong>
        </article>
        <article className="detail-card analytics-card">
          <span>Top carrier</span>
          <strong>{analytics.carrierCounts[0]?.label || "N/A"}</strong>
        </article>
      </div>

      <div className="analytics-grid">
        <RankedList
          activeLabel={activeModeMatches ? activeArchiveContext.query.trim() : ""}
          items={analytics.carrierCounts}
          onPickItem={(item) => onApplyArchiveFilter({ query: item.label, ticketType: mode })}
          title="Top carriers"
        />
        <RankedList
          activeLabel={activeModeMatches ? activeArchiveContext.query.trim() : ""}
          items={analytics.cityCounts}
          onPickItem={(item) => onApplyArchiveFilter({ query: item.label, ticketType: mode })}
          title="Top cities / stations"
        />
        <RankedList
          activeLabel={regionActiveLabel}
          items={analytics.regionCounts}
          onPickItem={(item) => onApplyArchiveFilter({ query: item.label, ticketType: mode })}
          title="Top countries / regions"
        />

        <article className="detail-card analytics-card">
          <span>Recent months</span>
          {analytics.monthlyCounts.length ? (
            <div className="analytics-chart">
              {analytics.monthlyCounts.map((item) => (
                <button
                  className={
                    activeModeMatches && normalizedActiveQuery === item.label.toLowerCase()
                      ? "analytics-bar-button analytics-bar-button-active"
                      : "analytics-bar-button"
                  }
                  key={item.label}
                  onClick={() => onApplyArchiveFilter({ query: item.label, ticketType: mode })}
                  type="button"
                >
                  <span className="analytics-bar-row">
                    <span className="analytics-bar-meta">
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </span>
                    <span className="analytics-bar-track">
                      <span
                        className="analytics-bar-fill"
                        style={{ width: `${(item.count / analytics.chartMax) * 100}%` }}
                      />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <strong>No departure history yet</strong>
          )}
        </article>
      </div>
    </section>
  );
}
