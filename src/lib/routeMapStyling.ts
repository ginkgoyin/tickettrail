import type { MapPointPayload, MapSegmentPayload } from "../types/ticket";

export interface RouteSegmentStyle {
  segmentIndex: number;
  routeKey: string;
  routeCount: number;
  transportKind: "flight" | "train" | "unknown";
  lineColor: string;
  lineGlowColor: string;
  lineWidth: number;
  glowWidth: number;
}

const FLIGHT_LINE_COLOR = "#52c8ff";
const FLIGHT_GLOW_COLOR = "rgba(82, 200, 255, 0.24)";
const RAIL_LINE_COLOR = "#ffb56b";
const RAIL_GLOW_COLOR = "rgba(255, 181, 107, 0.24)";
const UNKNOWN_LINE_COLOR = "#9db4c0";
const UNKNOWN_GLOW_COLOR = "rgba(157, 180, 192, 0.20)";

const SINGLE_ROUTE_LINE_WIDTH = 2.25;
const REPEATED_ROUTE_LINE_WIDTH = 3.4;
const SINGLE_ROUTE_GLOW_WIDTH = 5.5;
const REPEATED_ROUTE_GLOW_WIDTH = 7;

function normalizeTransportKind(value: string | null | undefined): RouteSegmentStyle["transportKind"] {
  if (value === "flight") {
    return "flight";
  }

  if (value === "train") {
    return "train";
  }

  return "unknown";
}

function buildPointIdentity(point: MapPointPayload) {
  const normalizedCode = (point.code ?? "").trim().toUpperCase();
  if (normalizedCode) {
    return `code:${normalizedCode}`;
  }

  if (typeof point.longitude === "number" && Number.isFinite(point.longitude) && typeof point.latitude === "number" && Number.isFinite(point.latitude)) {
    return `coord:${point.longitude.toFixed(4)},${point.latitude.toFixed(4)}`;
  }

  return `label:${point.label.trim().toLowerCase()}`;
}

export function buildRouteOccurrenceKey(origin: MapPointPayload, destination: MapPointPayload) {
  const endpoints = [buildPointIdentity(origin), buildPointIdentity(destination)].sort((left, right) => left.localeCompare(right));
  return `${endpoints[0]}__${endpoints[1]}`;
}

function getTransportPalette(transportKind: RouteSegmentStyle["transportKind"]) {
  if (transportKind === "flight") {
    return {
      lineColor: FLIGHT_LINE_COLOR,
      lineGlowColor: FLIGHT_GLOW_COLOR,
    };
  }

  if (transportKind === "train") {
    return {
      lineColor: RAIL_LINE_COLOR,
      lineGlowColor: RAIL_GLOW_COLOR,
    };
  }

  return {
    lineColor: UNKNOWN_LINE_COLOR,
    lineGlowColor: UNKNOWN_GLOW_COLOR,
  };
}

export function deriveRouteSegmentStyles(segments: MapSegmentPayload[]): RouteSegmentStyle[] {
  const routeCounts = new Map<string, number>();

  for (const segment of segments) {
    const routeKey = buildRouteOccurrenceKey(segment.origin, segment.destination);
    routeCounts.set(routeKey, (routeCounts.get(routeKey) ?? 0) + 1);
  }

  return segments.map((segment) => {
    const routeKey = buildRouteOccurrenceKey(segment.origin, segment.destination);
    const routeCount = routeCounts.get(routeKey) ?? 1;
    const transportKind = normalizeTransportKind(segment.transportType);
    const palette = getTransportPalette(transportKind);
    const isRepeated = routeCount >= 2;

    return {
      segmentIndex: segment.segmentIndex,
      routeKey,
      routeCount,
      transportKind,
      lineColor: palette.lineColor,
      lineGlowColor: palette.lineGlowColor,
      lineWidth: isRepeated ? REPEATED_ROUTE_LINE_WIDTH : SINGLE_ROUTE_LINE_WIDTH,
      glowWidth: isRepeated ? REPEATED_ROUTE_GLOW_WIDTH : SINGLE_ROUTE_GLOW_WIDTH,
    } satisfies RouteSegmentStyle;
  });
}
