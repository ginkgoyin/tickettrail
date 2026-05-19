import type { TicketDraft, TicketLocation, TicketType } from "../types/ticket";

export interface ImportParseResult {
  draft: TicketDraft;
  detectedType: TicketType;
  matchedFields: string[];
  warnings: string[];
}

const airportTimezones: Record<string, string> = {
  PVG: "Asia/Shanghai",
  SHA: "Asia/Shanghai",
  SYD: "Australia/Sydney",
  MEL: "Australia/Melbourne",
  PEK: "Asia/Shanghai",
  PKX: "Asia/Shanghai",
  CAN: "Asia/Shanghai",
  SZX: "Asia/Shanghai",
  HKG: "Asia/Hong_Kong",
  NRT: "Asia/Tokyo",
  HND: "Asia/Tokyo",
  SIN: "Asia/Singapore",
};

const cityTimezones: Array<{ matcher: RegExp; timezone: string }> = [
  { matcher: /(?:\u4e0a\u6d77|shanghai)/i, timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6089\u5c3c|sydney)/i, timezone: "Australia/Sydney" },
  { matcher: /(?:\u58a8\u5c14\u672c|melbourne)/i, timezone: "Australia/Melbourne" },
  { matcher: /(?:\u5317\u4eac|beijing)/i, timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5e7f\u5dde|guangzhou)/i, timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6df1\u5733|shenzhen)/i, timezone: "Asia/Shanghai" },
  { matcher: /(?:\u4e1c\u4eac|tokyo)/i, timezone: "Asia/Tokyo" },
  { matcher: /(?:\u65b0\u52a0\u5761|singapore)/i, timezone: "Asia/Singapore" },
  { matcher: /(?:\u9999\u6e2f|hong kong)/i, timezone: "Asia/Hong_Kong" },
];

const airlineMappings: Array<{ matcher: RegExp; name: string }> = [
  { matcher: /(?:china eastern|\u4e1c\u65b9\u822a\u7a7a|\u4e1c\u822a)/i, name: "China Eastern" },
  { matcher: /(?:china southern|\u5357\u65b9\u822a\u7a7a|\u5357\u822a)/i, name: "China Southern" },
  { matcher: /(?:air china|\u56fd\u822a)/i, name: "Air China" },
  { matcher: /(?:hainan airlines|\u6d77\u5357\u822a\u7a7a|\u6d77\u822a)/i, name: "Hainan Airlines" },
  { matcher: /(?:spring airlines|\u6625\u79cb\u822a\u7a7a)/i, name: "Spring Airlines" },
  { matcher: /(?:xiamen airlines|\u53a6\u95e8\u822a\u7a7a|\u53a6\u822a)/i, name: "XiamenAir" },
  { matcher: /(?:cathay pacific|\u56fd\u6cf0\u822a\u7a7a)/i, name: "Cathay Pacific" },
  { matcher: /qantas/i, name: "Qantas" },
  { matcher: /virgin australia/i, name: "Virgin Australia" },
];

function createDefaultDraft(ticketType: TicketType): TicketDraft {
  return {
    ticketType,
    carrierName: ticketType === "train" ? "China Railway" : "",
    code: "",
    departure: {
      name: "",
      code: "",
      timezone: "Asia/Shanghai",
    },
    arrival: {
      name: "",
      code: "",
      timezone: ticketType === "train" ? "Asia/Shanghai" : "Australia/Sydney",
    },
    departureTimeLocal: "",
    arrivalTimeLocal: "",
    classInfo: "",
    seatInfo: "",
    notes: "",
  };
}

function resolveTimezone(location: TicketLocation) {
  const code = location.code?.toUpperCase() || "";
  if (code && airportTimezones[code]) {
    return airportTimezones[code];
  }

  const matched = cityTimezones.find((item) => item.matcher.test(location.name));
  return matched?.timezone || location.timezone;
}

function normalizeDateTime(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  const match = compact.match(
    /(\d{4})[\u5e74/\-.](\d{1,2})[\u6708/\-.](\d{1,2})(?:\u65e5|\u53f7)?\s*(\d{1,2}:\d{2})/,
  );

  if (!match) {
    return "";
  }

  const [, year, month, day, time] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`;
}

function pickAirlineName(text: string, code: string) {
  const matched = airlineMappings.find((item) => item.matcher.test(text));
  if (matched) {
    return matched.name;
  }

  if (code.startsWith("MU")) return "China Eastern";
  if (code.startsWith("CZ")) return "China Southern";
  if (code.startsWith("CA")) return "Air China";
  if (code.startsWith("HU")) return "Hainan Airlines";
  if (code.startsWith("FM")) return "Shanghai Airlines";

  return "";
}

function parseTrain(text: string): ImportParseResult {
  const draft = createDefaultDraft("train");
  const matchedFields: string[] = [];
  const warnings: string[] = [];

  const routeMatch =
    text.match(
      /([^\s]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))\s*(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4})\s*([^\s]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))/i,
    ) ||
    text.match(
      /([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9)).{0,8}(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4}).{0,8}([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))/i,
    );

  if (routeMatch) {
    draft.departure.name = routeMatch[1].trim();
    draft.code = routeMatch[2].trim().toUpperCase();
    draft.arrival.name = routeMatch[3].trim();
    matchedFields.push("departure", "code", "arrival");
  }

  const departureTimeMatch = text.match(
    /(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2})\s*\u5f00/,
  );
  if (departureTimeMatch) {
    draft.departureTimeLocal = normalizeDateTime(departureTimeMatch[1]);
    matchedFields.push("departureTimeLocal");
  } else {
    const genericDateTime = text.match(
      /(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2})/,
    );
    if (genericDateTime) {
      draft.departureTimeLocal = normalizeDateTime(genericDateTime[1]);
      matchedFields.push("departureTimeLocal");
    }
  }

  const seatBlock = text.match(/(\d{1,2}\s*\u8f66)\s*([0-9A-Z]{1,4}\s*\u53f7)?/);
  const classMatch = text.match(
    /(\u5546\u52a1\u5ea7|\u4e00\u7b49\u5ea7|\u4e8c\u7b49\u5ea7|\u8f6f\u5367|\u786c\u5367|\u786c\u5ea7|\u65e0\u5ea7)/,
  );
  if (seatBlock?.[1] || seatBlock?.[2] || classMatch?.[1]) {
    draft.classInfo = classMatch?.[1] || "";
    draft.seatInfo = [seatBlock?.[1], seatBlock?.[2]].filter(Boolean).join(" ").trim();
    matchedFields.push("classInfo", "seatInfo");
  }

  draft.carrierName = "China Railway";
  draft.departure.timezone = resolveTimezone(draft.departure);
  draft.arrival.timezone = resolveTimezone(draft.arrival);

  if (!draft.arrival.name) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5230\u8fbe\u7ad9\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.departureTimeLocal) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5f00\u8f66\u65f6\u95f4\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }

  draft.notes = "Imported from pasted OCR text";

  return {
    draft,
    detectedType: "train",
    matchedFields,
    warnings,
  };
}

function parseFlight(text: string): ImportParseResult {
  const draft = createDefaultDraft("flight");
  const matchedFields: string[] = [];
  const warnings: string[] = [];

  const flightCodeMatch = text.match(/\b([A-Z]{2}\d{3,4})\b/);
  if (flightCodeMatch) {
    draft.code = flightCodeMatch[1].toUpperCase();
    matchedFields.push("code");
  }

  const airportCodes = [...text.matchAll(/\b([A-Z]{3})\b/g)]
    .map((match) => match[1].toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));
  if (airportCodes.length >= 2) {
    draft.departure.code = airportCodes[0];
    draft.arrival.code = airportCodes[1];
    draft.departure.timezone = resolveTimezone(draft.departure);
    draft.arrival.timezone = resolveTimezone(draft.arrival);
    matchedFields.push("departure.code", "arrival.code");
  }

  const routeArrowMatch = text.match(
    /([A-Za-z\u4e00-\u9fa5\s]{2,40})\s*(?:->|\u2192|-)\s*([A-Za-z\u4e00-\u9fa5\s]{2,40})/,
  );
  if (routeArrowMatch) {
    draft.departure.name = routeArrowMatch[1].trim();
    draft.arrival.name = routeArrowMatch[2].trim();
    matchedFields.push("departure", "arrival");
  } else {
    const routeHintMatch = text.match(
      /(\u4e0a\u6d77|Shanghai|\u6089\u5c3c|Sydney).{0,12}(\u4e0a\u6d77|Shanghai|\u6089\u5c3c|Sydney)/i,
    );
    if (routeHintMatch) {
      draft.departure.name = routeHintMatch[1].trim();
      draft.arrival.name = routeHintMatch[2].trim();
      matchedFields.push("departure", "arrival");
    }
  }

  const timeMatches = [
    ...text.matchAll(
      /(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2})/g,
    ),
  ].map((match) => normalizeDateTime(match[1]));
  if (timeMatches[0]) {
    draft.departureTimeLocal = timeMatches[0];
    matchedFields.push("departureTimeLocal");
  }
  if (timeMatches[1]) {
    draft.arrivalTimeLocal = timeMatches[1];
    matchedFields.push("arrivalTimeLocal");
  }

  const cabinMatch = text.match(
    /(First|Business|Premium Economy|Economy|\u5934\u7b49\u8231|\u5546\u52a1\u8231|\u7ecf\u6d4e\u8231)/i,
  );
  if (cabinMatch) {
    draft.classInfo = cabinMatch[1];
    matchedFields.push("classInfo");
  }

  const seatMatch = text.match(/\b(\d{1,2}[A-FK])\b/);
  if (seatMatch) {
    draft.seatInfo = seatMatch[1].toUpperCase();
    matchedFields.push("seatInfo");
  }

  draft.carrierName = pickAirlineName(text, draft.code);
  if (draft.carrierName) {
    matchedFields.push("carrierName");
  }

  draft.departure.timezone = resolveTimezone(draft.departure);
  draft.arrival.timezone = resolveTimezone(draft.arrival);

  if (!draft.departure.name && draft.departure.code) {
    draft.departure.name = draft.departure.code;
  }
  if (!draft.arrival.name && draft.arrival.code) {
    draft.arrival.name = draft.arrival.code;
  }

  if (!draft.carrierName) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u822a\u7a7a\u516c\u53f8\u540d\u79f0\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.arrivalTimeLocal) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5230\u8fbe\u65f6\u95f4\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }

  draft.notes = "Imported from pasted OCR text";

  return {
    draft,
    detectedType: "flight",
    matchedFields,
    warnings,
  };
}

export function parseImportedText(rawText: string): ImportParseResult | null {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  const looksLikeTrain =
    /(?:\u62a5\u9500\u51ed\u8bc1|\u94c1\u8def|\u4e8c\u7b49\u5ea7|\u4e00\u7b49\u5ea7|\u5546\u52a1\u5ea7|\u8f66\u6b21|\u8f66\u7968|\u9ad8\u94c1|\u52a8\u8f66|[GDKCZ]\d{1,4})/i.test(
      text,
    );

  return looksLikeTrain ? parseTrain(rawText) : parseFlight(rawText);
}
