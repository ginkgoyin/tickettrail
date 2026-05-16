import type {
  MapPointPayload,
  MapRoutePayload,
  MapViewportPayload,
  StubPreviewPayload,
} from "../types/ticket";

const MAP_WIDTH = 720;
const MAP_HEIGHT = 320;
const MAP_PADDING = 44;

const STUB_WIDTH = 960;
const STUB_HEIGHT = 520;
export type StubTheme = "boarding" | "ledger" | "night";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function projectPoint(point: MapPointPayload, viewport: MapViewportPayload) {
  const longitudeSpan = Math.max(viewport.maxLongitude - viewport.minLongitude, 1);
  const latitudeSpan = Math.max(viewport.maxLatitude - viewport.minLatitude, 1);

  const x =
    MAP_PADDING +
    ((point.longitude - viewport.minLongitude) / longitudeSpan) * (MAP_WIDTH - MAP_PADDING * 2);
  const y =
    MAP_HEIGHT -
    MAP_PADDING -
    ((point.latitude - viewport.minLatitude) / latitudeSpan) * (MAP_HEIGHT - MAP_PADDING * 2);

  return { x, y };
}

function createGridLines() {
  const lines: string[] = [];

  for (let index = 1; index <= 4; index += 1) {
    const x = MAP_PADDING + ((MAP_WIDTH - MAP_PADDING * 2) / 5) * index;
    const y = MAP_PADDING + ((MAP_HEIGHT - MAP_PADDING * 2) / 5) * index;

    lines.push(
      `<line x1="${x}" y1="${MAP_PADDING}" x2="${x}" y2="${MAP_HEIGHT - MAP_PADDING}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 6" />`,
    );
    lines.push(
      `<line x1="${MAP_PADDING}" y1="${y}" x2="${MAP_WIDTH - MAP_PADDING}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 6" />`,
    );
  }

  return lines.join("");
}

export function buildMapSvg(route: MapRoutePayload) {
  const origin = projectPoint(route.origin, route.viewport);
  const destination = projectPoint(route.destination, route.viewport);
  const controlX = (origin.x + destination.x) / 2;
  const controlY = Math.min(origin.y, destination.y) - 48;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">
    <defs>
      <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#70d4ff" />
        <stop offset="100%" stop-color="#ffb15a" />
      </linearGradient>
      <filter id="routeGlow">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="28" fill="#061824" />
    <rect x="18" y="18" width="${MAP_WIDTH - 36}" height="${MAP_HEIGHT - 36}" rx="22" fill="rgba(15,41,58,0.82)" stroke="rgba(255,255,255,0.08)" />
    ${createGridLines()}
    <path
      d="M ${origin.x} ${origin.y} Q ${controlX} ${controlY} ${destination.x} ${destination.y}"
      fill="none"
      stroke="url(#routeGradient)"
      stroke-width="5"
      stroke-linecap="round"
      filter="url(#routeGlow)"
    />
    <path
      d="M ${destination.x - 18} ${destination.y - 10} L ${destination.x} ${destination.y} L ${destination.x - 18} ${destination.y + 10}"
      fill="none"
      stroke="#ffb15a"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="${origin.x}" cy="${origin.y}" r="10" fill="#70d4ff" stroke="#ffffff" stroke-width="3" />
    <circle cx="${destination.x}" cy="${destination.y}" r="10" fill="#ffb15a" stroke="#ffffff" stroke-width="3" />
    <text x="${origin.x}" y="${origin.y - 18}" fill="#e9f8ff" font-size="15" text-anchor="middle" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(route.origin.code || route.origin.label)}</text>
    <text x="${destination.x}" y="${destination.y - 18}" fill="#fff3e5" font-size="15" text-anchor="middle" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(route.destination.code || route.destination.label)}</text>
    <text x="36" y="42" fill="#70d4ff" font-size="14" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">ROUTE VIEW</text>
    <text x="36" y="68" fill="#f2fbff" font-size="28" font-weight="700" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(route.lineLabel)}</text>
    <text x="36" y="${MAP_HEIGHT - 30}" fill="#9db4c0" font-size="16" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(route.directionHint)} · ${route.distanceHintKm} km</text>
  </svg>`.trim();
}

function getStubThemeTokens(theme: StubTheme) {
  if (theme === "ledger") {
    return {
      background: "#f0e6cf",
      panel: "#fff9ec",
      stroke: "rgba(77, 60, 38, 0.16)",
      primary: "#3e3022",
      muted: "#7f6d57",
      accentStart: "#ca8f3b",
      accentEnd: "#7c4d1f",
    };
  }

  if (theme === "night") {
    return {
      background: "#130b20",
      panel: "#1e1431",
      stroke: "rgba(164, 141, 225, 0.16)",
      primary: "#f5f0ff",
      muted: "#b9afd0",
      accentStart: "#7be0ff",
      accentEnd: "#9e7cff",
    };
  }

  return {
    background: "#12344a",
    panel: "#0b1d2a",
    stroke: "rgba(255,255,255,0.12)",
    primary: "#f8fcff",
    muted: "#c1d5de",
    accentStart: "#70d4ff",
    accentEnd: "#ffb15a",
  };
}

export function buildStubSvg(stub: StubPreviewPayload, theme: StubTheme = "boarding") {
  const tokens = getStubThemeTokens(theme);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${STUB_WIDTH}" height="${STUB_HEIGHT}" viewBox="0 0 ${STUB_WIDTH} ${STUB_HEIGHT}">
    <defs>
      <linearGradient id="stubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${tokens.background}" />
        <stop offset="60%" stop-color="${tokens.panel}" />
        <stop offset="100%" stop-color="#051018" />
      </linearGradient>
      <linearGradient id="stubAccent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme === "boarding" ? escapeXml(stub.accent) : tokens.accentStart}" />
        <stop offset="100%" stop-color="${tokens.accentEnd}" />
      </linearGradient>
    </defs>
    <rect width="${STUB_WIDTH}" height="${STUB_HEIGHT}" rx="36" fill="url(#stubGradient)" />
    <rect x="24" y="24" width="${STUB_WIDTH - 48}" height="${STUB_HEIGHT - 48}" rx="28" fill="${tokens.panel}" stroke="${tokens.stroke}" />
    <rect x="36" y="36" width="${STUB_WIDTH - 72}" height="10" rx="5" fill="url(#stubAccent)" />
    <text x="52" y="92" fill="${tokens.accentStart}" font-size="18" letter-spacing="4" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.transportBadge)}</text>
    <text x="52" y="142" fill="${tokens.primary}" font-size="44" font-weight="700" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.primaryCode)}</text>
    <text x="52" y="178" fill="${tokens.muted}" font-size="22" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.subtitle)}</text>

    <text x="52" y="250" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">DEPARTURE</text>
    <text x="52" y="286" fill="${tokens.primary}" font-size="28" font-weight="700" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.departureLabel)}</text>
    <text x="52" y="320" fill="${tokens.muted}" font-size="20" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.departureTimeLocal.replace("T", " "))}</text>

    <text x="520" y="250" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">ARRIVAL</text>
    <text x="520" y="286" fill="${tokens.primary}" font-size="28" font-weight="700" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.arrivalLabel)}</text>
    <text x="520" y="320" fill="${tokens.muted}" font-size="20" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.arrivalTimeLocal.replace("T", " "))}</text>

    <line x1="472" y1="272" x2="492" y2="272" stroke="${tokens.accentEnd}" stroke-width="4" stroke-linecap="round" />
    <path d="M 492 264 L 512 272 L 492 280" fill="none" stroke="${tokens.accentEnd}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />

    <text x="52" y="396" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">CARRIER</text>
    <text x="52" y="430" fill="${tokens.primary}" font-size="22" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.carrierName)}</text>

    <text x="370" y="396" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">SEAT</text>
    <text x="370" y="430" fill="${tokens.primary}" font-size="22" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.seatLabel)}</text>

    <text x="52" y="474" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans, sans-serif">NOTES</text>
    <text x="52" y="506" fill="${tokens.primary}" font-size="18" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(stub.notes)}</text>
  </svg>`.trim();
}

function downloadBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function exportSvg(filename: string, svgMarkup: string) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(filename, blob);
}

export async function exportPng(
  filename: string,
  svgMarkup: string,
  width: number,
  height: number,
) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to render SVG for PNG export."));
      nextImage.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode PNG export."));
        }
      }, "image/png");
    });

    downloadBlob(filename, pngBlob);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export const visualizationSizes = {
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  stub: {
    width: STUB_WIDTH,
    height: STUB_HEIGHT,
  },
};
