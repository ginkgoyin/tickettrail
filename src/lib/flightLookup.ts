import { invoke } from "@tauri-apps/api/core";

export interface FlightLookupRequest {
  flightNumber: string;
  departureDate: string;
}

export type FlightDataSourceProvider = "mock" | "aerodatabox";

export interface FlightDataSourceConfig {
  provider: FlightDataSourceProvider;
  apiKey?: string;
  updatedAt?: string;
}

export interface FlightLookupLocation {
  name: string;
  code: string;
  timezone: string;
}

export interface FlightLookupCandidate {
  id: string;
  provider?: string;
  providerLabel: string;
  sourceNote: string;
  carrierName: string;
  code: string;
  departure: FlightLookupLocation;
  arrival: FlightLookupLocation;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  aircraft?: string;
  flightStatus?: string;
  confidence?: string;
}

export type FlightLookupErrorCode =
  | "missing_provider_configuration"
  | "missing_api_key"
  | "provider_unauthorized"
  | "rate_limited"
  | "no_results"
  | "network_error"
  | "provider_response_parse_error"
  | "unsupported_provider";

export interface FlightLookupErrorPayload {
  code: FlightLookupErrorCode;
  message: string;
  provider?: string;
  retryable: boolean;
  details?: string;
}

const FLIGHT_DATA_SOURCE_CONFIG_STORAGE_KEY = "tickettrail.flight-data-source-config";

interface FlightLookupTauriRequest {
  flightNumber: string;
  date: string;
  provider: "aerodatabox";
  locale?: string;
  departureAirportHint?: string;
  arrivalAirportHint?: string;
  countryHint?: string;
}

interface FlightDataSourceConfigPayload {
  provider: string;
  apiKey?: string;
  updatedAt?: string;
}

interface MockFlightTemplate {
  carrierName: string;
  code: string;
  departure: FlightLookupLocation;
  arrival: FlightLookupLocation;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTime: string;
  arrivalTime: string;
  aircraft?: string;
  flightStatus?: string;
  confidence?: string;
}

const MOCK_PROVIDER = "aerodatabox";
const MOCK_PROVIDER_LABEL = "AeroDataBox mock via Tauri";
const MOCK_SOURCE_NOTE =
  "Phase A mock command only. This result is generated locally through the Tauri boundary and should be reviewed before saving.";

const BROWSER_FALLBACK_PROVIDER_LABEL = "Mock flight lookup";
const BROWSER_FALLBACK_SOURCE_NOTE =
  "Fallback local mock only. This result is generated in the frontend because the Tauri lookup boundary is unavailable.";

const MOCK_FLIGHTS: Record<string, MockFlightTemplate[]> = {
  MF802: [
    {
      carrierName: "XiamenAir",
      code: "MF802",
      departure: {
        name: "Sydney Kingsford Smith Airport",
        code: "SYD",
        timezone: "Australia/Sydney",
      },
      arrival: {
        name: "Xiamen Gaoqi International Airport",
        code: "XMN",
        timezone: "Asia/Shanghai",
      },
      departureTerminal: "T1",
      arrivalTerminal: "T3",
      departureTime: "11:25",
      arrivalTime: "19:40",
      aircraft: "Boeing 787-9",
      flightStatus: "scheduled",
      confidence: "high",
    },
  ],
  MU562: [
    {
      carrierName: "China Eastern",
      code: "MU562",
      departure: {
        name: "Sydney Kingsford Smith Airport",
        code: "SYD",
        timezone: "Australia/Sydney",
      },
      arrival: {
        name: "Shanghai Pudong International Airport",
        code: "PVG",
        timezone: "Asia/Shanghai",
      },
      departureTerminal: "T1",
      arrivalTerminal: "T1",
      departureTime: "12:10",
      arrivalTime: "20:35",
      aircraft: "Airbus A330-200",
      flightStatus: "scheduled",
      confidence: "high",
    },
  ],
  CZ326: [
    {
      carrierName: "China Southern",
      code: "CZ326",
      departure: {
        name: "Sydney Kingsford Smith Airport",
        code: "SYD",
        timezone: "Australia/Sydney",
      },
      arrival: {
        name: "Guangzhou Baiyun International Airport",
        code: "CAN",
        timezone: "Asia/Shanghai",
      },
      departureTerminal: "T1",
      arrivalTerminal: "T2",
      departureTime: "10:45",
      arrivalTime: "18:20",
      aircraft: "Boeing 787-8",
      flightStatus: "scheduled",
      confidence: "high",
    },
  ],
  QF127: [
    {
      carrierName: "Qantas",
      code: "QF127",
      departure: {
        name: "Sydney Kingsford Smith Airport",
        code: "SYD",
        timezone: "Australia/Sydney",
      },
      arrival: {
        name: "Hong Kong International Airport",
        code: "HKG",
        timezone: "Asia/Hong_Kong",
      },
      departureTerminal: "T1",
      arrivalTerminal: "T1",
      departureTime: "09:30",
      arrivalTime: "16:10",
      aircraft: "Airbus A330-300",
      flightStatus: "scheduled",
      confidence: "high",
    },
  ],
};

function normalizeFlightNumber(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

function normalizeProvider(value: string | null | undefined): FlightDataSourceProvider {
  return value?.trim().toLowerCase() === "aerodatabox" ? "aerodatabox" : "mock";
}

function combineDateAndTime(date: string, time: string) {
  return `${date}T${time}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeFlightDataSourceConfig(
  config: Partial<FlightDataSourceConfigPayload> | null | undefined,
): FlightDataSourceConfig {
  return {
    provider: normalizeProvider(config?.provider),
    apiKey: config?.apiKey?.trim() || undefined,
    updatedAt: config?.updatedAt || undefined,
  };
}

function buildFlightDataSourceConfigPayload(
  config: FlightDataSourceConfig,
): FlightDataSourceConfigPayload {
  return {
    provider: config.provider,
    apiKey: config.apiKey?.trim() || undefined,
    updatedAt: config.updatedAt,
  };
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function getFlightDataSourceConfigFromLocalStorage(): FlightDataSourceConfig {
  if (!canUseLocalStorage()) {
    return { provider: "mock" };
  }

  try {
    const rawValue = window.localStorage.getItem(FLIGHT_DATA_SOURCE_CONFIG_STORAGE_KEY);
    if (!rawValue) {
      return { provider: "mock" };
    }

    return normalizeFlightDataSourceConfig(
      JSON.parse(rawValue) as Partial<FlightDataSourceConfigPayload>,
    );
  } catch {
    return { provider: "mock" };
  }
}

function saveFlightDataSourceConfigToLocalStorage(
  config: FlightDataSourceConfig,
): FlightDataSourceConfig {
  const normalized = {
    ...normalizeFlightDataSourceConfig(config),
    updatedAt: new Date().toISOString(),
  };

  if (canUseLocalStorage()) {
    window.localStorage.setItem(
      FLIGHT_DATA_SOURCE_CONFIG_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  }

  return normalized;
}

function buildTauriRequest(request: FlightLookupRequest): FlightLookupTauriRequest {
  return {
    flightNumber: request.flightNumber,
    date: request.departureDate,
    provider: "aerodatabox",
  };
}

function isStructuredLookupError(value: unknown): value is FlightLookupErrorPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeError = value as Partial<FlightLookupErrorPayload>;
  return typeof maybeError.code === "string" && typeof maybeError.message === "string";
}

async function lookupViaTauri(
  request: FlightLookupRequest,
): Promise<FlightLookupCandidate[] | null> {
  try {
    return await invoke<FlightLookupCandidate[]>("lookup_flight_candidates", {
      request: buildTauriRequest(request),
    });
  } catch (error) {
    if (isStructuredLookupError(error)) {
      if (error.code === "no_results") {
        return [];
      }
      if (error.code === "unsupported_provider") {
        return null;
      }
    }

    return null;
  }
}

export async function getFlightDataSourceConfig(): Promise<FlightDataSourceConfig> {
  try {
    const config = await invoke<FlightDataSourceConfigPayload>("get_flight_data_source_config");
    return normalizeFlightDataSourceConfig(config);
  } catch {
    return getFlightDataSourceConfigFromLocalStorage();
  }
}

export async function saveFlightDataSourceConfig(
  config: FlightDataSourceConfig,
): Promise<FlightDataSourceConfig> {
  try {
    const savedConfig = await invoke<FlightDataSourceConfigPayload>(
      "save_flight_data_source_config",
      {
        config: buildFlightDataSourceConfigPayload(config),
      },
    );
    return normalizeFlightDataSourceConfig(savedConfig);
  } catch {
    return saveFlightDataSourceConfigToLocalStorage(config);
  }
}

function lookupViaLocalFallback(request: FlightLookupRequest): FlightLookupCandidate[] {
  const normalizedFlightNumber = normalizeFlightNumber(request.flightNumber);
  const departureDate = request.departureDate.trim();

  if (!normalizedFlightNumber || !isIsoDate(departureDate)) {
    return [];
  }

  const templates = MOCK_FLIGHTS[normalizedFlightNumber] ?? [];

  return templates.map((template, index) => ({
    id: `${normalizedFlightNumber}-${departureDate}-${index}`,
    provider: MOCK_PROVIDER,
    providerLabel: BROWSER_FALLBACK_PROVIDER_LABEL,
    sourceNote: BROWSER_FALLBACK_SOURCE_NOTE,
    carrierName: template.carrierName,
    code: template.code,
    departure: template.departure,
    arrival: template.arrival,
    departureTerminal: template.departureTerminal,
    arrivalTerminal: template.arrivalTerminal,
    departureTimeLocal: combineDateAndTime(departureDate, template.departureTime),
    arrivalTimeLocal: combineDateAndTime(departureDate, template.arrivalTime),
    aircraft: template.aircraft,
    flightStatus: template.flightStatus,
    confidence: template.confidence,
  }));
}

export async function lookupFlightCandidates(
  request: FlightLookupRequest,
): Promise<FlightLookupCandidate[]> {
  const normalizedFlightNumber = normalizeFlightNumber(request.flightNumber);
  const departureDate = request.departureDate.trim();

  if (!normalizedFlightNumber || !isIsoDate(departureDate)) {
    return [];
  }

  const tauriCandidates = await lookupViaTauri({
    flightNumber: normalizedFlightNumber,
    departureDate,
  });
  if (tauriCandidates) {
    return tauriCandidates.map((candidate) => ({
      ...candidate,
      provider: candidate.provider ?? MOCK_PROVIDER,
      providerLabel: candidate.providerLabel || MOCK_PROVIDER_LABEL,
      sourceNote: candidate.sourceNote || MOCK_SOURCE_NOTE,
    }));
  }

  return lookupViaLocalFallback({
    flightNumber: normalizedFlightNumber,
    departureDate,
  });
}
