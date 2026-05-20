import { useMemo } from "react";
import type { TicketRecord, TicketSegmentDraft } from "../types/ticket";

interface StatisticsPanelProps {
  tickets: TicketRecord[];
  totalCount: number;
}

interface RankedItem {
  label: string;
  count: number;
}

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
  if (timezone === "Asia/Shanghai" || /shanghai|beijing|guangzhou|shenzhen|nanjing|chongqing|zhangjiajie/.test(lowerName)) {
    return "China";
  }
  if (timezone === "Australia/Sydney" || timezone === "Australia/Melbourne" || /sydney|melbourne/.test(lowerName)) {
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
    .slice(-6);
}

function RankedList({ title, items }: { title: string; items: RankedItem[] }) {
  return (
    <article className="detail-card analytics-card">
      <span>{title}</span>
      {items.length ? (
        <div className="analytics-list">
          {items.slice(0, 5).map((item, index) => (
            <div className="analytics-list-item" key={`${title}-${item.label}`}>
              <strong>{`${index + 1}. ${item.label}`}</strong>
              <span>{item.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <strong>No data yet</strong>
      )}
    </article>
  );
}

export function StatisticsPanel({ tickets, totalCount }: StatisticsPanelProps) {
  const analytics = useMemo(() => {
    const allSegments = tickets.flatMap(collectSegments);
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
    const monthlyCounts = buildMonthlyCounts(tickets);
    const totalSegments = allSegments.length;

    return {
      carrierCounts,
      cityCounts,
      regionCounts,
      monthlyCounts,
      totalSegments,
      averageSegments:
        tickets.length > 0 ? (totalSegments / tickets.length).toFixed(1) : "0.0",
    };
  }, [tickets]);

  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h3>Travel insights</h3>
        </div>
        <span className="status-pill">
          {tickets.length} filtered / {totalCount} total
        </span>
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
          <span>Top carrier</span>
          <strong>{analytics.carrierCounts[0]?.label || "N/A"}</strong>
        </article>
        <article className="detail-card analytics-card">
          <span>Top region</span>
          <strong>{analytics.regionCounts[0]?.label || "N/A"}</strong>
        </article>
      </div>

      <div className="analytics-grid">
        <RankedList items={analytics.carrierCounts} title="Top carriers" />
        <RankedList items={analytics.cityCounts} title="Top cities / stations" />
        <RankedList items={analytics.regionCounts} title="Top countries / regions" />
        <article className="detail-card analytics-card">
          <span>Recent months</span>
          {analytics.monthlyCounts.length ? (
            <div className="analytics-list">
              {analytics.monthlyCounts.map(([label, count]) => (
                <div className="analytics-list-item" key={label}>
                  <strong>{label}</strong>
                  <span>{count}</span>
                </div>
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
