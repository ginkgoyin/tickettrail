import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import airlineSeedData from "../data/airlines.seed.json";
import locationSeedData from "../data/locations.seed.json";
import type {
  AirlineDirectoryEntry,
  BackupReadiness,
  BackupRecord,
  MapPointPayload,
  MapSegmentPayload,
  MapViewportPayload,
  LocationDirectoryEntry,
  TicketAttachment,
  TicketAttachmentUpload,
  TicketDetailPayload,
  TicketDraft,
  TicketRecord,
  TicketSegmentDraft,
  TicketLocation,
  TicketStatus,
  TicketType,
} from "../types/ticket";

const STORAGE_KEY = "tickettrail.web-fallback.tickets";
const ATTACHMENT_STORAGE_KEY = "tickettrail.web-fallback.attachments";
const BACKUP_STORAGE_KEY = "tickettrail.web-fallback.backups";
const AIRLINE_SEED = airlineSeedData as AirlineDirectoryEntry[];
const LEGACY_LOCATION_SEED = locationSeedData as LocationDirectoryEntry[];

const LEGACY_STATION_LOCATION_SEED = LEGACY_LOCATION_SEED.filter(
  (entry) => entry.locationType === "station",
);
let locationSeedPromise: Promise<LocationDirectoryEntry[]> | null = null;
let locationLookupPromise: Promise<{
  all: LocationDirectoryEntry[];
  byAirportCode: Map<string, LocationDirectoryEntry>;
  byAirportTerm: Map<string, LocationDirectoryEntry>;
}> | null = null;

async function loadLocationSeed(): Promise<LocationDirectoryEntry[]> {
  if (!locationSeedPromise) {
    locationSeedPromise = Promise.all([
      import("../data/airports.generated.json"),
      import("../data/airport-aliases.zh-CN"),
      import("../data/rail-stations.generated.json"),
    ]).then(([airportModule, aliasModule, railModule]) => {
      const airportAliasesZhCN = aliasModule.default;
      const airports = (airportModule.default as LocationDirectoryEntry[]).map((entry) => {
        const overlay = entry.code ? airportAliasesZhCN[entry.code] : undefined;

        if (!overlay) {
          return entry;
        }

        return {
          ...entry,
          nameZh: overlay.nameZh ?? entry.nameZh,
          timezone: overlay.timezone ?? entry.timezone,
          aliases: Array.from(new Set([...entry.aliases, ...overlay.aliases])),
        };
      });

      const generatedRailStations = railModule.default as LocationDirectoryEntry[];
      const stations = mergeStationLocationSeed(generatedRailStations, LEGACY_STATION_LOCATION_SEED);

      return [...airports, ...stations];
    });
  }

  return locationSeedPromise;
}

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeStationNameKey(value: string | null | undefined) {
  return normalizeLookupValue(value).replace(/站$/u, "");
}

function buildStationMergeKey(entry: Pick<LocationDirectoryEntry, "code" | "nameZh" | "nameEn">) {
  const normalizedCode = normalizeLookupValue(entry.code);
  const normalizedNameZh = normalizeStationNameKey(entry.nameZh);
  const normalizedNameEn = normalizeLookupValue(entry.nameEn);

  return [
    normalizedCode ? `code:${normalizedCode}` : "",
    normalizedNameZh ? `name:${normalizedNameZh}` : "",
    normalizedNameEn ? `pinyin:${normalizedNameEn}` : "",
  ].filter(Boolean);
}

function mergeStationLocationSeed(
  generatedStations: LocationDirectoryEntry[],
  legacyStations: LocationDirectoryEntry[],
) {
  const legacyByKey = new Map<string, LocationDirectoryEntry>();

  for (const station of legacyStations) {
    for (const key of buildStationMergeKey(station)) {
      if (!legacyByKey.has(key)) {
        legacyByKey.set(key, station);
      }
    }
  }

  const consumedLegacyIds = new Set<string>();
  const mergedStations = generatedStations.map((station) => {
    const matchedLegacy = buildStationMergeKey(station)
      .map((key) => legacyByKey.get(key))
      .find(Boolean);

    if (matchedLegacy) {
      consumedLegacyIds.add(matchedLegacy.id);
    }

    return {
      ...matchedLegacy,
      ...station,
      locationType: "station",
      nameEn: station.nameEn || matchedLegacy?.nameEn,
      aliases: Array.from(
        new Set([
          ...(station.aliases ?? []),
          ...(matchedLegacy?.aliases ?? []),
          matchedLegacy?.code ?? "",
        ].filter(Boolean)),
      ),
      latitude: station.latitude ?? matchedLegacy?.latitude,
      longitude: station.longitude ?? matchedLegacy?.longitude,
      timezone: station.timezone ?? matchedLegacy?.timezone,
      countryCode: station.countryCode ?? matchedLegacy?.countryCode ?? "CN",
      pinyin: station.pinyin ?? matchedLegacy?.pinyin,
      shortPinyin: station.shortPinyin ?? matchedLegacy?.shortPinyin,
      stationIndex: station.stationIndex ?? matchedLegacy?.stationIndex,
    } satisfies LocationDirectoryEntry;
  });

  const untouchedLegacyStations = legacyStations.filter((station) => !consumedLegacyIds.has(station.id));
  const dedupedStations = new Map<string, LocationDirectoryEntry>();

  for (const station of [...mergedStations, ...untouchedLegacyStations]) {
    const [primaryKey] = buildStationMergeKey(station);
    const fallbackKey = `name:${normalizeStationNameKey(station.nameZh || station.nameEn)}`;
    const dedupeKey = primaryKey || fallbackKey;
    if (!dedupedStations.has(dedupeKey)) {
      dedupedStations.set(dedupeKey, station);
    }
  }

  return Array.from(dedupedStations.values());
}

async function loadLocationLookup() {
  if (!locationLookupPromise) {
    locationLookupPromise = loadLocationSeed().then((locations) => {
      const byAirportCode = new Map<string, LocationDirectoryEntry>();
      const byAirportTerm = new Map<string, LocationDirectoryEntry>();

      for (const entry of locations) {
        if (entry.locationType !== "airport") {
          continue;
        }

        const normalizedCode = normalizeLookupValue(entry.code);
        if (normalizedCode && !byAirportCode.has(normalizedCode)) {
          byAirportCode.set(normalizedCode, entry);
        }

        const terms = [
          entry.code,
          entry.nameEn,
          entry.nameZh,
          ...entry.aliases,
        ];

        for (const term of terms) {
          const normalizedTerm = normalizeLookupValue(term);
          if (normalizedTerm && !byAirportTerm.has(normalizedTerm)) {
            byAirportTerm.set(normalizedTerm, entry);
          }
        }
      }

      return {
        all: locations,
        byAirportCode,
        byAirportTerm,
      };
    });
  }

  return locationLookupPromise;
}

function hasFiniteCoordinates(location: Pick<LocationDirectoryEntry, "latitude" | "longitude"> | null | undefined) {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location?.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

function hasUsableMapPoint(point: MapPointPayload | null | undefined): point is MapPointPayload {
  return Boolean(
    point &&
      typeof point.label === "string" &&
      point.label.trim().length > 0 &&
      typeof point.timezone === "string" &&
      point.timezone.trim().length > 0 &&
      typeof point.latitude === "number" &&
      Number.isFinite(point.latitude) &&
      typeof point.longitude === "number" &&
      Number.isFinite(point.longitude),
  );
}

function hasUsableMapSegment(segment: MapSegmentPayload | null | undefined): segment is MapSegmentPayload {
  return Boolean(
    segment &&
      hasUsableMapPoint(segment.origin) &&
      hasUsableMapPoint(segment.destination),
  );
}

function hasUsableDetailMap(detail: TicketDetailPayload | null | undefined) {
  return Boolean(
    detail?.map &&
      hasUsableMapPoint(detail.map.origin) &&
      hasUsableMapPoint(detail.map.destination) &&
      detail.map.viewport &&
      typeof detail.map.viewport.minLatitude === "number" &&
      typeof detail.map.viewport.maxLatitude === "number" &&
      typeof detail.map.viewport.minLongitude === "number" &&
      typeof detail.map.viewport.maxLongitude === "number",
  );
}

function calculateDistanceKm(origin: MapPointPayload, destination: MapPointPayload) {
  const earthRadiusKm = 6371;
  const latitudeDelta = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const longitudeDelta = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const originLatitudeRadians = (origin.latitude * Math.PI) / 180;
  const destinationLatitudeRadians = (destination.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitudeRadians) *
      Math.cos(destinationLatitudeRadians) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function buildViewport(points: MapPointPayload[]): MapViewportPayload {
  return {
    minLatitude: Math.min(...points.map((point) => point.latitude)),
    maxLatitude: Math.max(...points.map((point) => point.latitude)),
    minLongitude: Math.min(...points.map((point) => point.longitude)),
    maxLongitude: Math.max(...points.map((point) => point.longitude)),
  };
}

async function resolveAirportLocation(location: TicketLocation) {
  const lookup = await loadLocationLookup();
  const normalizedCode = normalizeLookupValue(location.code);
  if (normalizedCode) {
    const byCode = lookup.byAirportCode.get(normalizedCode);
    if (byCode && hasFiniteCoordinates(byCode)) {
      return byCode;
    }
  }

  const candidateTerms = [location.name, location.code];
  for (const term of candidateTerms) {
    const normalizedTerm = normalizeLookupValue(term);
    if (!normalizedTerm) {
      continue;
    }

    const directMatch = lookup.byAirportTerm.get(normalizedTerm);
    if (directMatch && hasFiniteCoordinates(directMatch)) {
      return directMatch;
    }

    const fallbackMatch = lookup.all.find(
      (entry) =>
        entry.locationType === "airport" &&
        hasFiniteCoordinates(entry) &&
        [
          entry.code,
          entry.nameEn,
          entry.nameZh,
          ...entry.aliases,
        ].some((candidate) => normalizeLookupValue(candidate) === normalizedTerm),
    );

    if (fallbackMatch) {
      return fallbackMatch;
    }
  }

  return null;
}

async function resolveMapPoint(ticketType: TicketType, location: TicketLocation) {
  if (ticketType !== "flight") {
    return null;
  }

  const resolved = await resolveAirportLocation(location);
  if (!resolved) {
    return null;
  }

  const label = resolved.nameZh || resolved.nameEn || location.name;
  const timezone = location.timezone || resolved.timezone || "";

  if (!timezone || !hasFiniteCoordinates(resolved)) {
    return null;
  }

  return {
    label,
    code: resolved.code || location.code,
    timezone,
    latitude: resolved.latitude!,
    longitude: resolved.longitude!,
  } satisfies MapPointPayload;
}

async function buildResolvedDetailFromAirportData(
  ticket: TicketRecord,
  detail: TicketDetailPayload,
): Promise<TicketDetailPayload | null> {
  if (ticket.ticketType !== "flight") {
    return null;
  }

  const effectiveSegments = getEffectiveSegments(ticket);
  const resolvedSegments = await Promise.all<MapSegmentPayload | null>(
    effectiveSegments.map(async (segment, index): Promise<MapSegmentPayload | null> => {
      const origin = await resolveMapPoint(ticket.ticketType, segment.departure);
      const destination = await resolveMapPoint(ticket.ticketType, segment.arrival);

      if (!origin || !destination) {
        return null;
      }

      return {
        segmentIndex: index,
        ticketId: ticket.id,
        transportType: ticket.ticketType,
        carrierName: segment.carrierName,
        code: segment.code,
        lineLabel: `${segment.departure.name} -> ${segment.arrival.name}`,
        directionHint: `${segment.departure.code || segment.departure.name} to ${segment.arrival.code || segment.arrival.name}`,
        distanceHintKm: calculateDistanceKm(origin, destination),
        origin,
        destination,
      };
    }),
  );

  const usableSegments = resolvedSegments.filter(
    (segment): segment is MapSegmentPayload => segment !== null,
  );
  if (!usableSegments.length) {
    return null;
  }

  const firstSegment = usableSegments[0];
  const lastSegment = usableSegments[usableSegments.length - 1];
  const allPoints = usableSegments.flatMap((segment) => [segment.origin, segment.destination]);
  const primaryRoute = {
    lineLabel: ticket.routeLabel,
    directionHint: `${ticket.departure.code || ticket.departure.name} to ${ticket.arrival.code || ticket.arrival.name}`,
    distanceHintKm: usableSegments.reduce((sum, segment) => sum + segment.distanceHintKm, 0),
    origin: firstSegment.origin,
    destination: lastSegment.destination,
    viewport: buildViewport(allPoints),
  };

  return {
    ...detail,
    map: primaryRoute,
    segments: usableSegments,
  };
}

async function finalizeTicketDetail(detail: TicketDetailPayload) {
  const resolvedDetail = await buildResolvedDetailFromAirportData(detail.ticket, detail);

  if (resolvedDetail) {
    return resolvedDetail;
  }

  if (detail.ticket.ticketType === "flight" && !hasUsableDetailMap(detail)) {
    return {
      ...detail,
      segments: detail.segments.filter(hasUsableMapSegment),
    };
  }

  return detail;
}

function buildRouteLabel(ticket: TicketDraft) {
  const segments = getEffectiveSegments(ticket);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  return `${firstSegment.departure.name} -> ${lastSegment.arrival.name}`;
}

function getEffectiveSegments(ticket: TicketDraft): TicketSegmentDraft[] {
  const primarySegment: TicketSegmentDraft = {
    carrierName: ticket.carrierName,
    code: ticket.code,
    departure: { ...ticket.departure },
    arrival: { ...ticket.arrival },
    departureTimeLocal: ticket.departureTimeLocal,
    arrivalTimeLocal: ticket.arrivalTimeLocal,
    classInfo: ticket.classInfo,
    seatInfo: ticket.seatInfo,
    notes: ticket.notes,
  };

  return [primarySegment, ...(ticket.segments ?? []).map((segment) => ({
    ...segment,
    departure: { ...segment.departure },
    arrival: { ...segment.arrival },
  }))];
}

function buildSegmentCount(ticket: TicketDraft) {
  return getEffectiveSegments(ticket).length;
}

function supportsTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readFallbackTickets(): TicketRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as TicketRecord[];
  } catch {
    return [];
  }
}

function writeFallbackTickets(tickets: TicketRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }
}

function readFallbackAttachments(): Record<string, TicketAttachment[]> {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(ATTACHMENT_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as Record<string, TicketAttachment[]>;
  } catch {
    return {};
  }
}

function writeFallbackAttachments(attachments: Record<string, TicketAttachment[]>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ATTACHMENT_STORAGE_KEY, JSON.stringify(attachments));
  }
}

interface WebFallbackBackupSnapshot extends BackupRecord {
  tickets: TicketRecord[];
  attachments: Record<string, TicketAttachment[]>;
}

function readFallbackBackups(): WebFallbackBackupSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(BACKUP_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as WebFallbackBackupSnapshot[];
  } catch {
    return [];
  }
}

function writeFallbackBackups(backups: WebFallbackBackupSnapshot[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups));
  }
}

function createFallbackTicket(draft: TicketDraft): TicketRecord {
  const now = new Date().toISOString();
  const segments = draft.segments?.map((segment) => ({
    ...segment,
    departure: { ...segment.departure },
    arrival: { ...segment.arrival },
  }));

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `ticket-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    routeLabel: buildRouteLabel(draft),
    segmentCount: buildSegmentCount(draft),
    status: "saved",
    ...draft,
    ...(segments ? { segments } : {}),
  };
}

function getTicketAttachments(ticketId: string): TicketAttachment[] {
  return readFallbackAttachments()[ticketId] ?? [];
}

function createFallbackDetail(ticket: TicketRecord): TicketDetailPayload {
  return {
    ticket,
    map: {
      lineLabel: ticket.routeLabel,
      directionHint: `${ticket.departure.code || ticket.departure.name} to ${ticket.arrival.code || ticket.arrival.name}`,
      distanceHintKm: 0,
      origin: {
        label: ticket.departure.name,
        code: ticket.departure.code,
        timezone: ticket.departure.timezone,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
      destination: {
        label: ticket.arrival.name,
        code: ticket.arrival.code,
        timezone: ticket.arrival.timezone,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
      viewport: {
        minLatitude: Number.NaN,
        maxLatitude: Number.NaN,
        minLongitude: Number.NaN,
        maxLongitude: Number.NaN,
      },
    },
    segments: getEffectiveSegments(ticket).map((segment, index) => ({
      segmentIndex: index,
      transportType: ticket.ticketType,
      carrierName: segment.carrierName,
      code: segment.code,
      lineLabel: `${segment.departure.name} -> ${segment.arrival.name}`,
      directionHint: `${segment.departure.code || segment.departure.name} to ${segment.arrival.code || segment.arrival.name}`,
      distanceHintKm: 0,
      origin: {
        label: segment.departure.name,
        code: segment.departure.code,
        timezone: segment.departure.timezone,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
      destination: {
        label: segment.arrival.name,
        code: segment.arrival.code,
        timezone: segment.arrival.timezone,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
    })),
    stub: {
      title: "Ticket Stub Preview",
      subtitle: ticket.routeLabel,
      transportBadge: ticket.ticketType.toUpperCase(),
      primaryCode: ticket.code,
      departureLabel: ticket.departure.name,
      departureTimeLocal: ticket.departureTimeLocal,
      arrivalLabel: ticket.arrival.name,
      arrivalTimeLocal: ticket.arrivalTimeLocal,
      carrierName: ticket.carrierName,
      seatLabel: `${ticket.classInfo || "TBD"} / ${ticket.seatInfo || "TBD"}`,
      notes: ticket.notes || "TBD",
      routeLabel: ticket.routeLabel,
      accent: "#70d4ff",
    },
    attachments: getTicketAttachments(ticket.id),
  };
}

function replaceFallbackTicket(ticketId: string, nextTicket: TicketRecord) {
  const tickets = readFallbackTickets().map((ticket) => (ticket.id === ticketId ? nextTicket : ticket));
  writeFallbackTickets(tickets);
}

function normalizeAttachmentSource(attachment: TicketAttachment): TicketAttachment {
  if (attachment.previewUrl) {
    return attachment;
  }

  if (attachment.filePath && supportsTauri()) {
    return {
      ...attachment,
      previewUrl: convertFileSrc(attachment.filePath),
    };
  }

  return attachment;
}

async function fileToUpload(file: File): Promise<TicketAttachmentUpload> {
  const arrayBuffer = await file.arrayBuffer();
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: Array.from(new Uint8Array(arrayBuffer)),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read attachment file."));
    reader.readAsDataURL(file);
  });
}

export async function listTickets(): Promise<TicketRecord[]> {
  if (supportsTauri()) {
    return invoke<TicketRecord[]>("list_tickets");
  }

  return readFallbackTickets();
}

export async function createTicket(draft: TicketDraft): Promise<TicketRecord> {
  if (supportsTauri()) {
    return invoke<TicketRecord>("create_ticket", { draft });
  }

  const nextTicket = createFallbackTicket(draft);
  const current = readFallbackTickets();
  writeFallbackTickets([nextTicket, ...current]);
  return nextTicket;
}

export async function updateTicket(ticketId: string, draft: TicketDraft): Promise<TicketRecord> {
  if (supportsTauri()) {
    return invoke<TicketRecord>("update_ticket", { ticketId, draft });
  }

  const current = readFallbackTickets().find((item) => item.id === ticketId);
  if (!current) {
    throw new Error("Ticket record not found.");
  }

  const nextTicket: TicketRecord = {
    ...current,
    ...draft,
    id: current.id,
    routeLabel: buildRouteLabel(draft),
    segmentCount: buildSegmentCount(draft),
    updatedAt: new Date().toISOString(),
  };

  replaceFallbackTicket(ticketId, nextTicket);
  return nextTicket;
}

export async function updateTicketStatus(
  ticketId: string,
  status: Exclude<TicketStatus, "draft">,
): Promise<TicketRecord> {
  if (supportsTauri()) {
    return invoke<TicketRecord>("update_ticket_status", { ticketId, status });
  }

  const current = readFallbackTickets().find((item) => item.id === ticketId);
  if (!current) {
    throw new Error("Ticket record not found.");
  }

  const nextTicket: TicketRecord = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };

  replaceFallbackTicket(ticketId, nextTicket);
  return nextTicket;
}

export async function deleteTicket(ticketId: string): Promise<void> {
  if (supportsTauri()) {
    await invoke("delete_ticket", { ticketId });
    return;
  }

  const tickets = readFallbackTickets().filter((ticket) => ticket.id !== ticketId);
  writeFallbackTickets(tickets);
  const attachments = readFallbackAttachments();
  delete attachments[ticketId];
  writeFallbackAttachments(attachments);
}

export async function addTicketAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  if (supportsTauri()) {
    const upload = await fileToUpload(file);
    const attachment = await invoke<TicketAttachment>("add_ticket_attachment", { ticketId, upload });
    return normalizeAttachmentSource(attachment);
  }

  const previewUrl = await fileToDataUrl(file);
  const attachments = readFallbackAttachments();
  const nextAttachment: TicketAttachment = {
    id: globalThis.crypto?.randomUUID?.() ?? `attachment-${Date.now()}`,
    ticketId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    createdAt: new Date().toISOString(),
    previewUrl,
  };

  attachments[ticketId] = [nextAttachment, ...(attachments[ticketId] ?? [])];
  writeFallbackAttachments(attachments);
  return nextAttachment;
}

export async function deleteTicketAttachment(attachmentId: string, ticketId: string): Promise<void> {
  if (supportsTauri()) {
    await invoke("delete_ticket_attachment", { attachmentId });
    return;
  }

  const attachments = readFallbackAttachments();
  attachments[ticketId] = (attachments[ticketId] ?? []).filter((attachment) => attachment.id !== attachmentId);
  writeFallbackAttachments(attachments);
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetailPayload> {
  if (supportsTauri()) {
    const detail = await invoke<TicketDetailPayload>("get_ticket_detail", { ticketId });
    return finalizeTicketDetail({
      ...detail,
      attachments: detail.attachments.map(normalizeAttachmentSource),
    });
  }

  const ticket = readFallbackTickets().find((item) => item.id === ticketId);
  if (!ticket) {
    throw new Error("Ticket detail not found.");
  }

  return finalizeTicketDetail(createFallbackDetail(ticket));
}

function matchesAirlineQuery(entry: AirlineDirectoryEntry, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    entry.iataCode,
    entry.icaoCode || "",
    entry.nameEn,
    entry.nameZh || "",
    ...entry.aliases,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export async function searchAirlines(query: string): Promise<AirlineDirectoryEntry[]> {
  if (supportsTauri()) {
    return invoke<AirlineDirectoryEntry[]>("search_airlines", { query });
  }

  return AIRLINE_SEED.filter((entry) => matchesAirlineQuery(entry, query)).slice(0, 8);
}

function matchesLocationQuery(entry: LocationDirectoryEntry, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    entry.code || "",
    entry.nameEn || "",
    entry.nameZh || "",
    ...entry.aliases,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export async function searchLocations(query: string): Promise<LocationDirectoryEntry[]> {
  const locationSeed = await loadLocationSeed();
  return locationSeed.filter((entry) => matchesLocationQuery(entry, query)).slice(0, 8);
}

export async function listBackups(): Promise<BackupRecord[]> {
  if (supportsTauri()) {
    return invoke<BackupRecord[]>("list_backups");
  }

  return readFallbackBackups().map(({ tickets, attachments, ...backup }) => ({
    ...backup,
    attachmentCount:
      backup.attachmentCount ??
      Object.values(attachments).reduce((sum, items) => sum + items.length, 0),
    ticketCount: backup.ticketCount ?? tickets.length,
  }));
}

export async function createBackup(): Promise<BackupRecord> {
  if (supportsTauri()) {
    return invoke<BackupRecord>("create_backup");
  }

  const tickets = readFallbackTickets();
  const attachments = readFallbackAttachments();
  const createdAt = new Date().toISOString();
  const nextBackup: WebFallbackBackupSnapshot = {
    id: `backup-${Date.now()}`,
    label: `Backup ${createdAt.slice(0, 19).replace("T", " ")}`,
    createdAt,
    ticketCount: tickets.length,
    attachmentCount: Object.values(attachments).reduce((sum, items) => sum + items.length, 0),
    databaseSizeBytes: new Blob([JSON.stringify({ tickets, attachments })]).size,
    tickets,
    attachments,
  };

  writeFallbackBackups([nextBackup, ...readFallbackBackups()]);
  return nextBackup;
}

export async function getBackupReadiness(): Promise<BackupReadiness> {
  if (supportsTauri()) {
    return invoke<BackupReadiness>("get_backup_readiness");
  }

  const tickets = readFallbackTickets();
  const attachments = readFallbackAttachments();
  return {
    databaseExists: true,
    databasePath: "Web fallback localStorage",
    attachmentRootPath: "Web fallback localStorage",
    ticketCount: tickets.length,
    attachmentCount: Object.values(attachments).reduce((sum, items) => sum + items.length, 0),
  };
}

export async function restoreBackup(backupId: string): Promise<void> {
  if (supportsTauri()) {
    await invoke("restore_backup", { backupId });
    return;
  }

  const backup = readFallbackBackups().find((item) => item.id === backupId);
  if (!backup) {
    throw new Error("Backup record not found.");
  }

  writeFallbackTickets(backup.tickets);
  writeFallbackAttachments(backup.attachments);
}

export async function exportBackup(backupId: string): Promise<string> {
  if (supportsTauri()) {
    return invoke<string>("export_backup", { backupId });
  }

  const backup = readFallbackBackups().find((item) => item.id === backupId);
  if (!backup) {
    throw new Error("Backup record not found.");
  }

  return `Web fallback backup: ${backup.label}`;
}

export async function exportArchiveBundle(): Promise<string> {
  if (supportsTauri()) {
    return invoke<string>("export_archive_bundle");
  }

  const backup = await createBackup();
  return `Web fallback archive: ${backup.label}`;
}

export async function importArchiveBundle(bundlePath: string): Promise<void> {
  if (supportsTauri()) {
    await invoke("import_archive_bundle", { bundlePath });
    return;
  }

  throw new Error("Web fallback does not support importing archive bundles.");
}
