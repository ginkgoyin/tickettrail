import { describe, expect, it } from "vitest";
import { parseImportedText, reviewImportedDraft } from "../src/lib/importParser";

describe("importParser", () => {
  it("parses a flight-like ticket text into a usable draft", () => {
    const parsed = parseImportedText(`
      MU561
      China Eastern
      Shanghai Pudong -> Sydney
      2026-05-21 09:30
      2026-05-21 21:30
      Gate 12
      Economy
      Seat 24A
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.detectedType).toBe("flight");
    expect(parsed?.draft.code).toBe("MU561");
    expect(parsed?.draft.carrierName).toBe("China Eastern");
    expect(parsed?.draft.departure.code).toBe("PVG");
    expect(parsed?.draft.arrival.code).toBe("SYD");
    expect(parsed?.draft.seatInfo).toBe("24A");
    expect(parsed?.draft.departureTimeLocal).toBe("2026-05-21T09:30");
    expect(parsed?.draft.arrivalTimeLocal).toBe("2026-05-21T21:30");
  });

  it("parses a train reimbursement ticket text into a usable draft", () => {
    const parsed = parseImportedText(`
      张家界西站 G2434 重庆东站
      2025年11月08日 14:32开
      02车04F号
      二等座
      仅供报销使用
      报销凭证
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.detectedType).toBe("train");
    expect(parsed?.draft.code).toBe("G2434");
    expect(parsed?.draft.departure.name).toContain("张家界");
    expect(parsed?.draft.arrival.name).toContain("重庆");
    expect(parsed?.draft.classInfo).toBe("二等座");
    expect(parsed?.draft.seatInfo).toContain("02车");
    expect(parsed?.draft.departureTimeLocal).toBe("2025-11-08T14:32");
  });

  it("generates actionable reviews for incomplete OCR output", () => {
    const parsed = parseImportedText(`
      MU561
      PVG -> SYD
      09:30
    `);

    expect(parsed).not.toBeNull();
    const reviews = reviewImportedDraft(parsed!);

    expect(reviews.some((review) => review.field === "arrivalTimeLocal")).toBe(true);
    expect(reviews.some((review) => review.field === "departureTimeLocal")).toBe(true);
    expect(parsed?.draft.carrierName).toBe("China Eastern");
  });
});
