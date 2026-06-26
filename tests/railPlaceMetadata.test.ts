import { describe, expect, it } from "vitest";
import { deriveRailPlaceMetadata } from "../scripts/lib/derive-rail-place.mjs";
import generatedStations from "../src/data/rail-stations.generated.json";
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

describe("rail place metadata derivation", () => {
  it("derives qingdao from qingdaobei with medium confidence", () => {
    const metadata = deriveRailPlaceMetadata({
      nameZh: "\u9752\u5c9b\u5317",
      pinyin: "qingdaobei",
      nameEn: "qingdaobei",
    });

    expect(metadata.placeNameZh).toBe("\u9752\u5c9b");
    expect(metadata.placeNameEn).toBe("Qingdao");
    expect(metadata.placeKey).toBe("cn-qingdao");
    expect(metadata.placeConfidence).toBe("medium");
  });

  it("derives changsha from changshanan with medium confidence", () => {
    const metadata = deriveRailPlaceMetadata({
      nameZh: "\u957f\u6c99\u5357",
      pinyin: "changshanan",
      nameEn: "changshanan",
    });

    expect(metadata.placeNameZh).toBe("\u957f\u6c99");
    expect(metadata.placeNameEn).toBe("Changsha");
    expect(metadata.placeKey).toBe("cn-changsha");
    expect(metadata.placeConfidence).toBe("medium");
  });

  it("uses curated mapping for shanghaihongqiao", () => {
    const metadata = deriveRailPlaceMetadata({
      nameZh: "\u4e0a\u6d77\u8679\u6865",
      pinyin: "shanghaihongqiao",
      nameEn: "shanghaihongqiao",
    });

    expect(metadata.placeNameZh).toBe("\u4e0a\u6d77");
    expect(metadata.placeNameEn).toBe("Shanghai");
    expect(metadata.placeKey).toBe("cn-shanghai");
    expect(metadata.placeConfidence).toBe("high");
  });

  it("does not incorrectly strip two-character city names", () => {
    const huaibei = deriveRailPlaceMetadata({
      nameZh: "\u6dee\u5317",
      pinyin: "huaibei",
      nameEn: "huaibei",
    });
    const nanning = deriveRailPlaceMetadata({
      nameZh: "\u5357\u5b81",
      pinyin: "nanning",
      nameEn: "nanning",
    });

    expect(huaibei.placeNameZh).toBe("\u6dee\u5317");
    expect(huaibei.placeConfidence).toBe("low");
    expect(nanning.placeNameZh).toBe("\u5357\u5b81");
    expect(nanning.placeConfidence).toBe("low");
  });

  it("generated rail stations include derived place metadata for representative examples", () => {
    const stations = generatedStations as LocationDirectoryEntry[];
    const qingdaobei = stations.find((entry) => entry.code === "QHK");
    const shanghaihongqiao = stations.find((entry) => entry.code === "AOH");
    const haerbinxi = stations.find((entry) => entry.code === "VAB");

    expect(qingdaobei?.placeNameZh).toBe("\u9752\u5c9b");
    expect(qingdaobei?.placeKey).toBe("cn-qingdao");
    expect(qingdaobei?.placeConfidence).toBe("medium");

    expect(shanghaihongqiao?.placeNameZh).toBe("\u4e0a\u6d77");
    expect(shanghaihongqiao?.placeKey).toBe("cn-shanghai");
    expect(shanghaihongqiao?.placeConfidence).toBe("high");

    expect(haerbinxi?.placeNameZh).toBe("\u54c8\u5c14\u6ee8");
    expect(haerbinxi?.placeKey).toBe("cn-harbin");
  });

  it("keeps rail station search working after adding place metadata", async () => {
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: new MemoryStorage() },
      configurable: true,
      writable: true,
    });

    const results = await searchLocations("qingdao", { ticketType: "train" });
    const qingdaoRail = results.find((entry) => entry.code === "QHK");

    expect(qingdaoRail).toBeDefined();
    expect(qingdaoRail?.locationType).toBe("station");
    expect(qingdaoRail?.placeNameZh).toBe("\u9752\u5c9b");
  }, 15000);
});
