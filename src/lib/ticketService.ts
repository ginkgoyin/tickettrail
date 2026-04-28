import { invoke } from "@tauri-apps/api/core";
import type { TicketDraft, TicketRecord } from "../types/ticket";

const STORAGE_KEY = "tickettrail.web-fallback.tickets";

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
