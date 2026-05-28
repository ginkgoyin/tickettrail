import { beforeEach, describe, expect, it } from "vitest";
import {
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
});
