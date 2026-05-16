import { useEffect, useRef, useState } from "react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import type { MapRoutePayload } from "../types/ticket";

interface RouteMapProps {
  route: MapRoutePayload;
}

function createMarkerElement(kind: "origin" | "destination", label: string, code?: string) {
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

export function RouteMap({ route }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [loadMessage, setLoadMessage] = useState("正在加载真实地图...");

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

      if (!map.getLayer("route-line-layer")) {
        map.addLayer({
          id: "route-line-layer",
          type: "line",
          source: "route-line",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#1ca4da",
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });
      }
    });

    map.on("error", () => {
      setLoadMessage("地图底图加载失败，但路线数据仍然可导出。");
    });

    mapRef.current = map;

    return () => {
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [route.origin.latitude, route.origin.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncRoute = () => {
      const source = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [route.origin.longitude, route.origin.latitude],
                  [route.destination.longitude, route.destination.latitude],
                ],
              },
              properties: {},
            },
          ],
        });
      }

      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();

      originMarkerRef.current = new maplibregl.Marker({
        element: createMarkerElement("origin", route.origin.label, route.origin.code),
        anchor: "bottom",
      })
        .setLngLat([route.origin.longitude, route.origin.latitude])
        .addTo(map);

      destinationMarkerRef.current = new maplibregl.Marker({
        element: createMarkerElement("destination", route.destination.label, route.destination.code),
        anchor: "bottom",
      })
        .setLngLat([route.destination.longitude, route.destination.latitude])
        .addTo(map);

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
  }, [route]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} />
      {loadMessage ? <p className="detail-loading route-map-message">{loadMessage}</p> : null}
    </div>
  );
}
