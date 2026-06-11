import { beforeEach, describe, expect, it } from "vitest";
import generatedAirports from "../src/data/airports.generated.json";
import { searchLocations } from "../src/lib/ticketService";
import type { LocationDirectoryEntry } from "../src/types/ticket";

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

describe("airport location directory data", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  });

  it("preserves municipality and place metadata for generated airport records", () => {
    const airports = generatedAirports as LocationDirectoryEntry[];
    const narita = airports.find((entry) => entry.code === "NRT");

    expect(narita).toBeDefined();
    expect(narita?.municipality).toBeTruthy();
    expect(narita?.placeNameEn).toBeTruthy();
    expect(narita?.placeKey).toMatch(/^[a-z0-9-]+$/);
    expect(narita?.coordinatePrecision).toBe("exact");
  });

  it("keeps airport search working with generated airport metadata", async () => {
    const results = await searchLocations("Osaka");
    const airportResults = results.filter((entry) => entry.locationType === "airport");

    expect(airportResults.length).toBeGreaterThan(0);
    expect(
      airportResults.some(
        (entry) =>
          entry.code === "KIX" ||
          entry.placeNameEn?.toLowerCase().includes("osaka") ||
          entry.aliases.some((alias) => alias.toLowerCase().includes("osaka")),
      ),
    ).toBe(true);
  });
});
