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
  { matcher: /上海|shanghai/i, timezone: "Asia/Shanghai" },
  { matcher: /悉尼|sydney/i, timezone: "Australia/Sydney" },
  { matcher: /墨尔本|melbourne/i, timezone: "Australia/Melbourne" },
  { matcher: /北京|beijing/i, timezone: "Asia/Shanghai" },
  { matcher: /广州|guangzhou/i, timezone: "Asia/Shanghai" },
  { matcher: /深圳|shenzhen/i, timezone: "Asia/Shanghai" },
  { matcher: /东京|tokyo/i, timezone: "Asia/Tokyo" },
  { matcher: /新加坡|singapore/i, timezone: "Asia/Singapore" },
  { matcher: /香港|hong kong/i, timezone: "Asia/Hong_Kong" },
];

const airlineMappings: Array<{ matcher: RegExp; name: string; code?: string }> = [
  { matcher: /china eastern|东方航空|东航/i, name: "China Eastern" },
  { matcher: /china southern|南方航空|南航/i, name: "China Southern" },
  { matcher: /air china|国航/i, name: "Air China" },
  { matcher: /hainan airlines|海南航空|海航/i, name: "Hainan Airlines" },
  { matcher: /spring airlines|春秋航空/i, name: "Spring Airlines" },
  { matcher: /xiamen airlines|厦门航空|厦航/i, name: "XiamenAir" },
  { matcher: /cathay pacific|国泰航空/i, name: "Cathay Pacific" },
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
    /(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})(?:日|号)?\s*(\d{1,2}:\d{2})/,
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
    text.match(/([^\s]{2,20}?(?:站|东站|西站|南站|北站))\s*(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4})\s*([^\s]{2,20}?(?:站|东站|西站|南站|北站))/i) ||
    text.match(/([^\n\r]{2,20}?(?:站|东站|西站|南站|北站)).{0,8}(G\d{1,4}|D\d{1,4}|K\d{1,4}|Z\d{1,4}|C\d{1,4}).{0,8}([^\n\r]{2,20}?(?:站|东站|西站|南站|北站))/i);

  if (routeMatch) {
    draft.departure.name = routeMatch[1].trim();
    draft.code = routeMatch[2].trim().toUpperCase();
    draft.arrival.name = routeMatch[3].trim();
    matchedFields.push("departure", "code", "arrival");
  }

  const departureTimeMatch = text.match(/(\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}(?:日|号)?\s*\d{1,2}:\d{2})\s*开/);
  if (departureTimeMatch) {
    draft.departureTimeLocal = normalizeDateTime(departureTimeMatch[1]);
    matchedFields.push("departureTimeLocal");
  } else {
    const genericDateTime = text.match(/(\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}(?:日|号)?\s*\d{1,2}:\d{2})/);
    if (genericDateTime) {
      draft.departureTimeLocal = normalizeDateTime(genericDateTime[1]);
      matchedFields.push("departureTimeLocal");
    }
  }

  const seatBlock = text.match(/(\d{1,2}\s*车)\s*([0-9A-Z]{1,4}\s*号)?/);
  const classMatch = text.match(/(商务座|一等座|二等座|软卧|硬卧|硬座|无座)/);
  if (seatBlock?.[1] || seatBlock?.[2] || classMatch?.[1]) {
    draft.classInfo = classMatch?.[1] || "";
    draft.seatInfo = [seatBlock?.[1], seatBlock?.[2]].filter(Boolean).join(" ").trim();
    matchedFields.push("classInfo", "seatInfo");
  }

  draft.carrierName = "China Railway";
  draft.departure.timezone = resolveTimezone(draft.departure);
  draft.arrival.timezone = resolveTimezone(draft.arrival);

  if (!draft.arrival.name) {
    warnings.push("未识别到到达站，需要手动补充。");
  }
  if (!draft.departureTimeLocal) {
    warnings.push("未识别到开车时间，需要手动补充。");
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

  const routeArrowMatch = text.match(/([A-Za-z\u4e00-\u9fa5\s]{2,40})\s*(?:->|→|-)\s*([A-Za-z\u4e00-\u9fa5\s]{2,40})/);
  if (routeArrowMatch) {
    draft.departure.name = routeArrowMatch[1].trim();
    draft.arrival.name = routeArrowMatch[2].trim();
    matchedFields.push("departure", "arrival");
  } else {
    const shanghaiSydneyMatch = text.match(/(上海|Shanghai|Sydney|悉尼).{0,12}(上海|Shanghai|Sydney|悉尼)/i);
    if (shanghaiSydneyMatch) {
      draft.departure.name = shanghaiSydneyMatch[1].trim();
      draft.arrival.name = shanghaiSydneyMatch[2].trim();
      matchedFields.push("departure", "arrival");
    }
  }

  const timeMatches = [...text.matchAll(/(\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}(?:日|号)?\s*\d{1,2}:\d{2})/g)].map(
    (match) => normalizeDateTime(match[1]),
  );
  if (timeMatches[0]) {
    draft.departureTimeLocal = timeMatches[0];
    matchedFields.push("departureTimeLocal");
  }
  if (timeMatches[1]) {
    draft.arrivalTimeLocal = timeMatches[1];
    matchedFields.push("arrivalTimeLocal");
  }

  const cabinMatch = text.match(/(First|Business|Premium Economy|Economy|头等舱|商务舱|经济舱)/i);
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
    warnings.push("未识别到航空公司名称，需要手动补充。");
  }
  if (!draft.arrivalTimeLocal) {
    warnings.push("未识别到到达时间，需要手动补充。");
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
    /(报销凭证|铁路|二等座|一等座|商务座|车次|车票|高铁|动车|[GDKCZ]\d{1,4})/i.test(text);

  const result = looksLikeTrain ? parseTrain(rawText) : parseFlight(rawText);
  return result;
}
