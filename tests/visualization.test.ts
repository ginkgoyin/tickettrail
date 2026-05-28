import { describe, expect, it } from "vitest";
import {
  buildMapSvgFromSegments,
  buildStubSvg,
  visualizationSizes,
} from "../src/lib/visualization";
import type { MapRoutePayload, MapSegmentPayload, StubPreviewPayload } from "../src/types/ticket";

function buildRoute(): MapRoutePayload {
  return {
    lineLabel: "Shanghai -> Sydney",
    directionHint: "PVG to SYD",
    distanceHintKm: 7800,
    origin: {
      label: "Shanghai Pudong",
      code: "PVG",
      timezone: "Asia/Shanghai",
      latitude: 31.1443,
      longitude: 121.8083,
    },
    destination: {
      label: "Sydney",
      code: "SYD",
      timezone: "Australia/Sydney",
      latitude: -33.9399,
      longitude: 151.1753,
    },
    viewport: {
      minLatitude: -33.9399,
      maxLatitude: 31.1443,
      minLongitude: 121.8083,
      maxLongitude: 151.1753,
    },
  };
}

function buildSegments(): MapSegmentPayload[] {
  return [
    {
      segmentIndex: 0,
      transportType: "flight",
      carrierName: "China Eastern",
      code: "MU561",
      lineLabel: "Shanghai Pudong -> Sydney",
      directionHint: "PVG to SYD",
      distanceHintKm: 7800,
      origin: buildRoute().origin,
      destination: buildRoute().destination,
    },
    {
      segmentIndex: 1,
      transportType: "flight",
      carrierName: "Qantas",
      code: "QF401",
      lineLabel: "Sydney -> Melbourne",
      directionHint: "SYD to MEL",
      distanceHintKm: 713,
      origin: buildRoute().destination,
      destination: {
        label: "Melbourne",
        code: "MEL",
        timezone: "Australia/Melbourne",
        latitude: -37.669,
        longitude: 144.841,
      },
    },
  ];
}

function buildFlightStub(): StubPreviewPayload {
  return {
    title: "Ticket Stub Preview",
    subtitle: "Shanghai -> Sydney",
    transportBadge: "FLIGHT",
    primaryCode: "MU561",
    departureLabel: "Shanghai Pudong",
    departureTimeLocal: "2026-05-21T09:30",
    arrivalLabel: "Sydney",
    arrivalTimeLocal: "2026-05-21T21:30",
    carrierName: "China Eastern",
    seatLabel: "Economy / 24A",
    notes: "Gate 12",
    routeLabel: "Shanghai -> Sydney",
    accent: "#70d4ff",
  };
}

function buildTrainStub(): StubPreviewPayload {
  return {
    title: "Ticket Stub Preview",
    subtitle: "张家界西站 -> 重庆东站",
    transportBadge: "TRAIN",
    primaryCode: "G2434",
    departureLabel: "张家界西站",
    departureTimeLocal: "2025-11-08T14:32",
    arrivalLabel: "重庆东站",
    arrivalTimeLocal: "2025-11-08T19:52",
    carrierName: "China Railway",
    seatLabel: "02车 / 04F号",
    notes: "二等座",
    routeLabel: "张家界西站 -> 重庆东站",
    accent: "#70d4ff",
  };
}

describe("visualization", () => {
  it("builds route svg for multi-segment map payloads", () => {
    const svg = buildMapSvgFromSegments(buildRoute(), buildSegments());

    expect(svg).toContain("<svg");
    expect(svg).toContain("Shanghai -&gt; Sydney");
    expect(svg).toContain("MU561");
    expect(svg).toContain("QF401");
    expect(svg).toContain(`width="${visualizationSizes.map.width}"`);
  });

  it("builds flight stub svg with itinerary segment summary", () => {
    const svg = buildStubSvg(buildFlightStub(), "boarding", buildSegments());

    expect(svg).toContain("BOARDING PASS");
    expect(svg).toContain("ITINERARY SEGMENTS");
    expect(svg).toContain("China Eastern");
    expect(svg).toContain("MU561");
  });

  it("builds train stub svg for railway-style payloads", () => {
    const svg = buildStubSvg(buildTrainStub(), "ledger");

    expect(svg).toContain("报销凭证");
    expect(svg).toContain("张家界西站");
    expect(svg).toContain("重庆东站");
    expect(svg).toContain(`width="${visualizationSizes.stub.width}"`);
  });
});
