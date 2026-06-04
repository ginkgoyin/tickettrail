export interface FlightLookupRequest {
  flightNumber: string;
  departureDate: string;
}

export interface FlightLookupLocation {
  name: string;
  code: string;
  timezone: string;
}

export interface FlightLookupCandidate {
  id: string;
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
}

const MOCK_PROVIDER_LABEL = "Mock flight lookup";
const MOCK_SOURCE_NOTE =
  "Phase 1 scaffold only. This result is generated from a local mock provider and should be reviewed before saving.";

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
    },
  ],
};

function normalizeFlightNumber(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

function combineDateAndTime(date: string, time: string) {
  return `${date}T${time}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function lookupFlightCandidates(
  request: FlightLookupRequest,
): Promise<FlightLookupCandidate[]> {
  const normalizedFlightNumber = normalizeFlightNumber(request.flightNumber);
  const departureDate = request.departureDate.trim();

  if (!normalizedFlightNumber || !isIsoDate(departureDate)) {
    return [];
  }

  const templates = MOCK_FLIGHTS[normalizedFlightNumber] ?? [];

  return templates.map((template, index) => ({
    id: `${normalizedFlightNumber}-${departureDate}-${index}`,
    providerLabel: MOCK_PROVIDER_LABEL,
    sourceNote: MOCK_SOURCE_NOTE,
    carrierName: template.carrierName,
    code: template.code,
    departure: template.departure,
    arrival: template.arrival,
    departureTerminal: template.departureTerminal,
    arrivalTerminal: template.arrivalTerminal,
    departureTimeLocal: combineDateAndTime(departureDate, template.departureTime),
    arrivalTimeLocal: combineDateAndTime(departureDate, template.arrivalTime),
  }));
}
