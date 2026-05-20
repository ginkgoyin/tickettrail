import type { TicketDraft, TicketLocation, TicketType } from "../types/ticket";

export interface ImportParseResult {
  draft: TicketDraft;
  detectedType: TicketType;
  matchedFields: string[];
  warnings: string[];
  normalizedText: string;
  confidence: number;
}

export type ImportFieldKey =
  | "carrierName"
  | "code"
  | "departure.name"
  | "departure.code"
  | "departure.timezone"
  | "arrival.name"
  | "arrival.code"
  | "arrival.timezone"
  | "departureTimeLocal"
  | "arrivalTimeLocal"
  | "classInfo"
  | "seatInfo"
  | "notes";

export interface ImportFieldReview {
  field: ImportFieldKey;
  label: string;
  severity: "warning" | "suggestion";
  message: string;
  suggestedValue?: string;
}

interface LocationAlias {
  matcher: RegExp;
  name: string;
  code?: string;
  timezone: string;
}

interface AirlineAlias {
  matcher: RegExp;
  name: string;
}

const currentYear = new Date().getFullYear();

const airportTimezones: Record<string, string> = {
  CAN: "Asia/Shanghai",
  HKG: "Asia/Hong_Kong",
  HND: "Asia/Tokyo",
  MEL: "Australia/Melbourne",
  NRT: "Asia/Tokyo",
  PEK: "Asia/Shanghai",
  PKX: "Asia/Shanghai",
  PVG: "Asia/Shanghai",
  SHA: "Asia/Shanghai",
  SIN: "Asia/Singapore",
  SYD: "Australia/Sydney",
  SZX: "Asia/Shanghai",
};

const locationAliases: LocationAlias[] = [
  { matcher: /(?:\u4e0a\u6d77\u6d66\u4e1c(?:\u673a\u573a)?|shanghai pudong|pudong|pvg)/i, name: "\u4e0a\u6d77\u6d66\u4e1c", code: "PVG", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u4e0a\u6d77\u8679\u6865(?:\u673a\u573a)?|shanghai hongqiao airport|sha)/i, name: "\u4e0a\u6d77\u8679\u6865\u673a\u573a", code: "SHA", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u4e0a\u6d77\u8679\u6865\u7ad9|shanghai hongqiao station)/i, name: "\u4e0a\u6d77\u8679\u6865\u7ad9", code: "SHH", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6089\u5c3c|sydney|syd)/i, name: "\u6089\u5c3c", code: "SYD", timezone: "Australia/Sydney" },
  { matcher: /(?:\u58a8\u5c14\u672c|melbourne|mel)/i, name: "\u58a8\u5c14\u672c", code: "MEL", timezone: "Australia/Melbourne" },
  { matcher: /(?:\u5317\u4eac\u9996\u90fd|beijing capital|pek)/i, name: "\u5317\u4eac\u9996\u90fd", code: "PEK", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5317\u4eac\u5927\u5174|beijing daxing|pkx)/i, name: "\u5317\u4eac\u5927\u5174", code: "PKX", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5e7f\u5dde\u767d\u4e91|guangzhou baiyun|guangzhou|can)/i, name: "\u5e7f\u5dde", code: "CAN", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u6df1\u5733\u5b9d\u5b89|shenzhen baoan|shenzhen|szx)/i, name: "\u6df1\u5733", code: "SZX", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u9999\u6e2f|hong kong|hkg)/i, name: "\u9999\u6e2f", code: "HKG", timezone: "Asia/Hong_Kong" },
  { matcher: /(?:\u4e1c\u4eac|\u6210\u7530|tokyo|narita|nrt)/i, name: "\u4e1c\u4eac", code: "NRT", timezone: "Asia/Tokyo" },
  { matcher: /(?:\u65b0\u52a0\u5761|singapore|sin)/i, name: "\u65b0\u52a0\u5761", code: "SIN", timezone: "Asia/Singapore" },
  { matcher: /(?:\u5357\u4eac\u5357\u7ad9|nanjing south)/i, name: "\u5357\u4eac\u5357\u7ad9", code: "NKH", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u91cd\u5e86\u4e1c\u7ad9|chongqingdong|chongqing east)/i, name: "\u91cd\u5e86\u4e1c\u7ad9", code: "CQD", timezone: "Asia/Shanghai" },
  { matcher: /(?:\u5f20\u5bb6\u754c\u897f\u7ad9|zhangjiajiexi|zhangjiajie west)/i, name: "\u5f20\u5bb6\u754c\u897f\u7ad9", code: "ZJE", timezone: "Asia/Shanghai" },
];

const airlineMappings: AirlineAlias[] = [
  { matcher: /(?:china eastern|\u4e1c\u65b9\u822a\u7a7a|\u4e1c\u822a|(?<![a-z])mu\d{0,4}\b)/i, name: "China Eastern" },
  { matcher: /(?:china southern|\u5357\u65b9\u822a\u7a7a|\u5357\u822a|(?<![a-z])cz\d{0,4}\b)/i, name: "China Southern" },
  { matcher: /(?:air china|\u56fd\u822a|(?<![a-z])ca\d{0,4}\b)/i, name: "Air China" },
  { matcher: /(?:hainan airlines|\u6d77\u5357\u822a\u7a7a|\u6d77\u822a|(?<![a-z])hu\d{0,4}\b)/i, name: "Hainan Airlines" },
  { matcher: /(?:spring airlines|\u6625\u79cb\u822a\u7a7a|(?<![a-z])9c\d{0,4}\b)/i, name: "Spring Airlines" },
  { matcher: /(?:xiamen airlines|\u53a6\u95e8\u822a\u7a7a|\u53a6\u822a|(?<![a-z])mf\d{0,4}\b)/i, name: "XiamenAir" },
  { matcher: /(?:cathay pacific|\u56fd\u6cf0\u822a\u7a7a|(?<![a-z])cx\d{0,4}\b)/i, name: "Cathay Pacific" },
  { matcher: /(?:qantas|(?<![a-z])qf\d{0,4}\b)/i, name: "Qantas" },
  { matcher: /(?:virgin australia|(?<![a-z])va\d{0,4}\b)/i, name: "Virgin Australia" },
  { matcher: /(?:shanghai airlines|\u4e0a\u6d77\u822a\u7a7a|(?<![a-z])fm\d{0,4}\b)/i, name: "Shanghai Airlines" },
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
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

function replaceFullwidth(text: string) {
  return text
    .replace(/\u3000/g, " ")
    .replace(/\uff08/g, "(")
    .replace(/\uff09/g, ")")
    .replace(/\uff1a/g, ":")
    .replace(/\uff0e/g, ".")
    .replace(/\uff0d/g, "-")
    .replace(/\uff0f/g, "/")
    .replace(/\uff5c/g, "|");
}

function normalizeCodeSpacing(text: string) {
  return text
    .replace(/([A-Z]{2})\s+(\d{2,4})/g, "$1$2")
    .replace(/\b([GDCZKT])\s+(\d{1,4})\b/gi, "$1$2")
    .replace(/([0-9]{1,2})\s*\u8f66\s*([0-9A-Z]{1,4})\s*\u53f7/g, "$1\u8f66 $2\u53f7");
}

function normalizeOcrDigits(text: string) {
  return text
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)O\b/g, "0")
    .replace(/\bI(?=\d)/g, "1")
    .replace(/(?<=\d)I\b/g, "1")
    .replace(/(?<=\d)l(?=\d)/g, "1")
    .replace(/(?<=\d)B(?=\d)/g, "8")
    .replace(/(?<=\d)S(?=\d)/g, "5")
    .replace(/\bPE0\b/g, "PEK")
    .replace(/\bPVO\b/g, "PVG")
    .replace(/\bSYO\b/g, "SYD");
}

function normalizeCommonTicketWords(text: string) {
  return text
    .replace(/chongqingdong/gi, "\u91cd\u5e86\u4e1c\u7ad9")
    .replace(/zhangjiajiexi/gi, "\u5f20\u5bb6\u754c\u897f\u7ad9")
    .replace(/shanghai pudong/gi, "\u4e0a\u6d77\u6d66\u4e1c")
    .replace(/shanghai hongqiao station/gi, "\u4e0a\u6d77\u8679\u6865\u7ad9")
    .replace(/shanghai hongqiao airport/gi, "\u4e0a\u6d77\u8679\u6865\u673a\u573a")
    .replace(/beijing daxing/gi, "\u5317\u4eac\u5927\u5174")
    .replace(/beijing capital/gi, "\u5317\u4eac\u9996\u90fd")
    .replace(/china railway/gi, "China Railway")
    .replace(/\u53ea\u4f9b\u62a5\u9500\u4f7f\u7528/g, "\u4ec5\u4f9b\u62a5\u9500\u4f7f\u7528")
    .replace(/\u5f53\u65e5\u5f53\u6b21\u8f66/g, "\u5f53\u65e5\u5f53\u6b21\u8f66");
}

function preprocessImportedText(rawText: string) {
  return normalizeWhitespace(
    normalizeCodeSpacing(normalizeOcrDigits(normalizeCommonTicketWords(replaceFullwidth(rawText)))),
  );
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
  const alias = locationAliases.find(
    (item) => item.matcher.test(location.name) || (!!location.code && item.code === location.code.toUpperCase()),
  );

  if (!alias) {
    return {
      ...location,
      timezone: resolveTimezone(location),
    };
  }

  return {
    ...location,
    name: location.name || alias.name,
    code: location.code || alias.code,
    timezone: alias.timezone,
  };
}

function resolveLocationSuggestion(location: TicketLocation) {
  const alias = locationAliases.find(
    (item) =>
      (location.name && item.matcher.test(location.name)) ||
      (!!location.code && item.code === location.code.toUpperCase()),
  );

  if (!alias) {
    return null;
  }

  return {
    name: alias.name,
    code: alias.code,
    timezone: alias.timezone,
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
  if (code.startsWith("MF")) return "XiamenAir";
  if (code.startsWith("QF")) return "Qantas";
  if (code.startsWith("VA")) return "Virgin Australia";

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

function pushMissingFieldReview(
  reviews: ImportFieldReview[],
  field: ImportFieldKey,
  label: string,
  message: string,
  suggestedValue?: string,
) {
  reviews.push({
    field,
    label,
    severity: suggestedValue ? "suggestion" : "warning",
    message,
    suggestedValue,
  });
}

function detectTicketType(text: string): TicketType {
  const trainScore =
    Number(/\b[GDCKTZ]\d{1,4}\b/i.test(text)) +
    Number(/(?:\u8f66|\u7ad9|\u4e00\u7b49\u5ea7|\u4e8c\u7b49\u5ea7|\u62a5\u9500\u51ed\u8bc1)/.test(text));
  const flightScore =
    Number(/\b[A-Z0-9]{2}\d{2,4}\b/.test(text)) +
    Number(/(?:airport|terminal|boarding|gate|\u822a\u73ed|\u822a\u7a7a|\u673a\u573a)/i.test(text));

  return trainScore >= flightScore ? "train" : "flight";
}

function parseTrain(text: string): ImportParseResult {
  const draft = createDefaultDraft("train");
  const matchedFields: string[] = [];
  const warnings: string[] = [];

  const routePatterns = [
    /([^\s]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))\s*(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4}|T\d{1,4})\s*([^\s]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))/i,
    /([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9)).{0,16}(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4}|T\d{1,4}).{0,16}([^\n\r]{2,20}?(?:\u7ad9|\u4e1c\u7ad9|\u897f\u7ad9|\u5357\u7ad9|\u5317\u7ad9))/i,
  ];
  const routeMatch = routePatterns.map((pattern) => text.match(pattern)).find(Boolean);

  if (routeMatch) {
    draft.departure.name = routeMatch[1].trim();
    draft.code = routeMatch[2].trim().toUpperCase();
    draft.arrival.name = routeMatch[3].trim();
    matchedFields.push("departure", "code", "arrival");
  }

  const departureTimeMatch =
    text.match(/(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2})\s*\u5f00/) ||
    text.match(/(\d{1,2}[\/\-.]\d{1,2}\s*\d{1,2}:\d{2})\s*\u5f00/);
  if (departureTimeMatch) {
    draft.departureTimeLocal = normalizeDateTime(departureTimeMatch[1]);
    matchedFields.push("departureTimeLocal");
  }

  const carMatch = text.match(/(\d{1,2})\s*\u8f66/);
  const seatNumberMatch = text.match(/([0-9A-Z]{1,4})\s*\u53f7/);
  const classMatch = text.match(
    /(\u5546\u52a1\u5ea7|\u7279\u7b49\u5ea7|\u4e00\u7b49\u5ea7|\u4e8c\u7b49\u5ea7|\u8f6f\u5367|\u786c\u5367|\u786c\u5ea7|\u65e0\u5ea7)/,
  );
  if (carMatch || seatNumberMatch) {
    draft.seatInfo = [carMatch ? `${carMatch[1]}\u8f66` : "", seatNumberMatch ? `${seatNumberMatch[1]}\u53f7` : ""]
      .filter(Boolean)
      .join(" ")
      .trim();
    matchedFields.push("seatInfo");
  }
  if (classMatch) {
    draft.classInfo = classMatch[1];
    matchedFields.push("classInfo");
  }

  const amountMatch = text.match(/[\u00a5\\]?(\d+(?:\.\d{1,2})?)\u5143?/);
  const certificate = /\u62a5\u9500\u51ed\u8bc1/.test(text);
  const reimbursementOnly = /\u4ec5\u4f9b\u62a5\u9500\u4f7f\u7528/.test(text);
  const dayOnly = /\u5f53\u65e5\u5f53\u6b21\u8f66/.test(text);
  const noteParts = [
    certificate ? "\u9ad8\u94c1\u62a5\u9500\u51ed\u8bc1" : "",
    reimbursementOnly ? "\u4ec5\u4f9b\u62a5\u9500\u4f7f\u7528" : "",
    dayOnly ? "\u9650\u4e58\u5f53\u65e5\u5f53\u6b21\u8f66" : "",
    amountMatch ? `\u7968\u4ef7\u00a5${amountMatch[1]}` : "",
  ].filter(Boolean);
  draft.notes = noteParts.length ? noteParts.join(" | ") : "Imported from OCR text";

  draft.carrierName = "China Railway";
  draft.departure = hydrateLocation(draft.departure);
  draft.arrival = hydrateLocation(draft.arrival);

  if (!draft.arrival.name) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5230\u8fbe\u7ad9\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.departureTimeLocal) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5f00\u8f66\u65f6\u95f4\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.seatInfo) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u8f66\u5382\u6216\u5ea7\u4f4d\u53f7\uff0c\u53ef\u4ee5\u624b\u52a8\u8865\u5145\u3002");
  }

  return finalizeResult({
    draft,
    detectedType: "train",
    matchedFields,
    warnings,
    normalizedText: text,
  });
}

function findAirportsOrCities(text: string) {
  const matches = locationAliases.filter((alias) => alias.matcher.test(text));
  const unique = matches.filter(
    (item, index) => index === matches.findIndex((candidate) => candidate.name === item.name && candidate.code === item.code),
  );
  return unique.slice(0, 2);
}

function parseFlight(text: string): ImportParseResult {
  const draft = createDefaultDraft("flight");
  const matchedFields: string[] = [];
  const warnings: string[] = [];

  const flightCodeMatch = text.match(/\b([A-Z0-9]{2}\d{2,4})\b/);
  if (flightCodeMatch) {
    draft.code = normalizeFlightCode(flightCodeMatch[1]);
    matchedFields.push("code");
  }

  const airlineName = pickAirlineName(text, draft.code);
  if (airlineName) {
    draft.carrierName = airlineName;
    matchedFields.push("carrierName");
  }

  const routeArrowMatch =
    text.match(/([A-Z]{3})\s*(?:-|->|\u2192|\u2194)\s*([A-Z]{3})/) ||
    text.match(/([A-Za-z ]{3,30}|\p{Script=Han}{2,20})\s*(?:-|->|\u2192|\u2194)\s*([A-Za-z ]{3,30}|\p{Script=Han}{2,20})/u);
  if (routeArrowMatch) {
    draft.departure.name = routeArrowMatch[1].trim();
    draft.arrival.name = routeArrowMatch[2].trim();
    if (/^[A-Z]{3}$/.test(draft.departure.name)) {
      draft.departure.code = draft.departure.name;
      draft.departure.name = "";
    }
    if (/^[A-Z]{3}$/.test(draft.arrival.name)) {
      draft.arrival.code = draft.arrival.name;
      draft.arrival.name = "";
    }
    matchedFields.push("departure", "arrival");
  } else {
    const locations = findAirportsOrCities(text);
    if (locations[0]) {
      draft.departure.name = locations[0].name;
      draft.departure.code = locations[0].code;
      matchedFields.push("departure");
    }
    if (locations[1]) {
      draft.arrival.name = locations[1].name;
      draft.arrival.code = locations[1].code;
      matchedFields.push("arrival");
    }
  }

  const fullDateMatches = Array.from(
    text.matchAll(/(\d{4}[\u5e74/\-.]\d{1,2}[\u6708/\-.]\d{1,2}(?:\u65e5|\u53f7)?\s*\d{1,2}:\d{2})/g),
  );
  if (fullDateMatches[0]) {
    draft.departureTimeLocal = normalizeDateTime(fullDateMatches[0][1]);
    matchedFields.push("departureTimeLocal");
  }
  if (fullDateMatches[1]) {
    draft.arrivalTimeLocal = normalizeDateTime(fullDateMatches[1][1]);
    matchedFields.push("arrivalTimeLocal");
  }

  if (!draft.departureTimeLocal) {
    const timeMatches = Array.from(text.matchAll(/\b(\d{1,2}:\d{2})\b/g)).map((match) => match[1]);
    if (timeMatches[0]) {
      draft.departureTimeLocal = `${String(currentYear)}-01-01T${timeMatches[0]}`;
      matchedFields.push("departureTimeLocal");
      warnings.push("\u53ea\u8bc6\u522b\u5230\u65f6\u95f4\uff0c\u65e5\u671f\u9700\u8981\u624b\u52a8\u4fee\u6b63\u3002");
    }
    if (timeMatches[1]) {
      draft.arrivalTimeLocal = `${String(currentYear)}-01-01T${timeMatches[1]}`;
      matchedFields.push("arrivalTimeLocal");
    }
  }

  const seatMatch = text.match(/(?:seat|\u5ea7\u4f4d)\s*[: ]?\s*([0-9]{1,2}[A-Z])/i);
  if (seatMatch) {
    draft.seatInfo = seatMatch[1].toUpperCase();
    matchedFields.push("seatInfo");
  }

  const cabinMatch = text.match(
    /(\u5934\u7b49\u8231|\u516c\u52a1\u8231|\u8d85\u7ea7\u7ecf\u6d4e\u8231|\u7ecf\u6d4e\u8231|first class|business|premium economy|economy)/i,
  );
  if (cabinMatch) {
    draft.classInfo = cabinMatch[1];
    matchedFields.push("classInfo");
  }

  const gateMatch = text.match(/(?:gate|\u767b\u673a\u53e3)\s*[: ]?\s*([A-Z]?\d{1,2})/i);
  const terminalMatch = text.match(/(?:terminal|t)\s*([1-9])/i);
  const noteParts = [
    gateMatch ? `Gate ${gateMatch[1].toUpperCase()}` : "",
    terminalMatch ? `T${terminalMatch[1]}` : "",
  ].filter(Boolean);
  draft.notes = noteParts.length ? noteParts.join(" | ") : "Imported from OCR text";

  draft.departure = hydrateLocation(draft.departure);
  draft.arrival = hydrateLocation(draft.arrival);

  if (!draft.carrierName) {
    warnings.push("\u672a\u786e\u5b9a\u822a\u7a7a\u516c\u53f8\uff0c\u53ef\u4ee5\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.arrival.name && !draft.arrival.code) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u5230\u8fbe\u673a\u573a\u6216\u57ce\u5e02\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }
  if (!draft.departureTimeLocal) {
    warnings.push("\u672a\u8bc6\u522b\u5230\u822a\u73ed\u65e5\u671f\u65f6\u95f4\uff0c\u9700\u8981\u624b\u52a8\u8865\u5145\u3002");
  }

  return finalizeResult({
    draft,
    detectedType: "flight",
    matchedFields,
    warnings,
    normalizedText: text,
  });
}

export function parseImportedText(rawText: string): ImportParseResult | null {
  const normalizedText = preprocessImportedText(rawText);
  if (!normalizedText) {
    return null;
  }

  const detectedType = detectTicketType(normalizedText);
  return detectedType === "train" ? parseTrain(normalizedText) : parseFlight(normalizedText);
}

export function reviewImportedDraft(result: ImportParseResult): ImportFieldReview[] {
  const { draft, detectedType } = result;
  const reviews: ImportFieldReview[] = [];
  const departureSuggestion = resolveLocationSuggestion(draft.departure);
  const arrivalSuggestion = resolveLocationSuggestion(draft.arrival);
  const carrierSuggestion = !draft.carrierName ? pickAirlineName(result.normalizedText, draft.code) : "";

  if (!draft.code) {
    pushMissingFieldReview(reviews, "code", detectedType === "train" ? "车次" : "航班号", "未识别到主编号。");
  } else if (detectedType === "train" && !/^[GDCKTZ]\d{1,4}$/i.test(draft.code)) {
    pushMissingFieldReview(reviews, "code", "车次", "当前车次格式看起来不太像标准高铁/列车车次。");
  } else if (detectedType === "flight" && !/^[A-Z0-9]{2}\d{2,4}$/i.test(draft.code)) {
    pushMissingFieldReview(reviews, "code", "航班号", "当前航班号格式可能有误，建议检查字母和数字。");
  }

  if (!draft.carrierName) {
    pushMissingFieldReview(
      reviews,
      "carrierName",
      "承运方",
      detectedType === "train" ? "建议补充铁路承运方。" : "未识别到航空公司。",
      carrierSuggestion || (detectedType === "train" ? "China Railway" : undefined),
    );
  }

  if (!draft.departure.name) {
    pushMissingFieldReview(
      reviews,
      "departure.name",
      "出发地",
      "未识别到出发地名称。",
      departureSuggestion?.name,
    );
  }
  if (!draft.arrival.name) {
    pushMissingFieldReview(
      reviews,
      "arrival.name",
      "到达地",
      "未识别到到达地名称。",
      arrivalSuggestion?.name,
    );
  }
  if (!draft.departure.code && departureSuggestion?.code) {
    pushMissingFieldReview(reviews, "departure.code", "出发代码", "可以补充更标准的地点代码。", departureSuggestion.code);
  }
  if (!draft.arrival.code && arrivalSuggestion?.code) {
    pushMissingFieldReview(reviews, "arrival.code", "到达代码", "可以补充更标准的地点代码。", arrivalSuggestion.code);
  }
  if (departureSuggestion?.timezone && draft.departure.timezone !== departureSuggestion.timezone) {
    pushMissingFieldReview(
      reviews,
      "departure.timezone",
      "出发时区",
      "当前出发时区和地点不太一致。",
      departureSuggestion.timezone,
    );
  }
  if (arrivalSuggestion?.timezone && draft.arrival.timezone !== arrivalSuggestion.timezone) {
    pushMissingFieldReview(
      reviews,
      "arrival.timezone",
      "到达时区",
      "当前到达时区和地点不太一致。",
      arrivalSuggestion.timezone,
    );
  }

  if (!draft.departureTimeLocal) {
    pushMissingFieldReview(reviews, "departureTimeLocal", "出发时间", "未识别到出发时间。");
  } else if (/^\d{4}-01-01T\d{2}:\d{2}$/.test(draft.departureTimeLocal)) {
    pushMissingFieldReview(
      reviews,
      "departureTimeLocal",
      "出发时间",
      "当前只识别到了时间，日期可能需要手动修正。",
    );
  }

  if (detectedType === "flight" && !draft.arrivalTimeLocal) {
    pushMissingFieldReview(reviews, "arrivalTimeLocal", "到达时间", "未识别到到达时间。");
  }

  if (detectedType === "train" && !draft.classInfo) {
    pushMissingFieldReview(reviews, "classInfo", "座席类型", "未识别到座席类型。");
  }
  if (!draft.seatInfo) {
    pushMissingFieldReview(
      reviews,
      "seatInfo",
      detectedType === "train" ? "车厢/座位" : "座位号",
      detectedType === "train" ? "未识别到车厢或座位号。" : "未识别到座位号。",
    );
  }

  return reviews;
}
