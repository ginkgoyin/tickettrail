import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import airlineSeedData from "../data/airlines.seed.json";
import locationSeedData from "../data/locations.seed.json";
import type {
  AirlineDirectoryEntry,
  BackupRecord,
  LocationDirectoryEntry,
  TicketAttachment,
  TicketAttachmentUpload,
  TicketDetailPayload,
  TicketDraft,
  TicketRecord,
  TicketSegmentDraft,
  TicketStatus,
} from "../types/ticket";

const STORAGE_KEY = "tickettrail.web-fallback.tickets";
const ATTACHMENT_STORAGE_KEY = "tickettrail.web-fallback.attachments";
const BACKUP_STORAGE_KEY = "tickettrail.web-fallback.backups";
const AIRLINE_SEED = airlineSeedData as AirlineDirectoryEntry[];
const LOCATION_SEED = locationSeedData as LocationDirectoryEntry[];

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
  const originLatitude = ticket.departure.name.toLowerCase().includes("shanghai") ? 31.2304 : -33.9399;
  const originLongitude = ticket.departure.name.toLowerCase().includes("shanghai") ? 121.4737 : 151.1753;
  const destinationLatitude = ticket.arrival.name.toLowerCase().includes("sydney") ? -33.9399 : 31.968;
  const destinationLongitude = ticket.arrival.name.toLowerCase().includes("sydney") ? 151.1753 : 118.806;

  return {
    ticket,
    map: {
      lineLabel: ticket.routeLabel,
      directionHint: `${ticket.departure.code || ticket.departure.name} to ${ticket.arrival.code || ticket.arrival.name}`,
      distanceHintKm: 7800,
      origin: {
        label: ticket.departure.name,
        code: ticket.departure.code,
        timezone: ticket.departure.timezone,
        latitude: originLatitude,
        longitude: originLongitude,
      },
      destination: {
        label: ticket.arrival.name,
        code: ticket.arrival.code,
        timezone: ticket.arrival.timezone,
        latitude: destinationLatitude,
        longitude: destinationLongitude,
      },
      viewport: {
        minLatitude: Math.min(originLatitude, destinationLatitude),
        maxLatitude: Math.max(originLatitude, destinationLatitude),
        minLongitude: Math.min(originLongitude, destinationLongitude),
        maxLongitude: Math.max(originLongitude, destinationLongitude),
      },
    },
    segments: getEffectiveSegments(ticket).map((segment, index) => ({
      segmentIndex: index,
      transportType: ticket.ticketType,
      carrierName: segment.carrierName,
      code: segment.code,
      lineLabel: `${segment.departure.name} -> ${segment.arrival.name}`,
      directionHint: `${segment.departure.code || segment.departure.name} to ${segment.arrival.code || segment.arrival.name}`,
      distanceHintKm: index === 0 ? 7800 : 920,
      origin: {
        label: segment.departure.name,
        code: segment.departure.code,
        timezone: segment.departure.timezone,
        latitude: index === 0 ? originLatitude : destinationLatitude,
        longitude: index === 0 ? originLongitude : destinationLongitude,
      },
      destination: {
        label: segment.arrival.name,
        code: segment.arrival.code,
        timezone: segment.arrival.timezone,
        latitude: destinationLatitude,
        longitude: destinationLongitude,
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
    return {
      ...detail,
      attachments: detail.attachments.map(normalizeAttachmentSource),
    };
  }

  const ticket = readFallbackTickets().find((item) => item.id === ticketId);
  if (!ticket) {
    throw new Error("Ticket detail not found.");
  }

  return createFallbackDetail(ticket);
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
  if (supportsTauri()) {
    return invoke<LocationDirectoryEntry[]>("search_locations", { query });
  }

  return LOCATION_SEED.filter((entry) => matchesLocationQuery(entry, query)).slice(0, 8);
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
