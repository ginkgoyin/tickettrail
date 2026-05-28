import { useEffect, useRef, useState } from "react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import type { MapPointPayload, MapRoutePayload, MapSegmentPayload } from "../types/ticket";

interface RouteMapProps {
  route: MapRoutePayload;
  segments?: MapSegmentPayload[];
  points?: MapPointPayload[];
  onSegmentSelect?: (segment: MapSegmentPayload) => void;
  onPointSelect?: (point: MapPointPayload) => void;
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

function createMarkerElement(kind: "origin" | "destination" | "waypoint", label: string, code?: string) {
  const marker = document.createElement("div");
  marker.className = `route-marker route-marker-${kind}`;

  const dot = document.createElement("span");
  dot.className = "route-marker-dot";

  const card = document.createElement("span");
  card.className = "route-marker-card";

  const title = document.createElement("strong");
  title.textContent = code ?? label;

  const subtitle = document.createElement("small");
  subtitle.textContent = label;

  card.append(title, subtitle);
  marker.append(dot, card);
  return marker;
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

export function RouteMap({
  route,
  segments = [],
  points = [],
  onSegmentSelect,
  onPointSelect,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const disposedRef = useRef(false);
  const originLatitude = hasUsableMapPoint(route?.origin) ? route.origin.latitude : 0;
  const originLongitude = hasUsableMapPoint(route?.origin) ? route.origin.longitude : 0;
  const hasRenderableRoute =
    hasUsableRoute(route) &&
    buildActiveSegments(route, segments).every(
      (segment) => hasUsableMapPoint(segment.origin) && hasUsableMapPoint(segment.destination),
    ) &&
    (!points.length || points.every(hasUsableMapPoint));
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
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [hasRenderableRoute, originLatitude, originLongitude, route]);

  useEffect(() => {
    if (!onSegmentSelect || !hasRenderableRoute) {
      return;
    }

    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const segmentIndex = Number(event.features?.[0]?.properties?.segmentIndex);
      const activeSegment = buildActiveSegments(route, segments).find(
        (segment) => segment.segmentIndex === segmentIndex,
      );

      if (activeSegment) {
        onSegmentSelect(activeSegment);
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

      map.on("click", "route-line-layer", handleClick);
      map.on("mouseenter", "route-line-layer", handleEnter);
      map.on("mouseleave", "route-line-layer", handleLeave);
    };

    const unbindLayerEvents = () => {
      const map = getActiveMap();
      if (!map || !map.getLayer("route-line-layer")) {
        return;
      }

      map.off("click", "route-line-layer", handleClick);
      map.off("mouseenter", "route-line-layer", handleEnter);
      map.off("mouseleave", "route-line-layer", handleLeave);
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
  }, [hasRenderableRoute, onSegmentSelect, route, segments]);

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
      const source = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        return;
      }

      source.setData({
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

      if (map.getLayer("route-line-layer")) {
        map.removeLayer("route-line-layer");
      }
      if (map.getLayer("route-line-glow-layer")) {
        map.removeLayer("route-line-glow-layer");
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

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      const markerPoints = points.length
        ? points.map((point, index) => ({
            kind:
              index === 0
                ? ("origin" as const)
                : index === points.length - 1
                  ? ("destination" as const)
                  : ("waypoint" as const),
            point,
          }))
        : [
            { kind: "origin" as const, point: route.origin },
            { kind: "destination" as const, point: route.destination },
          ];

      markerRefs.current = markerPoints.map(({ kind, point }) => {
        const element = createMarkerElement(kind, point.label, point.code);

        if (onPointSelect) {
          element.style.cursor = "pointer";
          element.addEventListener("click", () => onPointSelect(point));
        }

        return new maplibregl.Marker({
          element,
          anchor: "bottom",
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);
      });

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
  }, [hasRenderableRoute, onPointSelect, points, route, segments]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} />
      {loadMessage ? <p className="detail-loading route-map-message">{loadMessage}</p> : null}
    </div>
  );
}
