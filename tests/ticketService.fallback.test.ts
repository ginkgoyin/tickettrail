import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRouteMapSegments,
  createBackup,
  createTicket,
  deleteTicket,
  exportArchiveBundle,
  exportBackup,
  getBackupReadiness,
  getTicketDetail,
  importArchiveBundle,
  listBackups,
  listTickets,
  restoreBackup,
  updateTicketStatus,
} from "../src/lib/ticketService";
import type { TicketDraft } from "../src/types/ticket";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

function buildDraft(overrides: Partial<TicketDraft> = {}): TicketDraft {
  return {
    ticketType: "flight",
    carrierName: "China Eastern",
    code: "MU561",
    departure: {
      name: "Shanghai Pudong",
      code: "PVG",
      timezone: "Asia/Shanghai",
    },
    arrival: {
      name: "Sydney",
      code: "SYD",
      timezone: "Australia/Sydney",
    },
    departureTimeLocal: "2026-05-21T09:30",
    arrivalTimeLocal: "2026-05-21T21:30",
    classInfo: "Economy",
    seatInfo: "24A",
    notes: "Test itinerary",
    segments: [],
    ...overrides,
  };
}

describe("ticketService web fallback", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  });

  it("creates, lists, updates and deletes tickets in web fallback storage", async () => {
    const created = await createTicket(buildDraft());
    expect(created.status).toBe("saved");

    const storedTickets = await listTickets();
    expect(storedTickets).toHaveLength(1);
    expect(storedTickets[0]?.routeLabel).toContain("Shanghai");

    const updated = await updateTicketStatus(created.id, "used");
    expect(updated.status).toBe("used");

    const detail = await getTicketDetail(created.id);
    expect(detail.ticket.id).toBe(created.id);
    expect(detail.segments.length).toBeGreaterThan(0);

    await deleteTicket(created.id);
    expect(await listTickets()).toHaveLength(0);
  });

  it("creates and restores backups in web fallback storage", async () => {
    const first = await createTicket(buildDraft({ code: "MU562" }));
    const backup = await createBackup();

    expect(backup.ticketCount).toBe(1);
    expect((await listBackups()).length).toBe(1);

    await createTicket(buildDraft({ code: "MU563", arrival: { name: "Melbourne", code: "MEL", timezone: "Australia/Melbourne" } }));
    expect((await listTickets()).length).toBe(2);

    await restoreBackup(backup.id);
    const restoredTickets = await listTickets();
    expect(restoredTickets).toHaveLength(1);
    expect(restoredTickets[0]?.code).toBe(first.code);
  });

  it("reports backup readiness from localStorage fallback", async () => {
    await createTicket(buildDraft());
    const readiness = await getBackupReadiness();

    expect(readiness.databaseExists).toBe(true);
    expect(readiness.databasePath).toContain("localStorage");
    expect(readiness.ticketCount).toBe(1);
  });

  it("returns export labels and rejects unsupported archive import in web fallback", async () => {
    await createTicket(buildDraft());
    const backup = await createBackup();

    await expect(exportBackup(backup.id)).resolves.toContain(backup.label);
    await expect(exportArchiveBundle()).resolves.toContain("Web fallback archive");
    await expect(importArchiveBundle("C:\\fake\\archive.zip")).rejects.toThrow(
      "Web fallback does not support importing archive bundles.",
    );
  });

  it("throws clear errors for missing fallback backup records", async () => {
    await expect(restoreBackup("missing-backup")).rejects.toThrow("Backup record not found.");
    await expect(exportBackup("missing-backup")).rejects.toThrow("Backup record not found.");
  });

  it("builds consecutive map legs for multi-segment itineraries", () => {
    const segments = buildRouteMapSegments(
      buildDraft({
        departure: {
          name: "Sydney",
          code: "SYD",
          timezone: "Australia/Sydney",
        },
        arrival: {
          name: "Ayers Rock",
          code: "AYQ",
          timezone: "Australia/Darwin",
        },
        segments: [
          {
            carrierName: "Qantas",
            code: "QF790",
            departure: {
              name: "Brisbane",
              code: "BNE",
              timezone: "Australia/Brisbane",
            },
            arrival: {
              name: "Ayers Rock",
              code: "AYQ",
              timezone: "Australia/Darwin",
            },
            departureTimeLocal: "2026-05-21T13:10",
            arrivalTimeLocal: "2026-05-21T16:25",
            classInfo: "Economy",
            seatInfo: "18C",
            notes: "",
          },
        ],
      }),
    );

    expect(segments).toHaveLength(2);
    expect(segments[0]?.departure.code).toBe("SYD");
    expect(segments[0]?.arrival.code).toBe("BNE");
    expect(segments[1]?.departure.code).toBe("BNE");
    expect(segments[1]?.arrival.code).toBe("AYQ");
  });

  it("preserves full ordered multi-segment records in web fallback storage", async () => {
    const created = await createTicket(
      buildDraft({
        departure: {
          name: "Changsha",
          code: "CSX",
          timezone: "Asia/Shanghai",
        },
        arrival: {
          name: "Shanghai Pudong",
          code: "PVG",
          timezone: "Asia/Shanghai",
        },
        departureTerminal: "T2",
        arrivalTerminal: "T1",
        departureTimeLocal: "2026-06-01T08:10",
        arrivalTimeLocal: "2026-06-01T09:50",
        segments: [
          {
            carrierName: "China Eastern",
            code: "MU739",
            departure: {
              name: "Shanghai Pudong",
              code: "PVG",
              timezone: "Asia/Shanghai",
            },
            arrival: {
              name: "Sydney",
              code: "SYD",
              timezone: "Australia/Sydney",
            },
            departureTerminal: "T1",
            arrivalTerminal: "T1",
            departureTimeLocal: "2026-06-01T12:15",
            arrivalTimeLocal: "2026-06-01T22:20",
            classInfo: "Economy",
            seatInfo: "31A",
            notes: "Onward leg",
          },
        ],
      }),
    );

    expect(created.arrival.code).toBe("SYD");
    expect(created.arrivalTimeLocal).toBe("2026-06-01T22:20");
    expect(created.segments).toHaveLength(2);
    expect(created.segments?.[0]?.departure.code).toBe("CSX");
    expect(created.segments?.[0]?.arrival.code).toBe("PVG");
    expect(created.segments?.[0]?.arrivalTimeLocal).toBe("2026-06-01T09:50");
    expect(created.segments?.[0]?.arrivalTerminal).toBe("T1");
    expect(created.segments?.[1]?.departure.code).toBe("PVG");
    expect(created.segments?.[1]?.arrival.code).toBe("SYD");
    expect(created.segments?.[1]?.arrivalTimeLocal).toBe("2026-06-01T22:20");
    expect(created.segments?.[1]?.arrivalTerminal).toBe("T1");

    const detail = await getTicketDetail(created.id);
    expect(detail.ticket.segments).toHaveLength(2);
    expect(detail.ticket.segments?.[0]?.arrival.code).toBe("PVG");
    expect(detail.ticket.segments?.[0]?.arrivalTimeLocal).toBe("2026-06-01T09:50");
    expect(detail.ticket.segments?.[1]?.arrival.code).toBe("SYD");
    expect(detail.ticket.segments?.[1]?.arrivalTimeLocal).toBe("2026-06-01T22:20");
  });
});
