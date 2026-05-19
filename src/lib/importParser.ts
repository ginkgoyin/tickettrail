import type { TicketDraft, TicketLocation, TicketType } from "../types/ticket";

export interface ImportParseResult {
  draft: TicketDraft;
  detectedType: TicketType;
  matchedFields: string[];
  warnings: string[];
  normalizedText: string;
  confidence: number;
}

const currentYear = new Date().getFullYear();

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

const locationAliases: Array<{ matcher: RegExp; name: string; code?: string; timezone: string }> = [
  { matcher: /(?:\u4e0a\u6d77\u6d66\u4e1c|shanghai pudong|pudong)/i, name: "\u4e0a\u6d77\u6d66\u4e1c", code: "PVG", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u4e0a\u6d77\u8679\u6865\u673a\u573a|shanghai hongqiao airport)/i, name: "\u4e0a\u6d77\u8679\u6865\u673a\u573a", code: "SHA", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u4e0a\u6d77\u8679\u6865\u7ad9|shanghai hongqiao station)/i, name: "\u4e0a\u6d77\u8679\u6865\u7ad9", code: "SHH", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6089\u5c3c|sydney)/i, name: "\u6089\u5c3c", code: "SYD", timezone: "Australia/Sydney" },
  { matcher: /(?:\u58a8\u5c14\u672c|melbourne)/i, name: "\u58a8\u5c14\u672c", code: "MEL", timezone: "Australia/Melbourne" },
  { matcher: /(?:\u5317\u4eac\u9996\u90fd|beijing capital)/i, name: "\u5317\u4eac\u9996\u90fd", code: "PEK", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5317\u4eac\u5927\u5174|beijing daxing)/i, name: "\u5317\u4eac\u5927\u5174", code: "PKX", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5e7f\u5dde\u767d\u4e91|guangzhou baiyun|guangzhou)/i, name: "\u5e7f\u5dde", code: "CAN", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6df1\u5733\u5b9d\u5b89|shenzhen baoan|shenzhen)/i, name: "\u6df1\u5733", code: "SZX", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u9999\u6e2f|hong kong)/i, name: "\u9999\u6e2f", code: "HKG", timezone: "Asia/Hong_Kong" },
  { matcher: /(?:\u6771\u4eac|tokyo|\u6210\u7530|narita)/i, name: "\u4e1c\u4eac", code: "NRT", timezone: "Asia/Tokyo" },
  { matcher: /(?:\u65b0\u52a0\u5761|singapore)/i, name: "\u65b0\u52a0\u5761", code: "SIN", timezone: "Asia/Singapore" },
  { matcher: /(?:\u5357\u4eac\u5357\u7ad9|nanjing south)/i, name: "\u5357\u4eac\u5357\u7ad9", code: "NKH", timezone: "Asia/Shanghai" },
];

const airlineMappings: Array<{ matcher: RegExp; name: string }> = [
  { matcher: /(?:china eastern|\u4e1c\u65b9\u822a\u7a7a|\u4e1c\u822a|mu)/i, name: "China Eastern" },
  { matcher: /(?:china southern|\u5357\u65b9\u822a\u7a7a|\u5357\u822a|cz)/i, name: "China Southern" },
  { matcher: /(?:air china|\u56fd\u822a|ca)/i, name: "Air China" },
  { matcher: /(?:hainan airlines|\u6d77\u5357\u822a\u7a7a|\u6d77\u822a|hu)/i, name: "Hainan Airlines" },
  { matcher: /(?:spring airlines|\u6625\u79cb\u822a\u7a7a|9c)/i, name: "Spring Airlines" },
  { matcher: /(?:xiamen airlines|\u53a6\u95e8\u822a\u7a7a|\u53a6\u822a|mf)/i, name: "XiamenAir" },
  { matcher: /(?:cathay pacific|\u56fd\u6cf0\u822a\u7a7a|cx)/i, name: "Cathay Pacific" },
  { matcher: /qantas|qf/i, name: "Qantas" },
  { matcher: /virgin australia|va/i, name: "Virgin Australia" },
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

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeOcrCharacters(text: string) {
  return text
    .replace(/[—–~]/g, "-")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[票杳]/g, "票")
    .replace(/[车卓]/g, "车")
    .replace(/[开并]/g, "开")
    .replace(/[站玷]/g, "站")
    .replace(/([A-Z])\s+(\d)/g, "$1$2")
    .replace(/([GDKCZ])\s+(\d{1,4})/gi, "$1$2")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)O\b/g, "0")
    .replace(/\bI(?=\d)/g, "1")
    .replace(/(?<=\d)I\b/g, "1")
    .replace(/(?<=\d)l(?=\d)/g, "1")
    .replace(/(?<=\b[A-Z]{2})O(?=\d)/g, "0")
    .replace(/\bSYO\b/g, "SYD")
    .replace(/\bPVO\b/g, "PVG")
    .replace(/\bSHA\b/g, "SHA")
    .replace(/\bPE0\b/g, "PEK");
}

function preprocessImportedText(rawText: string) {
  return normalizeWhitespace(normalizeOcrCharacters(rawText));
}

function resolveTimezone(location: TicketLocation) {
  const code = location.code?.toUpperCase() || "";
  if (code && airportTimezones[code]) {
    return airportTimezones[code];
  }

  const alias = locationAliases.find((item) => item.matcher.test(location.name));
  return alias?.timezone || location.timezone;
}

function hydrateLocation(location: TicketLocation) {
  const alias = locationAliases.find((item) => item.matcher.test(location.name) || (!!location.code && item.code === location.code.toUpperCase()));
  if (alias) {
    return {
      ...location,
      name: location.name || alias.name,
      code: location.code || alias.code,
      timezone: alias.timezone,
    };
  }

  return {
    ...location,
    timezone: resolveTimezone(location),
  };
}

function normalizeDateTime(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();

  const fullDateMatch = compact.match(
    /(\d{4})[\u5e74/\-.](\d{1,2})[\u6708/\-.](\d{1,2})(?:\u65e5|\u53f7)?\s*(\d{1,2}:\d{2})/,
  );
  if (fullDateMatch) {
    const [, year, month, day, time] = fullDateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`;
  }

  const shortDateMatch = compact.match(/(\d{1,2})[\/\-.](\d{1,2})\s*(\d{1,2}:\d{2})/);
  if (shortDateMatch) {
    const [, month, day, time] = shortDateMatch;
    return `${String(currentYear)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`;
  }

  return "";
}

function normalizeFlightCode(code: string) {
  return code
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^([A-Z]{2})O(?=\d)/, "$10")
    .replace(/^([A-Z]{2})I(?=\d)/, "$11");
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

function finalizeResult(result: Omit<ImportParseResult, "confidence">): ImportParseResult {
  const fieldScore = Math.min(result.matchedFields.length / 8, 1);
  const warningPenalty = Math.min(result.warnings.length * 0.12, 0.36);
  const confidence = Math.max(0.2, Math.min(0.98, fieldScore - warningPenalty + 0.22));

  return {
    ...result,
    confidence,
  };
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
      /([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9)).{0,12}(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4}).{0,12}([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))/i,
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
      /(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2}|\d{1,2}[\/\-.]\d{1,2}\s*\d{1,2}:\d{2})/,
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
  draft.departure = hydrateLocation(draft.departure);
  draft.arrival = hydrateLocation(draft.arrival);

  if (!draft.arrival.name) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5230\u8fbe\u7ad9\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.departureTimeLocal) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5f00\u8f66\u65f6\u95f4\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }

  draft.notes = "Imported from OCR text";

  return finalizeResult({
    draft,
    detectedType: "train",
    matchedFields,
    warnings,
    normalizedText: text,
  });
}

function parseFlight(text: string): ImportParseResult {
  const draft = createDefaultDraft("flight");
  const matchedFields: string[] = [];
  const warnings: string[] = [];

  const flightCodeMatch = text.match(/\b([A-Z]{2}\s?\d{3,4})\b/);
  if (flightCodeMatch) {
    draft.code = normalizeFlightCode(flightCodeMatch[1]);
    matchedFields.push("code");
  }

  const airportCodes = [...text.matchAll(/\b([A-Z]{3})\b/g)]
    .map((match) => match[1].toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));
  if (airportCodes.length >= 2) {
    draft.departure.code = airportCodes[0];
    draft.arrival.code = airportCodes[1];
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
      /(\u4e0a\u6d77|Shanghai|\u6089\u5c3c|Sydney|\u58a8\u5c14\u672c|Melbourne|\u5317\u4eac|Beijing).{0,18}(\u4e0a\u6d77|Shanghai|\u6089\u5c3c|Sydney|\u58a8\u5c14\u672c|Melbourne|\u5317\u4eac|Beijing)/i,
    );
    if (routeHintMatch) {
      draft.departure.name = routeHintMatch[1].trim();
      draft.arrival.name = routeHintMatch[2].trim();
      matchedFields.push("departure", "arrival");
    }
  }

  const timeMatches = [
    ...text.matchAll(
      /(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2}|\d{1,2}[\/\-.]\d{1,2}\s*\d{1,2}:\d{2})/g,
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

  draft.departure = hydrateLocation(draft.departure);
  draft.arrival = hydrateLocation(draft.arrival);

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

  draft.notes = "Imported from OCR text";

  return finalizeResult({
    draft,
    detectedType: "flight",
    matchedFields,
    warnings,
    normalizedText: text,
  });
}

export function parseImportedText(rawText: string): ImportParseResult | null {
  const text = preprocessImportedText(rawText);
  if (!text) {
    return null;
  }

  const looksLikeTrain =
    /(?:\u62a5\u9500\u51ed\u8bc1|\u94c1\u8def|\u4e8c\u7b49\u5ea7|\u4e00\u7b49\u5ea7|\u5546\u52a1\u5ea7|\u8f66\u6b21|\u8f66\u7968|\u9ad8\u94c1|\u52a8\u8f66|[GDKCZ]\d{1,4})/i.test(
      text,
    );

  return looksLikeTrain ? parseTrain(text) : parseFlight(text);
}
