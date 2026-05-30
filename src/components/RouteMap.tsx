import { useEffect, useRef, useState } from "react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import type { MapPointPayload, MapRoutePayload, MapSegmentPayload } from "../types/ticket";

interface RouteMapProps {
  route: MapRoutePayload;
  segments?: MapSegmentPayload[];
  points?: MapPointPayload[];
  onSegmentSelect?: (segment: MapSegmentPayload) => void;
  onPointSelect?: (point: MapPointPayload) => void;
  variant?: "summary" | "detail";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasUsableMapPoint(point: MapPointPayload | null | undefined): point is MapPointPayload {
  return Boolean(
    point &&
      typeof point.label === "string" &&
      point.label.trim().length > 0 &&
      typeof point.timezone === "string" &&
      point.timezone.trim().length > 0 &&
      isFiniteNumber(point.latitude) &&
      isFiniteNumber(point.longitude),
  );
}

function hasUsableRoute(route: MapRoutePayload | null | undefined) {
  return Boolean(
    hasUsableMapPoint(route?.origin) &&
      hasUsableMapPoint(route?.destination) &&
      route?.viewport &&
      isFiniteNumber(route.viewport.minLongitude) &&
      isFiniteNumber(route.viewport.maxLongitude) &&
      isFiniteNumber(route.viewport.minLatitude) &&
      isFiniteNumber(route.viewport.maxLatitude),
  );
}

function buildActiveSegments(route: MapRoutePayload, segments: MapSegmentPayload[]) {
  if (segments.length) {
    return segments;
  }

  return [
    {
      segmentIndex: 0,
      transportType: "flight",
      carrierName: route.lineLabel,
      code: route.origin.code || route.destination.code || "",
      lineLabel: route.lineLabel,
      directionHint: route.directionHint,
      distanceHintKm: route.distanceHintKm,
      origin: route.origin,
      destination: route.destination,
    },
  ] satisfies MapSegmentPayload[];
}

interface EndpointRecord {
  key: string;
  point: MapPointPayload;
  kind: "origin" | "destination" | "waypoint";
}

function buildEndpointRecords(
  route: MapRoutePayload,
  segments: MapSegmentPayload[],
  points: MapPointPayload[],
) {
  const activeSegments = buildActiveSegments(route, segments);
  const endpointMap = new Map<string, EndpointRecord>();
  const pointLookup = new Map<string, MapPointPayload>();

  points.forEach((point) => {
    pointLookup.set(`${point.longitude}:${point.latitude}`, point);
  });

  const registerPoint = (
    point: MapPointPayload,
    kind: "origin" | "destination" | "waypoint",
  ) => {
    const key = `${point.longitude}:${point.latitude}`;
    const enrichedPoint = pointLookup.get(key) ?? point;
    const existing = endpointMap.get(key);

    if (!existing) {
      endpointMap.set(key, { key, point: enrichedPoint, kind });
      return;
    }

    if (existing.kind === "waypoint" && kind !== "waypoint") {
      endpointMap.set(key, { key, point: enrichedPoint, kind });
    }
  };

  activeSegments.forEach((segment, index) => {
    registerPoint(segment.origin, index === 0 ? "origin" : "waypoint");
    registerPoint(
      segment.destination,
      index === activeSegments.length - 1 ? "destination" : "waypoint",
    );
  });

  return Array.from(endpointMap.values());
}

export function RouteMap({
  route,
  segments = [],
  points = [],
  onSegmentSelect,
  onPointSelect,
  variant = "detail",
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const disposedRef = useRef(false);
  const endpointLookupRef = useRef(new Map<string, MapPointPayload>());
  const originLatitude = hasUsableMapPoint(route?.origin) ? route.origin.latitude : 0;
  const originLongitude = hasUsableMapPoint(route?.origin) ? route.origin.longitude : 0;
  const hasRenderableRoute =
    hasUsableRoute(route) &&
    buildActiveSegments(route, segments).every(
      (segment) => hasUsableMapPoint(segment.origin) && hasUsableMapPoint(segment.destination),
    ) &&
    (!points.length || points.every(hasUsableMapPoint));
  const showLabels = variant === "detail";
  const [loadMessage, setLoadMessage] = useState("Loading route map...");

  const getActiveMap = () => {
    if (disposedRef.current) {
      return null;
    }

    return mapRef.current;
  };

  useEffect(() => {
    if (!hasRenderableRoute) {
      setLoadMessage("Route map unavailable for this ticket.");
      return;
    }

    if (!containerRef.current || mapRef.current) {
      return;
    }

    disposedRef.current = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [route.origin.longitude, route.origin.latitude],
      zoom: 2.2,
      attributionControl: {
        compact: true,
      },
    });

    const handleLoad = () => {
      if (disposedRef.current || mapRef.current !== map) {
        return;
      }

      setLoadMessage("");

      if (!map.getSource("route-line")) {
        map.addSource("route-line", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
      }

      if (!map.getSource("route-endpoints")) {
        map.addSource("route-endpoints", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
      }
    };

    const handleError = () => {
      if (disposedRef.current || mapRef.current !== map) {
        return;
      }

      setLoadMessage("Route map unavailable for this ticket.");
    };

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("load", handleLoad);
    map.on("error", handleError);
    mapRef.current = map;

    return () => {
      disposedRef.current = true;
      endpointLookupRef.current.clear();
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [hasRenderableRoute, originLatitude, originLongitude, route]);

  useEffect(() => {
    if (!hasRenderableRoute) {
      return;
    }

    const handleSegmentClick = (event: maplibregl.MapLayerMouseEvent) => {
      if (!onSegmentSelect) {
        return;
      }

      const segmentIndex = Number(event.features?.[0]?.properties?.segmentIndex);
      const activeSegment = buildActiveSegments(route, segments).find(
        (segment) => segment.segmentIndex === segmentIndex,
      );

      if (activeSegment) {
        onSegmentSelect(activeSegment);
      }
    };

    const handlePointClick = (event: maplibregl.MapLayerMouseEvent) => {
      if (!onPointSelect) {
        return;
      }

      const pointKey = String(event.features?.[0]?.properties?.pointKey || "");
      const point = endpointLookupRef.current.get(pointKey);
      if (point) {
        onPointSelect(point);
      }
    };

    const handleEnter = () => {
      const map = getActiveMap();
      if (!map) {
        return;
      }

      map.getCanvas().style.cursor = "pointer";
    };

    const handleLeave = () => {
      const map = getActiveMap();
      if (!map) {
        return;
      }

      map.getCanvas().style.cursor = "";
    };

    const bindLayerEvents = () => {
      const map = getActiveMap();
      if (!map || !map.getLayer("route-line-layer")) {
        return;
      }

      if (onSegmentSelect) {
        map.on("click", "route-line-layer", handleSegmentClick);
      }
      map.on("mouseenter", "route-line-layer", handleEnter);
      map.on("mouseleave", "route-line-layer", handleLeave);

      if (onPointSelect && map.getLayer("route-endpoint-circle-layer")) {
        map.on("click", "route-endpoint-circle-layer", handlePointClick);
        map.on("mouseenter", "route-endpoint-circle-layer", handleEnter);
        map.on("mouseleave", "route-endpoint-circle-layer", handleLeave);
      }

      if (onPointSelect && map.getLayer("route-endpoint-label-layer")) {
        map.on("click", "route-endpoint-label-layer", handlePointClick);
        map.on("mouseenter", "route-endpoint-label-layer", handleEnter);
        map.on("mouseleave", "route-endpoint-label-layer", handleLeave);
      }
    };

    const unbindLayerEvents = () => {
      const map = getActiveMap();
      if (!map || !map.getLayer("route-line-layer")) {
        return;
      }

      if (onSegmentSelect) {
        map.off("click", "route-line-layer", handleSegmentClick);
      }
      map.off("mouseenter", "route-line-layer", handleEnter);
      map.off("mouseleave", "route-line-layer", handleLeave);

      if (map.getLayer("route-endpoint-circle-layer")) {
        map.off("click", "route-endpoint-circle-layer", handlePointClick);
        map.off("mouseenter", "route-endpoint-circle-layer", handleEnter);
        map.off("mouseleave", "route-endpoint-circle-layer", handleLeave);
      }

      if (map.getLayer("route-endpoint-label-layer")) {
        map.off("click", "route-endpoint-label-layer", handlePointClick);
        map.off("mouseenter", "route-endpoint-label-layer", handleEnter);
        map.off("mouseleave", "route-endpoint-label-layer", handleLeave);
      }
      map.getCanvas().style.cursor = "";
    };

    const map = getActiveMap();
    if (!map) {
      return;
    }

    if (map.isStyleLoaded()) {
      bindLayerEvents();
    } else {
      map.once("load", bindLayerEvents);
    }

    return () => {
      const activeMap = getActiveMap();
      activeMap?.off("load", bindLayerEvents);
      unbindLayerEvents();
    };
  }, [hasRenderableRoute, onPointSelect, onSegmentSelect, route, segments]);

  useEffect(() => {
    if (!hasRenderableRoute) {
      return;
    }

    const syncRoute = () => {
      const map = getActiveMap();
      if (!map) {
        setLoadMessage("Route map unavailable for this ticket.");
        return;
      }

      const activeSegments = buildActiveSegments(route, segments);
      const lineSource = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
      const endpointSource = map.getSource("route-endpoints") as maplibregl.GeoJSONSource | undefined;
      if (!lineSource || !endpointSource) {
        return;
      }

      lineSource.setData({
        type: "FeatureCollection",
        features: activeSegments.map((segment) => ({
          type: "Feature",
          properties: {
            segmentIndex: segment.segmentIndex,
            ticketId: segment.ticketId || "",
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [segment.origin.longitude, segment.origin.latitude],
              [segment.destination.longitude, segment.destination.latitude],
            ],
          },
        })),
      });
      const endpointRecords = buildEndpointRecords(route, activeSegments, points);
      endpointLookupRef.current = new Map(
        endpointRecords.map((record) => [record.key, record.point]),
      );
      endpointSource.setData({
        type: "FeatureCollection",
        features: endpointRecords.map((record) => ({
          type: "Feature",
          properties: {
            pointKey: record.key,
            kind: record.kind,
            code: record.point.code || record.point.label,
            label: record.point.label,
          },
          geometry: {
            type: "Point",
            coordinates: [record.point.longitude, record.point.latitude],
          },
        })),
      });

      if (map.getLayer("route-line-layer")) {
        map.removeLayer("route-line-layer");
      }
      if (map.getLayer("route-line-glow-layer")) {
        map.removeLayer("route-line-glow-layer");
      }
      if (map.getLayer("route-endpoint-label-layer")) {
        map.removeLayer("route-endpoint-label-layer");
      }
      if (map.getLayer("route-endpoint-circle-layer")) {
        map.removeLayer("route-endpoint-circle-layer");
      }

      map.addLayer({
        id: "route-line-glow-layer",
        type: "line",
        source: "route-line",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "rgba(112, 212, 255, 0.28)",
          "line-width": 10,
          "line-opacity": 0.4,
        },
      });

      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "segmentIndex"], 0],
            "#1ca4da",
            ["==", ["%", ["get", "segmentIndex"], 2], 1],
            "#ff9854",
            "#76df95",
          ],
          "line-width": 4,
          "line-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "route-endpoint-circle-layer",
        type: "circle",
        source: "route-endpoints",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "kind"],
            "origin",
            "#1ca4da",
            "destination",
            "#ff9854",
            "#76df95",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      if (showLabels) {
        map.addLayer({
          id: "route-endpoint-label-layer",
          type: "symbol",
          source: "route-endpoints",
          layout: {
            "text-field": ["get", "code"],
            "text-font": ["Noto Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 12,
            "text-offset": [0, -1.8],
            "text-anchor": "bottom",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": [
              "match",
              ["get", "kind"],
              "origin",
              "#e9f8ff",
              "destination",
              "#fff3e5",
              "#e6fff0",
            ],
            "text-halo-color": "rgba(6, 24, 36, 0.94)",
            "text-halo-width": 1.4,
          },
        });
      }

      const bounds = new LngLatBounds(
        [route.viewport.minLongitude, route.viewport.minLatitude],
        [route.viewport.maxLongitude, route.viewport.maxLatitude],
      );

      map.fitBounds(bounds, {
        padding: 80,
        duration: 800,
      });
    };

    const map = getActiveMap();
    if (!map) {
      setLoadMessage("Route map unavailable for this ticket.");
      return;
    }

    if (map.isStyleLoaded()) {
      syncRoute();
      return;
    }

    map.once("load", syncRoute);
    return () => {
      const activeMap = getActiveMap();
      activeMap?.off("load", syncRoute);
    };
  }, [hasRenderableRoute, onPointSelect, points, route, segments, showLabels]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} />
      {loadMessage ? <p className="detail-loading route-map-message">{loadMessage}</p> : null}
    </div>
  );
}
