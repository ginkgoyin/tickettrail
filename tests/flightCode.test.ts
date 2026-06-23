import { describe, expect, it } from "vitest";
import {
  extractFlightCodePrefix,
  isLikelyFullFlightNumber,
  isNumericOnlyFlightNumber,
  normalizeFlightNumberInput,
} from "../src/lib/flightCode";

describe("flightCode helpers", () => {
  it("normalizes full flight number input to canonical uppercase form", () => {
    expect(normalizeFlightNumberInput("jq661")).toBe("JQ661");
    expect(normalizeFlightNumberInput("jq 661")).toBe("JQ661");
    expect(normalizeFlightNumberInput("jq-661")).toBe("JQ661");
    expect(normalizeFlightNumberInput("JQ661")).toBe("JQ661");
    expect(normalizeFlightNumberInput("661")).toBe("661");
  });

  it("detects numeric-only flight numbers", () => {
    expect(isNumericOnlyFlightNumber("661")).toBe(true);
    expect(isNumericOnlyFlightNumber(" 661 ")).toBe(true);
    expect(isNumericOnlyFlightNumber("JQ661")).toBe(false);
  });

  it("extracts airline prefixes from likely full flight numbers", () => {
    expect(extractFlightCodePrefix("JQ661")).toBe("JQ");
    expect(extractFlightCodePrefix("3U1234")).toBe("3U");
    expect(extractFlightCodePrefix("jq 661")).toBe("JQ");
    expect(extractFlightCodePrefix("661")).toBeNull();
  });

  it("distinguishes likely full flight numbers from suffix-only input", () => {
    expect(isLikelyFullFlightNumber("JQ661")).toBe(true);
    expect(isLikelyFullFlightNumber("jq-661")).toBe(true);
    expect(isLikelyFullFlightNumber("3U1234")).toBe(true);
    expect(isLikelyFullFlightNumber("661")).toBe(false);
    expect(isLikelyFullFlightNumber("JQ")).toBe(false);
  });
});
