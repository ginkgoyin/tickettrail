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

function createMarkerElement(kind: "origin" | "destination" | "waypoint", label: string, code?: string) {
  const marker = document.createElement("div");
  marker.className = `route-marker route-marker-${kind}`;
  marker.innerHTML = `
    <span class="route-marker-dot"></span>
    <span class="route-marker-card">
      <strong>${code ?? label}</strong>
      <small>${label}</small>
    </span>
  `;
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
  const [loadMessage, setLoadMessage] = useState("正在加载真实地图组件...");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

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

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
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
    });

    map.on("error", () => {
      setLoadMessage("地图加载失败，请稍后重试。");
    });

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [route.origin.latitude, route.origin.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onSegmentSelect) {
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
      map.getCanvas().style.cursor = "pointer";
    };

    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const bindLayerEvents = () => {
      if (!map.getLayer("route-line-layer")) {
        return;
      }

      map.on("click", "route-line-layer", handleClick);
      map.on("mouseenter", "route-line-layer", handleEnter);
      map.on("mouseleave", "route-line-layer", handleLeave);
    };

    const unbindLayerEvents = () => {
      if (!map.getLayer("route-line-layer")) {
        return;
      }

      map.off("click", "route-line-layer", handleClick);
      map.off("mouseenter", "route-line-layer", handleEnter);
      map.off("mouseleave", "route-line-layer", handleLeave);
      map.getCanvas().style.cursor = "";
    };

    if (map.isStyleLoaded()) {
      bindLayerEvents();
    } else {
      map.once("load", bindLayerEvents);
    }

    return () => {
      map.off("load", bindLayerEvents);
      unbindLayerEvents();
    };
  }, [onSegmentSelect, route, segments]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncRoute = () => {
      const activeSegments = buildActiveSegments(route, segments);
      const source = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;

      if (source) {
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
      }

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
            ["==", ["get", "segmentIndex"], 0], "#1ca4da",
            ["==", ["%", ["get", "segmentIndex"], 2], 1], "#ff9854",
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

    if (map.isStyleLoaded()) {
      syncRoute();
      return;
    }

    map.once("load", syncRoute);
    return () => {
      map.off("load", syncRoute);
    };
  }, [onPointSelect, points, route, segments]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} />
      {loadMessage ? <p className="detail-loading route-map-message">{loadMessage}</p> : null}
    </div>
  );
}
