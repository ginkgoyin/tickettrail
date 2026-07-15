import { describe, expect, it } from "vitest";
import { buildRouteOccurrenceKey, deriveRouteSegmentStyles } from "../src/lib/routeMapStyling";
import type { MapPointPayload, MapSegmentPayload } from "../src/types/ticket";

function buildPoint(label: string, code: string, latitude: number, longitude: number): MapPointPayload {
  return {
    label,
    code,
    timezone: "Asia/Shanghai",
    latitude,
    longitude,
  };
}

function buildSegment(
  segmentIndex: number,
  transportType: string,
  origin: MapPointPayload,
  destination: MapPointPayload,
): MapSegmentPayload {
  return {
    segmentIndex,
    transportType: transportType as MapSegmentPayload["transportType"],
    carrierName: transportType === "train" ? "China Railway" : "China Eastern",
    code: `${transportType === "train" ? "G" : "MU"}${segmentIndex + 1}`,
    lineLabel: `${origin.label} -> ${destination.label}`,
    directionHint: `${origin.code || origin.label} to ${destination.code || destination.label}`,
    origin,
    destination,
  };
}

describe("routeMapStyling", () => {
  it("applies flight palette and thin width for a one-off route", () => {
    const shanghai = buildPoint("Shanghai", "SHA", 31.2304, 121.4737);
    const sydney = buildPoint("Sydney", "SYD", -33.8688, 151.2093);

    const [style] = deriveRouteSegmentStyles([
      buildSegment(0, "flight", shanghai, sydney),
    ]);

    expect(style.transportKind).toBe("flight");
    expect(style.lineColor).toBe("#52c8ff");
    expect(style.lineWidth).toBe(2.25);
    expect(style.glowWidth).toBe(5.5);
    expect(style.routeCount).toBe(1);
  });

  it("applies rail palette for train routes", () => {
    const beijing = buildPoint("Beijing South", "VNP", 39.8652, 116.3786);
    const tianjin = buildPoint("Tianjin West", "TXP", 39.1382, 117.1646);

    const [style] = deriveRouteSegmentStyles([
      buildSegment(0, "train", beijing, tianjin),
    ]);

    expect(style.transportKind).toBe("train");
    expect(style.lineColor).toBe("#ffb56b");
    expect(style.lineWidth).toBe(2.25);
  });

  it("uses a neutral fallback palette for unknown transport values", () => {
    const xian = buildPoint("Xian", "XIY", 34.3416, 108.9398);
    const lanzhou = buildPoint("Lanzhou", "LHW", 36.0611, 103.8343);

    const [style] = deriveRouteSegmentStyles([
      buildSegment(0, "unknown", xian, lanzhou),
    ]);

    expect(style.transportKind).toBe("unknown");
    expect(style.lineColor).toBe("#9db4c0");
    expect(style.lineWidth).toBe(2.25);
  });

  it("treats reverse-direction duplicates as the same repeated route", () => {
    const changsha = buildPoint("Changsha", "CSX", 28.2282, 112.9388);
    const beijing = buildPoint("Beijing", "PEK", 40.0799, 116.6031);

    const styles = deriveRouteSegmentStyles([
      buildSegment(0, "flight", changsha, beijing),
      buildSegment(1, "flight", beijing, changsha),
    ]);

    expect(styles[0]?.routeKey).toBe(styles[1]?.routeKey);
    expect(styles[0]?.routeCount).toBe(2);
    expect(styles[1]?.routeCount).toBe(2);
    expect(styles[0]?.lineWidth).toBe(3.4);
    expect(styles[1]?.lineWidth).toBe(3.4);
  });

  it("keeps repeated width binary even when the route appears more than twice", () => {
    const shanghai = buildPoint("Shanghai", "SHA", 31.2304, 121.4737);
    const hangzhou = buildPoint("Hangzhou", "HGH", 30.2741, 120.1551);

    const styles = deriveRouteSegmentStyles([
      buildSegment(0, "flight", shanghai, hangzhou),
      buildSegment(1, "flight", shanghai, hangzhou),
      buildSegment(2, "flight", hangzhou, shanghai),
    ]);

    expect(styles.every((style) => style.routeCount === 3)).toBe(true);
    expect(styles.every((style) => style.lineWidth === 3.4)).toBe(true);
    expect(styles.every((style) => style.glowWidth === 7)).toBe(true);
  });

  it("builds an order-insensitive route key from endpoints", () => {
    const left = buildPoint("Harbin", "HRB", 45.8038, 126.535);
    const right = buildPoint("Tianjin", "TSN", 39.3434, 117.3616);

    expect(buildRouteOccurrenceKey(left, right)).toBe(buildRouteOccurrenceKey(right, left));
  });
});
