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
    <text x="36" y="${MAP_HEIGHT - 30}" fill="#9db4c0" font-size="16" font-family="Segoe UI, Noto Sans, sans-serif">${escapeXml(route.directionHint)} Route ${route.distanceHintKm} km</text>
  </svg>`.trim();
}

function getFlightThemeTokens(theme: StubTheme) {
  if (theme === "ledger") {
    return {
      background: "#efe6cf",
      panel: "#fff8ea",
      primary: "#413123",
      muted: "#7f6b51",
      accentStart: "#cf8f3e",
      accentEnd: "#8d5420",
      ink: "#2d241c",
    };
  }

  if (theme === "night") {
    return {
      background: "#120a1f",
      panel: "#1b1330",
      primary: "#f4edff",
      muted: "#b5aacf",
      accentStart: "#6ee1ff",
      accentEnd: "#9f7aff",
      ink: "#f4edff",
    };
  }

  return {
    background: "#12344a",
    panel: "#0c1e2d",
    primary: "#f8fcff",
    muted: "#c1d5de",
    accentStart: "#70d4ff",
    accentEnd: "#ffb15a",
    ink: "#f8fcff",
  };
}

function getCarrierBrand(carrierName: string) {
  const lowerName = carrierName.toLowerCase();
  const text = carrierName
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  if (lowerName.includes("china eastern") || carrierName.includes("\u4e1c\u65b9")) {
    return { code: "MU", color: "#005baa", accent: "#d61f2c", symbol: "wing" as const };
  }
  if (lowerName.includes("china southern") || carrierName.includes("\u5357\u65b9")) {
    return { code: "CZ", color: "#0072ce", accent: "#cde7ff", symbol: "wing" as const };
  }
  if (lowerName.includes("air china") || carrierName.includes("\u56fd\u822a")) {
    return { code: "CA", color: "#c1121f", accent: "#f9d8db", symbol: "phoenix" as const };
  }
  if (lowerName.includes("hainan") || carrierName.includes("\u6d77\u822a")) {
    return { code: "HU", color: "#c4892d", accent: "#f1dfbc", symbol: "wing" as const };
  }
  if (lowerName.includes("china railway") || carrierName.includes("\u94c1\u8def")) {
    return { code: "CR", color: "#0c8488", accent: "#caeef0", symbol: "rail" as const };
  }

  return { code: text || "TT", color: "#0f78a6", accent: "#d6f3ff", symbol: "wing" as const };
}

function buildCarrierLogo(carrierName: string, x: number, y: number) {
  const brand = getCarrierBrand(carrierName);
  const symbol =
    brand.symbol === "phoenix"
      ? `<path d="M ${x + 10} ${y + 46} C ${x + 28} ${y + 14}, ${x + 62} ${y + 18}, ${x + 78} ${y + 46} C ${x + 60} ${y + 34}, ${x + 44} ${y + 54}, ${x + 28} ${y + 52} C ${x + 35} ${y + 42}, ${x + 48} ${y + 32}, ${x + 54} ${y + 22} C ${x + 38} ${y + 24}, ${x + 24} ${y + 32}, ${x + 10} ${y + 46} Z" fill="${brand.accent}" />`
      : brand.symbol === "rail"
        ? `<path d="M ${x + 10} ${y + 42} L ${x + 30} ${y + 16} L ${x + 58} ${y + 16} L ${x + 78} ${y + 42} L ${x + 10} ${y + 42} Z" fill="${brand.accent}" /><rect x="${x + 22}" y="${y + 20}" width="10" height="10" rx="2" fill="${brand.color}" /><rect x="${x + 56}" y="${y + 20}" width="10" height="10" rx="2" fill="${brand.color}" />`
        : `<path d="M ${x + 12} ${y + 44} C ${x + 28} ${y + 18}, ${x + 50} ${y + 18}, ${x + 74} ${y + 32} C ${x + 56} ${y + 30}, ${x + 36} ${y + 38}, ${x + 12} ${y + 44} Z" fill="${brand.accent}" />`;

  return `
    <g>
      <rect x="${x}" y="${y}" width="92" height="60" rx="18" fill="${brand.color}" />
      ${symbol}
      <text x="${x + 46}" y="${y + 56}" text-anchor="middle" fill="#ffffff" font-size="20" font-weight="700" font-family="Segoe UI, Noto Sans, sans-serif">${brand.code}</text>
    </g>
  `;
}

function createTrainQrPattern() {
  const blocks = [
    [0, 0],
    [1, 0],
    [2, 0],
    [4, 0],
    [6, 0],
    [0, 1],
    [2, 1],
    [3, 1],
    [5, 1],
    [6, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [4, 2],
    [6, 2],
    [3, 3],
    [4, 3],
    [5, 3],
    [0, 4],
    [2, 4],
    [4, 4],
    [6, 4],
    [0, 5],
    [1, 5],
    [3, 5],
    [5, 5],
    [6, 5],
    [0, 6],
    [2, 6],
    [3, 6],
    [4, 6],
    [6, 6],
  ];

  return blocks
    .map(([x, y]) => `<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="#1f2f36" />`)
    .join("");
}

function formatTrainDepartureTime(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year = "2026", month = "01", day = "01"] = datePart.split("-");
  return `${year}\u5e74${month}\u6708${day}\u65e5 ${timePart}\u5f00`;
}

function buildTrainStubSvg(stub: StubPreviewPayload) {
  const coachSeat = stub.seatLabel.split("/").map((part) => part.trim());
  const coachInfo = coachSeat[0] || `02\u8f66`;
  const seatInfo = coachSeat[1] || `04F\u53f7`;
  const serial = `E${stub.primaryCode.replace(/\D/g, "").padEnd(9, "2").slice(0, 9)}`;
  const priceSeed = Array.from(stub.primaryCode).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fare = ((priceSeed % 380) + 88).toFixed(1);
  const bottomSerial = `${stub.primaryCode.replace(/\W/g, "").padEnd(22, "6").slice(0, 22)}`;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${STUB_WIDTH}" height="${STUB_HEIGHT}" viewBox="0 0 ${STUB_WIDTH} ${STUB_HEIGHT}">
    <defs>
      <linearGradient id="trainBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a8d8de" />
        <stop offset="55%" stop-color="#d8f1f2" />
        <stop offset="100%" stop-color="#7dc7d0" />
      </linearGradient>
      <pattern id="dotPattern" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.1" fill="rgba(255,255,255,0.26)" />
      </pattern>
      <filter id="trainSoft">
        <feGaussianBlur stdDeviation="1.8" />
      </filter>
    </defs>
    <rect width="${STUB_WIDTH}" height="${STUB_HEIGHT}" rx="32" fill="url(#trainBg)" />
    <rect width="${STUB_WIDTH}" height="${STUB_HEIGHT}" rx="32" fill="url(#dotPattern)" opacity="0.55" />
    <rect x="20" y="20" width="${STUB_WIDTH - 40}" height="${STUB_HEIGHT - 40}" rx="28" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.62)" />
    <path d="M 120 356 C 198 278, 318 248, 414 248 C 590 248, 724 290, 840 360" fill="none" stroke="rgba(73,138,148,0.18)" stroke-width="26" filter="url(#trainSoft)" />
    <text x="52" y="78" fill="#df2b25" font-size="28" letter-spacing="8" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(serial)}</text>
    <text x="52" y="138" fill="#111111" font-size="54" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.departureLabel)}</text>
    <text x="56" y="172" fill="#222222" font-size="22" font-family="Georgia, serif">${escapeXml(stub.departureLabel)}</text>
    <text x="430" y="136" fill="#111111" font-size="44" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.primaryCode)}</text>
    <line x1="412" y1="150" x2="552" y2="150" stroke="#111111" stroke-width="3" />
    <path d="M 524 136 L 552 150 L 524 164" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    <text x="650" y="138" fill="#111111" font-size="54" font-weight="700" text-anchor="start" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.arrivalLabel)}</text>
    <text x="650" y="172" fill="#222222" font-size="22" font-family="Georgia, serif">${escapeXml(stub.arrivalLabel)}</text>
    <text x="52" y="240" fill="#111111" font-size="32" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(formatTrainDepartureTime(stub.departureTimeLocal))}</text>
    <text x="54" y="294" fill="#111111" font-size="26" font-family="Segoe UI, Noto Sans SC, sans-serif">\u00a5 ${fare}</text>
    <text x="52" y="336" fill="#111111" font-size="18" font-family="Segoe UI, Noto Sans SC, sans-serif">\u9650\u4e58\u5f53\u65e5\u5f53\u6b21\u8f66</text>
    <text x="52" y="366" fill="#111111" font-size="18" font-family="Segoe UI, Noto Sans SC, sans-serif">\u4ec5\u4f9b\u62a5\u9500\u4f7f\u7528</text>
    <text x="650" y="238" fill="#111111" font-size="32" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(coachInfo)} ${escapeXml(seatInfo)}</text>
    <text x="742" y="284" fill="#111111" font-size="30" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.notes || "\u4e8c\u7b49\u5ea7")}</text>
    <circle cx="500" cy="284" r="22" fill="none" stroke="#1f2f36" stroke-width="2.6" />
    <text x="500" y="292" fill="#1f2f36" text-anchor="middle" font-size="20" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">\u7f51</text>
    <g transform="translate(752 316)">
      <rect x="-12" y="-12" width="110" height="110" fill="rgba(255,255,255,0.72)" rx="10" />
      ${createTrainQrPattern()}
    </g>
    <rect x="114" y="396" width="500" height="70" rx="2" fill="none" stroke="#1f2f36" stroke-width="2" stroke-dasharray="10 6" />
    <text x="364" y="430" text-anchor="middle" fill="#1f2f36" font-size="28" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">\u62a5\u9500\u51ed\u8bc1 \u3000\u9057\u5931\u4e0d\u8865</text>
    <text x="364" y="460" text-anchor="middle" fill="#1f2f36" font-size="22" font-family="Segoe UI, Noto Sans SC, sans-serif">\u9000\u7968\u6539\u7b7e\u65f6\u987b\u4ea4\u56de\u8f66\u7ad9</text>
    <text x="52" y="406" fill="#1f2f36" font-size="20" font-family="Consolas, monospace">${escapeXml(stub.primaryCode)} ${escapeXml(stub.carrierName.slice(0, 10))}</text>
    <rect x="0" y="${STUB_HEIGHT - 54}" width="${STUB_WIDTH}" height="54" fill="#62c3cf" />
    <text x="36" y="${STUB_HEIGHT - 18}" fill="#1c3440" font-size="26" font-family="Consolas, monospace">${escapeXml(bottomSerial)}</text>
  </svg>`.trim();
}

function buildFlightStubSvg(stub: StubPreviewPayload, theme: StubTheme) {
  const tokens = getFlightThemeTokens(theme);
  const departureCode = stub.departureLabel.slice(0, 3).toUpperCase();
  const arrivalCode = stub.arrivalLabel.slice(0, 3).toUpperCase();
  const gate = `G${(stub.primaryCode.length % 9) + 1}${String.fromCharCode(65 + (stub.primaryCode.length % 5))}`;
  const boardingTime = stub.departureTimeLocal.replace("T", " ").slice(5);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${STUB_WIDTH}" height="${STUB_HEIGHT}" viewBox="0 0 ${STUB_WIDTH} ${STUB_HEIGHT}">
    <defs>
      <linearGradient id="flightBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${tokens.background}" />
        <stop offset="100%" stop-color="${tokens.panel}" />
      </linearGradient>
      <linearGradient id="flightAccent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${tokens.accentStart}" />
        <stop offset="100%" stop-color="${tokens.accentEnd}" />
      </linearGradient>
    </defs>
    <rect width="${STUB_WIDTH}" height="${STUB_HEIGHT}" rx="34" fill="url(#flightBg)" />
    <rect x="26" y="26" width="${STUB_WIDTH - 52}" height="${STUB_HEIGHT - 52}" rx="28" fill="${tokens.panel}" stroke="rgba(255,255,255,0.10)" />
    <rect x="38" y="38" width="${STUB_WIDTH - 76}" height="12" rx="6" fill="url(#flightAccent)" />
    ${buildCarrierLogo(stub.carrierName, 52, 64)}
    <text x="164" y="104" fill="${tokens.primary}" font-size="22" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.carrierName)}</text>
    <text x="164" y="134" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans SC, sans-serif">BOARDING PASS</text>
    <text x="52" y="212" fill="${tokens.muted}" font-size="16" letter-spacing="3" font-family="Segoe UI, Noto Sans SC, sans-serif">FLIGHT</text>
    <text x="52" y="262" fill="${tokens.primary}" font-size="48" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.primaryCode)}</text>
    <text x="52" y="318" fill="${tokens.muted}" font-size="18" letter-spacing="3" font-family="Segoe UI, Noto Sans SC, sans-serif">DEPART</text>
    <text x="52" y="364" fill="${tokens.primary}" font-size="56" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(departureCode)}</text>
    <text x="52" y="394" fill="${tokens.muted}" font-size="18" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.departureLabel)}</text>
    <text x="336" y="360" fill="${tokens.accentEnd}" font-size="34" font-family="Segoe UI Symbol, Segoe UI, sans-serif">\u2708</text>
    <line x1="278" y1="354" x2="398" y2="354" stroke="${tokens.accentEnd}" stroke-width="4" stroke-linecap="round" />
    <text x="450" y="318" fill="${tokens.muted}" font-size="18" letter-spacing="3" font-family="Segoe UI, Noto Sans SC, sans-serif">ARRIVE</text>
    <text x="450" y="364" fill="${tokens.primary}" font-size="56" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(arrivalCode)}</text>
    <text x="450" y="394" fill="${tokens.muted}" font-size="18" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.arrivalLabel)}</text>
    <rect x="724" y="70" width="182" height="360" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
    <text x="754" y="120" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans SC, sans-serif">SEAT</text>
    <text x="754" y="160" fill="${tokens.primary}" font-size="34" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.seatLabel)}</text>
    <text x="754" y="224" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans SC, sans-serif">GATE</text>
    <text x="754" y="264" fill="${tokens.primary}" font-size="34" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(gate)}</text>
    <text x="754" y="328" fill="${tokens.muted}" font-size="16" letter-spacing="2" font-family="Segoe UI, Noto Sans SC, sans-serif">BOARDING</text>
    <text x="754" y="368" fill="${tokens.primary}" font-size="30" font-weight="700" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(boardingTime)}</text>
    <text x="52" y="456" fill="${tokens.muted}" font-size="15" letter-spacing="3" font-family="Segoe UI, Noto Sans SC, sans-serif">REMARK</text>
    <text x="52" y="488" fill="${tokens.ink}" font-size="20" font-family="Segoe UI, Noto Sans SC, sans-serif">${escapeXml(stub.notes)}</text>
  </svg>`.trim();
}

export function buildStubSvg(stub: StubPreviewPayload, theme: StubTheme = "boarding") {
  const isTrain =
    stub.transportBadge.toLowerCase().includes("train") ||
    stub.carrierName.toLowerCase().includes("rail") ||
    stub.carrierName.includes("\u94c1\u8def");

  return isTrain ? buildTrainStubSvg(stub) : buildFlightStubSvg(stub, theme);
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
