import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type {
  TicketAttachment,
  TicketAttachmentUpload,
  TicketDetailPayload,
  TicketDraft,
  TicketRecord,
  TicketStatus,
} from "../types/ticket";

const STORAGE_KEY = "tickettrail.web-fallback.tickets";
const ATTACHMENT_STORAGE_KEY = "tickettrail.web-fallback.attachments";

function buildRouteLabel(ticket: TicketDraft) {
  return `${ticket.departure.name} -> ${ticket.arrival.name}`;
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

function createFallbackTicket(draft: TicketDraft): TicketRecord {
  const now = new Date().toISOString();

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `ticket-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    routeLabel: buildRouteLabel(draft),
    status: "saved",
    ...draft,
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
