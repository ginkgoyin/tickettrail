import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  getFlightLookupErrorMessage,
  lookupFlightCandidates,
  type FlightLookupCandidate,
} from "../lib/flightLookup";
import { useI18n } from "../lib/i18n";
import type { ImportFieldKey, ImportFieldReview } from "../lib/importParser";
import { searchAirlines, searchLocations } from "../lib/ticketService";
import type {
  AirlineDirectoryEntry,
  LocationDirectoryEntry,
  TicketDraft,
  TicketSegmentDraft,
  TicketType,
} from "../types/ticket";

function createDefaultDraft(): TicketDraft {
  return {
    ticketType: "flight",
    carrierName: "",
    code: "",
    departure: {
      name: "",
      code: "",
      timezone: "Asia/Shanghai",
    },
    arrival: {
      name: "",
      code: "",
      timezone: "Australia/Sydney",
    },
    departureTerminal: "",
    arrivalTerminal: "",
    departureTimeLocal: "",
    arrivalTimeLocal: "",
    classInfo: "Economy",
    seatInfo: "",
    notes: "",
    segments: [],
  };
}

function createEmptySegment(seed?: Partial<TicketSegmentDraft>): TicketSegmentDraft {
  return {
    carrierName: seed?.carrierName ?? "",
    code: seed?.code ?? "",
    departure: {
      name: seed?.departure?.name ?? "",
      code: seed?.departure?.code ?? "",
      timezone: seed?.departure?.timezone ?? "Asia/Shanghai",
    },
    arrival: {
      name: seed?.arrival?.name ?? "",
      code: seed?.arrival?.code ?? "",
      timezone: seed?.arrival?.timezone ?? "Asia/Shanghai",
    },
    departureTimeLocal: seed?.departureTimeLocal ?? "",
    arrivalTimeLocal: seed?.arrivalTimeLocal ?? "",
    departureTerminal: seed?.departureTerminal ?? "",
    arrivalTerminal: seed?.arrivalTerminal ?? "",
    classInfo: seed?.classInfo ?? "",
    seatInfo: seed?.seatInfo ?? "",
    notes: seed?.notes ?? "",
  };
}

function cloneDraft(draft: TicketDraft): TicketDraft {
  return {
    ...draft,
    departure: { ...draft.departure },
    arrival: { ...draft.arrival },
    segments: (draft.segments ?? []).map((segment) => ({
      ...segment,
      departure: { ...segment.departure },
      arrival: { ...segment.arrival },
    })),
  };
}

type SuggestField = string | null;

interface TicketFormProps {
  isSaving: boolean;
  mode: "create" | "edit";
  initialDraft?: TicketDraft | null;
  importedDraft?: TicketDraft | null;
  importReview?: ImportFieldReview[] | null;
  onSubmitTicket: (draft: TicketDraft) => Promise<void>;
  onCancelEdit?: () => void;
}

function buildReviewMap(reviews: ImportFieldReview[] | null | undefined) {
  const reviewMap = new Map<ImportFieldKey, ImportFieldReview>();

  for (const review of reviews ?? []) {
    if (!reviewMap.has(review.field)) {
      reviewMap.set(review.field, review);
    }
  }

  return reviewMap;
}

function joinLocationMeta(location: LocationDirectoryEntry) {
  return [location.code || "", location.nameEn || "", location.timezone || ""]
    .filter(Boolean)
    .join(" | ");
}

function buildSegmentRouteLabel(segment: TicketSegmentDraft) {
  return `${segment.departure.name || "Departure"} -> ${segment.arrival.name || "Arrival"}`;
}

function parseDateTime(value: string) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatDateTimeLocal(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getTicketNumberLabel(ticketType: TicketType, flightLabel: string, trainLabel: string) {
  return ticketType === "train" ? trainLabel : flightLabel;
}

function filterLocationsForTicketType(
  locations: LocationDirectoryEntry[],
  ticketType: TicketType,
) {
  return locations.filter((location) =>
    ticketType === "train" ? location.locationType === "station" : location.locationType === "airport",
  );
}

function getLocationNamePlaceholder(ticketType: TicketType, side: "departure" | "arrival") {
  const prefix = side === "departure" ? "Departure" : "Arrival";
  return ticketType === "train" ? `${prefix} station` : `${prefix} airport`;
}

function getLocationCodePlaceholder(ticketType: TicketType) {
  return ticketType === "train" ? "Station code" : "Airport code";
}

function shouldShowTerminalFields(ticketType: TicketType) {
  return ticketType === "flight";
}

function getDateOnly(value: string) {
  return value ? value.slice(0, 10) : "";
}

function describeLookupCandidate(candidate: FlightLookupCandidate) {
  const departureTimeLabel = candidate.departureTimeLocal
    ? candidate.departureTimeLocal.slice(11, 16)
    : "time pending";
  const arrivalTimeLabel = candidate.arrivalTimeLocal
    ? candidate.arrivalTimeLocal.slice(11, 16)
    : "time pending";
  return `${candidate.departure.code} -> ${candidate.arrival.code} · ${departureTimeLabel} - ${arrivalTimeLabel}`;
}

export function TicketForm({
  isSaving,
  mode,
  initialDraft,
  importedDraft,
  importReview,
  onSubmitTicket,
  onCancelEdit,
}: TicketFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<TicketDraft>(createDefaultDraft());
  const [activeSuggestField, setActiveSuggestField] = useState<SuggestField>(null);
  const [airlineSuggestions, setAirlineSuggestions] = useState<AirlineDirectoryEntry[]>([]);
  const [departureSuggestions, setDepartureSuggestions] = useState<LocationDirectoryEntry[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationDirectoryEntry[]>([]);
  const [segmentAirlineSuggestions, setSegmentAirlineSuggestions] = useState<Record<number, AirlineDirectoryEntry[]>>({});
  const [segmentDepartureSuggestions, setSegmentDepartureSuggestions] = useState<Record<number, LocationDirectoryEntry[]>>({});
  const [segmentArrivalSuggestions, setSegmentArrivalSuggestions] = useState<Record<number, LocationDirectoryEntry[]>>({});
  const [flightLookupDate, setFlightLookupDate] = useState("");
  const [flightLookupCandidates, setFlightLookupCandidates] = useState<FlightLookupCandidate[]>([]);
  const [flightLookupBusy, setFlightLookupBusy] = useState(false);
  const [flightLookupMessage, setFlightLookupMessage] = useState("");
  const [segmentLookupDates, setSegmentLookupDates] = useState<Record<number, string>>({});
  const [segmentLookupCandidates, setSegmentLookupCandidates] = useState<Record<number, FlightLookupCandidate[]>>({});
  const [segmentLookupBusy, setSegmentLookupBusy] = useState<Record<number, boolean>>({});
  const [segmentLookupMessages, setSegmentLookupMessages] = useState<Record<number, string>>({});
  const airlineSuggestionCacheRef = useRef(new Map<string, AirlineDirectoryEntry[]>());
  const locationSuggestionCacheRef = useRef(new Map<string, LocationDirectoryEntry[]>());
  const reviewMap = buildReviewMap(mode === "edit" ? null : importReview);

  const mainAirlineQuery = draft.ticketType === "flight" ? draft.carrierName.trim() : "";
  const segmentAirlineQueries = useMemo(
    () =>
      (draft.segments ?? []).map((segment) =>
        draft.ticketType === "flight" ? segment.carrierName.trim() : "",
      ),
    [draft.segments, draft.ticketType],
  );
  const mainDepartureQuery = (draft.departure.name || draft.departure.code || "").trim();
  const mainArrivalQuery = (draft.arrival.name || draft.arrival.code || "").trim();
  const segmentLocationQueries = useMemo(
    () =>
      (draft.segments ?? []).map((segment) => ({
        departure: (segment.departure.name || segment.departure.code || "").trim(),
        arrival: (segment.arrival.name || segment.arrival.code || "").trim(),
      })),
    [draft.segments],
  );

  useEffect(() => {
    if (mode === "edit") {
      setDraft(initialDraft ? cloneDraft(initialDraft) : createDefaultDraft());
      setFlightLookupDate(getDateOnly(initialDraft?.departureTimeLocal ?? ""));
      setFlightLookupCandidates([]);
      setFlightLookupMessage("");
      setSegmentLookupDates(
        Object.fromEntries(
          (initialDraft?.segments ?? []).map((segment, index) => [index, getDateOnly(segment.departureTimeLocal)]),
        ),
      );
      setSegmentLookupCandidates({});
      setSegmentLookupBusy({});
      setSegmentLookupMessages({});
      return;
    }

    if (importedDraft) {
      setDraft(cloneDraft(importedDraft));
      setFlightLookupDate(getDateOnly(importedDraft.departureTimeLocal ?? ""));
      setFlightLookupCandidates([]);
      setFlightLookupMessage("");
      setSegmentLookupDates(
        Object.fromEntries(
          (importedDraft.segments ?? []).map((segment, index) => [index, getDateOnly(segment.departureTimeLocal)]),
        ),
      );
      setSegmentLookupCandidates({});
      setSegmentLookupBusy({});
      setSegmentLookupMessages({});
      return;
    }

    setDraft(createDefaultDraft());
    setFlightLookupDate("");
    setFlightLookupCandidates([]);
    setFlightLookupMessage("");
    setSegmentLookupDates({});
    setSegmentLookupCandidates({});
    setSegmentLookupBusy({});
    setSegmentLookupMessages({});
  }, [importedDraft, initialDraft, mode]);

  useEffect(() => {
    if (draft.ticketType !== "flight") {
      setFlightLookupCandidates([]);
      setFlightLookupMessage("");
      setSegmentLookupCandidates({});
      setSegmentLookupMessages({});
      setSegmentLookupBusy({});
    }
  }, [draft.ticketType]);

  useEffect(() => {
    let isMounted = true;

    const resolveAirlineSuggestions = async (query: string) => {
      const trimmed = query.trim();
      if (draft.ticketType !== "flight" || trimmed.length < 1) {
        return [];
      }

      const cacheKey = trimmed.toLowerCase();
      const cached = airlineSuggestionCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const results = await searchAirlines(trimmed);
      airlineSuggestionCacheRef.current.set(cacheKey, results);
      return results;
    };

    const loadAirlineSuggestions = async () => {
      const uniqueQueries = Array.from(
        new Set([mainAirlineQuery, ...segmentAirlineQueries].map((query) => query.trim()).filter(Boolean)),
      );

      const resultsByQuery = new Map<string, AirlineDirectoryEntry[]>();
      await Promise.all(
        uniqueQueries.map(async (query) => {
          try {
            resultsByQuery.set(query, await resolveAirlineSuggestions(query));
          } catch {
            resultsByQuery.set(query, []);
          }
        }),
      );

      if (!isMounted) {
        return;
      }

      setAirlineSuggestions(resultsByQuery.get(mainAirlineQuery) ?? []);
      setSegmentAirlineSuggestions(
        Object.fromEntries(
          segmentAirlineQueries.map((query, index) => [index, resultsByQuery.get(query) ?? []]),
        ),
      );
    };

    void loadAirlineSuggestions();

    return () => {
      isMounted = false;
    };
  }, [draft.ticketType, mainAirlineQuery, segmentAirlineQueries]);

  useEffect(() => {
    let isMounted = true;

    const resolveLocationSuggestions = async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        return [];
      }

      const cacheKey = `${draft.ticketType}:${trimmed.toLowerCase()}`;
      const cached = locationSuggestionCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const results = await searchLocations(trimmed, { ticketType: draft.ticketType });
      locationSuggestionCacheRef.current.set(cacheKey, results);
      return results;
    };

    const loadAllSuggestions = async () => {
      const uniqueQueries = Array.from(
        new Set(
          [mainDepartureQuery, mainArrivalQuery]
            .concat(segmentLocationQueries.flatMap((segment) => [segment.departure, segment.arrival]))
            .map((query) => query.trim())
            .filter(Boolean),
        ),
      );

      const resultsByQuery = new Map<string, LocationDirectoryEntry[]>();
      await Promise.all(
        uniqueQueries.map(async (query) => {
          try {
            resultsByQuery.set(query, await resolveLocationSuggestions(query));
          } catch {
            resultsByQuery.set(query, []);
          }
        }),
      );

      if (!isMounted) {
        return;
      }

      setDepartureSuggestions(
        filterLocationsForTicketType(resultsByQuery.get(mainDepartureQuery) ?? [], draft.ticketType),
      );
      setArrivalSuggestions(
        filterLocationsForTicketType(resultsByQuery.get(mainArrivalQuery) ?? [], draft.ticketType),
      );
      setSegmentDepartureSuggestions(
        Object.fromEntries(
          segmentLocationQueries.map((segment, index) => [
            index,
            filterLocationsForTicketType(resultsByQuery.get(segment.departure) ?? [], draft.ticketType),
          ]),
        ),
      );
      setSegmentArrivalSuggestions(
        Object.fromEntries(
          segmentLocationQueries.map((segment, index) => [
            index,
            filterLocationsForTicketType(resultsByQuery.get(segment.arrival) ?? [], draft.ticketType),
          ]),
        ),
      );
    };

    void loadAllSuggestions();

    return () => {
      isMounted = false;
    };
  }, [draft.ticketType, mainArrivalQuery, mainDepartureQuery, segmentLocationQueries]);

  const updateField = <K extends keyof TicketDraft>(key: K, value: TicketDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateLocationField = (
    side: "departure" | "arrival",
    key: "name" | "code" | "timezone",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      [side]: {
        ...current[side],
        [key]: value,
      },
    }));
  };

  const updateExtraSegment = (
    index: number,
    updater: (segment: TicketSegmentDraft) => TicketSegmentDraft,
  ) => {
    setDraft((current) => ({
      ...current,
      segments: (current.segments ?? []).map((segment, segmentIndex) =>
        segmentIndex === index ? updater(segment) : segment,
      ),
    }));
  };

  const updateExtraSegmentField = <K extends keyof TicketSegmentDraft>(
    index: number,
    key: K,
    value: TicketSegmentDraft[K],
  ) => {
    updateExtraSegment(index, (segment) => ({
      ...segment,
      [key]: value,
    }));
  };

  const updateExtraSegmentLocationField = (
    index: number,
    side: "departure" | "arrival",
    key: "name" | "code" | "timezone",
    value: string,
  ) => {
    updateExtraSegment(index, (segment) => ({
      ...segment,
      [side]: {
        ...segment[side],
        [key]: value,
      },
    }));
  };

  const clearSegmentLookupState = (index: number) => {
    setSegmentLookupCandidates((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    setSegmentLookupMessages((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    setSegmentLookupBusy((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const swapIndexedRecordEntries = <T,>(record: Record<number, T>, left: number, right: number) => {
    const next = { ...record };
    const leftValue = next[left];
    const rightValue = next[right];

    if (typeof rightValue === "undefined") {
      delete next[left];
    } else {
      next[left] = rightValue;
    }

    if (typeof leftValue === "undefined") {
      delete next[right];
    } else {
      next[right] = leftValue;
    }

    return next;
  };

  const handleSwapRoute = () => {
    setDraft((current) => ({
      ...current,
      departure: { ...current.arrival },
      arrival: { ...current.departure },
      departureTimeLocal: current.arrivalTimeLocal,
      arrivalTimeLocal: current.departureTimeLocal,
    }));
    setActiveSuggestField(null);
  };

  const handleAddSegment = () => {
    setDraft((current) => {
      const existingSegments = current.segments ?? [];
      const lastSegment = existingSegments[existingSegments.length - 1];
      const seedSource = lastSegment
        ? {
            carrierName: lastSegment.carrierName,
            classInfo: lastSegment.classInfo,
            departure: { ...lastSegment.arrival },
          }
        : {
            carrierName: current.carrierName,
            classInfo: current.classInfo,
            departure: { ...current.arrival },
          };

      return {
        ...current,
        segments: [
          ...existingSegments,
          createEmptySegment(seedSource),
        ],
      };
    });
    setSegmentLookupDates((current) => ({
      ...current,
      [draft.segments?.length ?? 0]: getDateOnly(draft.arrivalTimeLocal),
    }));
  };

  const handleRemoveSegment = (index: number) => {
    setDraft((current) => ({
      ...current,
      segments: (current.segments ?? []).filter((_, segmentIndex) => segmentIndex !== index),
    }));
    clearSegmentLookupState(index);
    setSegmentLookupDates((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => {
            const numericKey = Number(key);
            return [numericKey > index ? numericKey - 1 : numericKey, value];
          }),
      ),
    );
    setSegmentLookupCandidates((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => {
            const numericKey = Number(key);
            return [numericKey > index ? numericKey - 1 : numericKey, value];
          }),
      ),
    );
    setSegmentLookupMessages((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => {
            const numericKey = Number(key);
            return [numericKey > index ? numericKey - 1 : numericKey, value];
          }),
      ),
    );
    setSegmentLookupBusy((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => Number(key) !== index)
          .map(([key, value]) => {
            const numericKey = Number(key);
            return [numericKey > index ? numericKey - 1 : numericKey, value];
          }),
      ),
    );
  };

  const handleMoveSegment = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const segments = [...(current.segments ?? [])];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= segments.length) {
        return current;
      }

      const [target] = segments.splice(index, 1);
      segments.splice(nextIndex, 0, target);

      return {
        ...current,
        segments,
      };
    });
    setSegmentLookupDates((current) => swapIndexedRecordEntries(current, index, index + direction));
    setSegmentLookupCandidates((current) => swapIndexedRecordEntries(current, index, index + direction));
    setSegmentLookupMessages((current) => swapIndexedRecordEntries(current, index, index + direction));
    setSegmentLookupBusy((current) => swapIndexedRecordEntries(current, index, index + direction));
  };

  const handleInheritPreviousArrival = (index: number) => {
    setDraft((current) => {
      const previousSegment =
        index === 0
          ? {
              arrival: current.arrival,
              arrivalTimeLocal: current.arrivalTimeLocal,
            }
          : {
              arrival: current.segments?.[index - 1]?.arrival ?? current.arrival,
              arrivalTimeLocal: current.segments?.[index - 1]?.arrivalTimeLocal ?? current.arrivalTimeLocal,
            };

      return {
        ...current,
        segments: (current.segments ?? []).map((segment, segmentIndex) =>
          segmentIndex === index
            ? {
                ...segment,
                departure: { ...previousSegment.arrival },
                departureTimeLocal: segment.departureTimeLocal || previousSegment.arrivalTimeLocal,
              }
            : segment,
        ),
      };
    });
  };

  const handleSuggestLayover = (index: number, minutes: number) => {
    setDraft((current) => {
      const previousArrivalTime =
        index === 0
          ? current.arrivalTimeLocal
          : (current.segments?.[index - 1]?.arrivalTimeLocal ?? "");
      const previousTimestamp = parseDateTime(previousArrivalTime);

      if (!previousTimestamp) {
        return current;
      }

      return {
        ...current,
        segments: (current.segments ?? []).map((segment, segmentIndex) =>
          segmentIndex === index
            ? {
                ...segment,
                departureTimeLocal: formatDateTimeLocal(previousTimestamp + minutes * 60_000),
              }
            : segment,
        ),
      };
    });
  };

  const applySuggestedValue = (field: ImportFieldKey, value: string) => {
    switch (field) {
      case "carrierName":
      case "code":
      case "departureTimeLocal":
      case "arrivalTimeLocal":
      case "classInfo":
      case "seatInfo":
      case "notes":
        updateField(field, value);
        return;
      case "departure.name":
        updateLocationField("departure", "name", value);
        return;
      case "departure.code":
        updateLocationField("departure", "code", value);
        return;
      case "departure.timezone":
        updateLocationField("departure", "timezone", value);
        return;
      case "arrival.name":
        updateLocationField("arrival", "name", value);
        return;
      case "arrival.code":
        updateLocationField("arrival", "code", value);
        return;
      case "arrival.timezone":
        updateLocationField("arrival", "timezone", value);
        return;
    }
  };

  const applyAirlineSuggestion = (airline: AirlineDirectoryEntry) => {
    setDraft((current) => ({
      ...current,
      carrierName: airline.nameEn,
    }));
    setActiveSuggestField(null);
  };

  const applyExtraSegmentAirlineSuggestion = (index: number, airline: AirlineDirectoryEntry) => {
    updateExtraSegmentField(index, "carrierName", airline.nameEn);
    setActiveSuggestField(null);
  };

  const applyLocationSuggestion = (
    side: "departure" | "arrival",
    location: LocationDirectoryEntry,
  ) => {
    setDraft((current) => ({
      ...current,
      [side]: {
        name: location.nameZh || location.nameEn || current[side].name,
        code: location.code || current[side].code,
        timezone: location.timezone || current[side].timezone,
      },
    }));
    setActiveSuggestField(null);
  };

  const applyExtraSegmentLocationSuggestion = (
    index: number,
    side: "departure" | "arrival",
    location: LocationDirectoryEntry,
  ) => {
    updateExtraSegment(index, (segment) => ({
      ...segment,
      [side]: {
        name: location.nameZh || location.nameEn || segment[side].name,
        code: location.code || segment[side].code,
        timezone: location.timezone || segment[side].timezone,
      },
    }));
    setActiveSuggestField(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.carrierName || !draft.code || !draft.departure.name || !draft.arrival.name) {
      return;
    }

    void onSubmitTicket(draft).then(() => {
      if (mode === "create") {
        setDraft(createDefaultDraft());
        setFlightLookupDate("");
        setFlightLookupCandidates([]);
        setFlightLookupMessage("");
        setAirlineSuggestions([]);
        setDepartureSuggestions([]);
        setArrivalSuggestions([]);
      }
    });
  };

  const handleLookupFlight = async () => {
    const normalizedDate = flightLookupDate.trim();
    const normalizedFlightNumber = draft.code.trim();

    if (!normalizedFlightNumber || !normalizedDate) {
      setFlightLookupCandidates([]);
      setFlightLookupMessage("Enter a flight number and departure date before looking up a flight.");
      return;
    }

    setFlightLookupBusy(true);
    setFlightLookupMessage("");

    try {
      const candidates = await lookupFlightCandidates({
        flightNumber: normalizedFlightNumber,
        departureDate: normalizedDate,
      });

      setFlightLookupCandidates(candidates);
      setFlightLookupMessage(
        candidates.length
          ? `${candidates.length} flight candidate${candidates.length === 1 ? "" : "s"} found. Review before applying.`
          : "No flight candidates matched this flight number and date.",
      );
    } catch (error) {
      setFlightLookupCandidates([]);
      setFlightLookupMessage(getFlightLookupErrorMessage(error));
    } finally {
      setFlightLookupBusy(false);
    }
  };

  const handleLookupSegmentFlight = async (index: number) => {
    const segment = draft.segments?.[index];
    const normalizedDate = (segmentLookupDates[index] ?? "").trim();
    const normalizedFlightNumber = segment?.code.trim() ?? "";

    if (!segment || !normalizedFlightNumber || !normalizedDate) {
      setSegmentLookupCandidates((current) => ({ ...current, [index]: [] }));
      setSegmentLookupMessages((current) => ({
        ...current,
        [index]: "Enter a flight number and departure date before looking up a flight.",
      }));
      return;
    }

    setSegmentLookupBusy((current) => ({ ...current, [index]: true }));
    setSegmentLookupMessages((current) => ({ ...current, [index]: "" }));

    try {
      const candidates = await lookupFlightCandidates({
        flightNumber: normalizedFlightNumber,
        departureDate: normalizedDate,
      });

      setSegmentLookupCandidates((current) => ({ ...current, [index]: candidates }));
      setSegmentLookupMessages((current) => ({
        ...current,
        [index]: candidates.length
          ? `${candidates.length} flight candidate${candidates.length === 1 ? "" : "s"} found. Review before applying.`
          : "No flight candidates matched this flight number and date.",
      }));
    } catch (error) {
      setSegmentLookupCandidates((current) => ({ ...current, [index]: [] }));
      setSegmentLookupMessages((current) => ({
        ...current,
        [index]: getFlightLookupErrorMessage(error),
      }));
    } finally {
      setSegmentLookupBusy((current) => ({ ...current, [index]: false }));
    }
  };

  const handleApplyFlightLookupCandidate = (candidate: FlightLookupCandidate) => {
    const conflictingFields = [
      ["carrier / operator", draft.carrierName, candidate.carrierName],
      ["flight number", draft.code, candidate.code],
      ["departure", draft.departure.name, candidate.departure.name],
      ["departure code", draft.departure.code ?? "", candidate.departure.code],
      ["departure timezone", draft.departure.timezone, candidate.departure.timezone],
      ["departure terminal", draft.departureTerminal ?? "", candidate.departureTerminal ?? ""],
      ["departure time", draft.departureTimeLocal, candidate.departureTimeLocal],
      ["arrival", draft.arrival.name, candidate.arrival.name],
      ["arrival code", draft.arrival.code ?? "", candidate.arrival.code],
      ["arrival timezone", draft.arrival.timezone, candidate.arrival.timezone],
      ["arrival terminal", draft.arrivalTerminal ?? "", candidate.arrivalTerminal ?? ""],
      ["arrival time", draft.arrivalTimeLocal, candidate.arrivalTimeLocal],
    ].filter(
      ([, currentValue, nextValue]) =>
        currentValue.trim().length > 0 && currentValue.trim() !== nextValue.trim(),
    );

    if (
      conflictingFields.length &&
      !window.confirm(
        `Apply this lookup result and overwrite ${conflictingFields
          .slice(0, 4)
          .map(([label]) => label)
          .join(", ")}${conflictingFields.length > 4 ? ", and more" : ""}?`,
      )
    ) {
      return;
    }

    setDraft((current) => ({
      ...current,
      carrierName: candidate.carrierName,
      code: candidate.code,
      departure: {
        ...current.departure,
        name: candidate.departure.name,
        code: candidate.departure.code,
        timezone: candidate.departure.timezone,
      },
      arrival: {
        ...current.arrival,
        name: candidate.arrival.name,
        code: candidate.arrival.code,
        timezone: candidate.arrival.timezone,
      },
      departureTerminal: candidate.departureTerminal ?? "",
      arrivalTerminal: candidate.arrivalTerminal ?? "",
      departureTimeLocal: candidate.departureTimeLocal,
      arrivalTimeLocal: candidate.arrivalTimeLocal,
    }));
    setFlightLookupMessage(`Applied flight lookup candidate: ${describeLookupCandidate(candidate)}.`);
  };

  const handleApplySegmentFlightLookupCandidate = (index: number, candidate: FlightLookupCandidate) => {
    const segment = draft.segments?.[index];
    if (!segment) {
      return;
    }

    const conflictingFields = [
      ["carrier / operator", segment.carrierName, candidate.carrierName],
      ["flight number", segment.code, candidate.code],
      ["departure", segment.departure.name, candidate.departure.name],
      ["departure code", segment.departure.code ?? "", candidate.departure.code],
      ["departure timezone", segment.departure.timezone, candidate.departure.timezone],
      ["departure terminal", segment.departureTerminal ?? "", candidate.departureTerminal ?? ""],
      ["departure time", segment.departureTimeLocal, candidate.departureTimeLocal],
      ["arrival", segment.arrival.name, candidate.arrival.name],
      ["arrival code", segment.arrival.code ?? "", candidate.arrival.code],
      ["arrival timezone", segment.arrival.timezone, candidate.arrival.timezone],
      ["arrival terminal", segment.arrivalTerminal ?? "", candidate.arrivalTerminal ?? ""],
      ["arrival time", segment.arrivalTimeLocal, candidate.arrivalTimeLocal],
    ].filter(
      ([, currentValue, nextValue]) =>
        currentValue.trim().length > 0 && currentValue.trim() !== nextValue.trim(),
    );

    if (
      conflictingFields.length &&
      !window.confirm(
        `Apply this lookup result to segment ${index + 2} and overwrite ${conflictingFields
          .slice(0, 4)
          .map(([label]) => label)
          .join(", ")}${conflictingFields.length > 4 ? ", and more" : ""}?`,
      )
    ) {
      return;
    }

    updateExtraSegment(index, (currentSegment) => ({
      ...currentSegment,
      carrierName: candidate.carrierName,
      code: candidate.code,
      departure: {
        ...currentSegment.departure,
        name: candidate.departure.name,
        code: candidate.departure.code,
        timezone: candidate.departure.timezone,
      },
      arrival: {
        ...currentSegment.arrival,
        name: candidate.arrival.name,
        code: candidate.arrival.code,
        timezone: candidate.arrival.timezone,
      },
      departureTerminal: candidate.departureTerminal ?? "",
      arrivalTerminal: candidate.arrivalTerminal ?? "",
      departureTimeLocal: candidate.departureTimeLocal,
      arrivalTimeLocal: candidate.arrivalTimeLocal,
    }));
    setSegmentLookupMessages((current) => ({
      ...current,
      [index]: `Applied flight lookup candidate: ${describeLookupCandidate(candidate)}.`,
    }));
  };

  const getLabelClassName = (field: ImportFieldKey) =>
    reviewMap.has(field) ? "field-with-review" : undefined;

  const renderReviewNote = (field: ImportFieldKey) => {
    const review = reviewMap.get(field);
    if (!review) {
      return null;
    }

    return (
      <small className="field-review-note">
        {review.message}
        {review.suggestedValues?.length ? (
          <span className="field-suggestion-list">
            {review.suggestedValues.map((suggestedValue) => (
              <button
                className="field-suggestion-button"
                key={`${field}-${suggestedValue}`}
                onClick={() => applySuggestedValue(field, suggestedValue)}
                type="button"
              >
                {`${t("apply")} ${suggestedValue}`}
              </button>
            ))}
          </span>
        ) : null}
      </small>
    );
  };

  const visibleAirlineSuggestions = useMemo(
    () => (activeSuggestField === "carrierName" ? airlineSuggestions.slice(0, 6) : []),
    [activeSuggestField, airlineSuggestions],
  );
  const visibleDepartureSuggestions = useMemo(
    () => (activeSuggestField === "departure.name" ? departureSuggestions.slice(0, 6) : []),
    [activeSuggestField, departureSuggestions],
  );
  const visibleArrivalSuggestions = useMemo(
    () => (activeSuggestField === "arrival.name" ? arrivalSuggestions.slice(0, 6) : []),
    [activeSuggestField, arrivalSuggestions],
  );
  const locationCodePlaceholder = getLocationCodePlaceholder(draft.ticketType);

  const effectiveSegments = useMemo(
    () => [
      {
        carrierName: draft.carrierName,
        code: draft.code,
        departure: draft.departure,
        arrival: draft.arrival,
        departureTimeLocal: draft.departureTimeLocal,
        arrivalTimeLocal: draft.arrivalTimeLocal,
        classInfo: draft.classInfo,
        seatInfo: draft.seatInfo,
        notes: draft.notes,
      },
      ...(draft.segments ?? []),
    ],
    [draft],
  );
  const routeSummary = useMemo(() => {
    const firstSegment = effectiveSegments[0];
    const lastSegment = effectiveSegments[effectiveSegments.length - 1];

    if (!firstSegment?.departure.name && !lastSegment?.arrival.name) {
      return "Choose departure and arrival to build the route summary.";
    }

    const left = firstSegment.departure.name || firstSegment.departure.code || "Departure";
    const right = lastSegment.arrival.name || lastSegment.arrival.code || "Arrival";
    return `${left} -> ${right}`;
  }, [effectiveSegments]);
  const segmentValidationMessages = useMemo(() => {
    const messages: Array<{ key: string; severity: "warning" | "suggestion"; message: string }> = [];

    effectiveSegments.forEach((segment, index) => {
      const departure = parseDateTime(segment.departureTimeLocal);
      const arrival = parseDateTime(segment.arrivalTimeLocal);

      if (departure && arrival && arrival <= departure) {
        messages.push({
          key: `segment-order-${index}`,
          severity: "warning",
          message: `Segment ${index + 1} arrival time should be after departure time.`,
        });
      }

      if (index > 0) {
        const previousSegment = effectiveSegments[index - 1];
        const previousArrival = parseDateTime(previousSegment.arrivalTimeLocal);
        if (previousArrival && departure) {
          const layoverMinutes = Math.round((departure - previousArrival) / 60000);
          if (layoverMinutes < 0) {
            messages.push({
              key: `segment-overlap-${index}`,
              severity: "warning",
              message: `Segment ${index + 1} starts before segment ${index} arrives.`,
            });
          } else if (layoverMinutes < 30) {
            messages.push({
              key: `segment-tight-${index}`,
              severity: "suggestion",
              message: `Segment ${index + 1} has a tight layover of ${layoverMinutes} minutes.`,
            });
          }
        }

        const currentDepartureKey = (segment.departure.code || segment.departure.name).trim().toLowerCase();
        const previousArrivalKey = (previousSegment.arrival.code || previousSegment.arrival.name).trim().toLowerCase();
        if (currentDepartureKey && previousArrivalKey && currentDepartureKey !== previousArrivalKey) {
          messages.push({
            key: `segment-disconnect-${index}`,
            severity: "warning",
            message: `Segment ${index + 1} departs from a different location than segment ${index} arrives.`,
          });
        }
      }
    });

    return messages;
  }, [effectiveSegments]);

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
        {mode === "create" ? (
          <div className="toggle-group" role="tablist" aria-label="Ticket type">
            {(["flight", "train"] as TicketType[]).map((type) => (
              <button
                key={type}
                className={draft.ticketType === type ? "toggle active" : "toggle"}
                onClick={() => updateField("ticketType", type)}
                type="button"
              >
                {type === "flight" ? t("flights") : t("rail")}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ticket-form-grid">
          <div className="ticket-form-row ticket-form-row-primary">
          <label className={getLabelClassName("carrierName")}>
            {t("carrierOperator")}
            <div className="autocomplete-field">
              <input
                onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                onChange={(event) => updateField("carrierName", event.target.value)}
                onFocus={() => setActiveSuggestField("carrierName")}
                placeholder="China Eastern"
                value={draft.carrierName}
              />
              {visibleAirlineSuggestions.length ? (
                <div className="autocomplete-panel">
                  {visibleAirlineSuggestions.map((airline) => (
                    <button
                      className="autocomplete-option"
                      key={airline.id}
                      onMouseDown={() => applyAirlineSuggestion(airline)}
                      type="button"
                    >
                      <strong>{airline.nameEn}</strong>
                      <span>{`${airline.nameZh || "Airline"} | ${airline.iataCode}`}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("carrierName")}
          </label>

          <label className={getLabelClassName("code")}>
            {getTicketNumberLabel(draft.ticketType, t("flightNo"), t("trainNo"))}
            <input
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="MU561"
              value={draft.code}
            />
            {renderReviewNote("code")}
          </label>
          </div>

          {draft.ticketType === "flight" ? (
            <div className="ticket-form-row ticket-form-row-lookup">
              <label>
                Lookup date
                <input
                  onChange={(event) => setFlightLookupDate(event.target.value)}
                  type="date"
                  value={flightLookupDate}
                />
              </label>

              <div className="flight-lookup-actions">
                <button
                  className="ghost-button"
                  disabled={flightLookupBusy || !draft.code.trim() || !flightLookupDate.trim()}
                  onClick={() => void handleLookupFlight()}
                  type="button"
                >
                  {flightLookupBusy ? "Looking up..." : "Lookup flight"}
                </button>
                <small className="field-directory-note">
                  Lookup uses your saved flight data source setting. Review candidates before applying.
                </small>
              </div>

              {flightLookupMessage ? <p className="flight-lookup-message">{flightLookupMessage}</p> : null}

              {flightLookupCandidates.length ? (
                <div className="flight-lookup-candidate-list">
                  {flightLookupCandidates.map((candidate) => (
                    <article className="flight-lookup-candidate-card" key={candidate.id}>
                      <div className="flight-lookup-candidate-top">
                        <div>
                          <strong>{`${candidate.carrierName} ${candidate.code}`}</strong>
                          <span>{candidate.providerLabel}</span>
                        </div>
                        <button
                          className="primary-button compact-button"
                          onClick={() => handleApplyFlightLookupCandidate(candidate)}
                          type="button"
                        >
                          Apply candidate
                        </button>
                      </div>
                      <p className="flight-lookup-candidate-summary">
                        {`${candidate.departure.name} (${candidate.departure.code}) -> ${candidate.arrival.name} (${candidate.arrival.code})`}
                      </p>
                      <div className="field-meta-list">
                        {candidate.departureTimeLocal ? (
                          <span className="field-meta-chip">
                            {candidate.departureTimeLocal.replace("T", " ")}
                          </span>
                        ) : null}
                        {candidate.arrivalTimeLocal ? (
                          <span className="field-meta-chip">
                            {candidate.arrivalTimeLocal.replace("T", " ")}
                          </span>
                        ) : null}
                        {candidate.departureTerminal ? (
                          <span className="field-meta-chip">{`Dep ${candidate.departureTerminal}`}</span>
                        ) : null}
                        {candidate.arrivalTerminal ? (
                          <span className="field-meta-chip">{`Arr ${candidate.arrivalTerminal}`}</span>
                        ) : null}
                      </div>
                      <small className="field-directory-note">{candidate.sourceNote}</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="ticket-form-row ticket-form-row-route">
          <label className={getLabelClassName("departure.name")}>
            {t("departure")}
            <div className="autocomplete-field">
              <input
                onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                onChange={(event) => updateLocationField("departure", "name", event.target.value)}
                onFocus={() => setActiveSuggestField("departure.name")}
                placeholder={getLocationNamePlaceholder(draft.ticketType, "departure")}
                value={draft.departure.name}
              />
              {visibleDepartureSuggestions.length ? (
                <div className="autocomplete-panel">
                  {visibleDepartureSuggestions.map((location) => (
                    <button
                      className="autocomplete-option"
                      key={location.id}
                      onMouseDown={() => applyLocationSuggestion("departure", location)}
                      type="button"
                    >
                      <strong>{location.nameZh || location.nameEn || location.code || "Location"}</strong>
                      <span>{joinLocationMeta(location)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("departure.name")}
          </label>

          <label className={getLabelClassName("departure.code")}>
            {t("departureCode")}
            <input
              onChange={(event) => updateLocationField("departure", "code", event.target.value)}
              placeholder={locationCodePlaceholder}
              value={draft.departure.code}
            />
            {renderReviewNote("departure.code")}
          </label>

          <label className={getLabelClassName("arrival.name")}>
            {t("arrival")}
            <div className="autocomplete-field">
              <input
                onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                onChange={(event) => updateLocationField("arrival", "name", event.target.value)}
                onFocus={() => setActiveSuggestField("arrival.name")}
                placeholder={getLocationNamePlaceholder(draft.ticketType, "arrival")}
                value={draft.arrival.name}
              />
              {visibleArrivalSuggestions.length ? (
                <div className="autocomplete-panel">
                  {visibleArrivalSuggestions.map((location) => (
                    <button
                      className="autocomplete-option"
                      key={location.id}
                      onMouseDown={() => applyLocationSuggestion("arrival", location)}
                      type="button"
                    >
                      <strong>{location.nameZh || location.nameEn || location.code || "Location"}</strong>
                      <span>{joinLocationMeta(location)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("arrival.name")}
          </label>

          <label className={getLabelClassName("arrival.code")}>
            {t("arrivalCode")}
            <input
              onChange={(event) => updateLocationField("arrival", "code", event.target.value)}
              placeholder={locationCodePlaceholder}
              value={draft.arrival.code}
            />
            {renderReviewNote("arrival.code")}
          </label>
          </div>

          {shouldShowTerminalFields(draft.ticketType) ? (
            <div className="ticket-form-row ticket-form-row-terminals">
              <label>
                {t("departureTerminal")}
                <input
                  onChange={(event) => updateField("departureTerminal", event.target.value)}
                  placeholder="T1"
                  value={draft.departureTerminal ?? ""}
                />
              </label>

              <label>
                {t("arrivalTerminal")}
                <input
                  onChange={(event) => updateField("arrivalTerminal", event.target.value)}
                  placeholder="T2"
                  value={draft.arrivalTerminal ?? ""}
                />
              </label>
            </div>
          ) : null}

          <div className="ticket-form-row ticket-form-row-times">
          <label className={getLabelClassName("departure.timezone")}>
            Departure timezone
            <input
              onChange={(event) => updateLocationField("departure", "timezone", event.target.value)}
              placeholder="Asia/Shanghai"
              value={draft.departure.timezone}
            />
            {renderReviewNote("departure.timezone")}
          </label>

          <label className={getLabelClassName("departureTimeLocal")}>
            {t("departureTime")}
            <input
              onChange={(event) => updateField("departureTimeLocal", event.target.value)}
              type="datetime-local"
              value={draft.departureTimeLocal}
            />
            {renderReviewNote("departureTimeLocal")}
          </label>

          <label className={getLabelClassName("arrival.timezone")}>
            Arrival timezone
            <input
              onChange={(event) => updateLocationField("arrival", "timezone", event.target.value)}
              placeholder="Australia/Sydney"
              value={draft.arrival.timezone}
            />
            {renderReviewNote("arrival.timezone")}
          </label>

          <label className={getLabelClassName("arrivalTimeLocal")}>
            {t("arrivalTime")}
            <input
              onChange={(event) => updateField("arrivalTimeLocal", event.target.value)}
              type="datetime-local"
              value={draft.arrivalTimeLocal}
            />
            {renderReviewNote("arrivalTimeLocal")}
          </label>
          </div>

          <div className="ticket-form-row ticket-form-row-meta">
          <label className={getLabelClassName("classInfo")}>
            {t("cabinClass")}
            <input
              onChange={(event) => updateField("classInfo", event.target.value)}
              placeholder="Economy"
              value={draft.classInfo}
            />
            {renderReviewNote("classInfo")}
          </label>

          <label className={getLabelClassName("seatInfo")}>
            {t("seat")}
            <input
              onChange={(event) => updateField("seatInfo", event.target.value)}
              placeholder="12A"
              value={draft.seatInfo}
            />
            {renderReviewNote("seatInfo")}
          </label>
          </div>
        </div>

        <label className={getLabelClassName("notes")}>
          {t("notes")}
          <textarea
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Special handling, baggage, transfer comments..."
            value={draft.notes}
          />
          {renderReviewNote("notes")}
        </label>

        <section className="segment-planner">
          <div className="panel-heading">
            <div>
              <h3>Onward segments</h3>
            </div>
            <button className="ghost-button compact-button" onClick={handleAddSegment} type="button">
              Add segment
            </button>
          </div>

          {draft.segments?.length ? (
            <div className="segment-stack">
              {draft.segments.map((segment, index) => (
                <article className="segment-card" key={`segment-${index}`}>
                  <div className="segment-card-top">
                    <div>
                      <span className="ticket-kind">{`Segment ${index + 2}`}</span>
                      <strong>{buildSegmentRouteLabel(segment)}</strong>
                    </div>
                    <div className="segment-card-controls">
                      <button
                        className="ghost-button compact-button"
                        disabled={index === 0}
                        onClick={() => handleMoveSegment(index, -1)}
                        type="button"
                      >
                        Up
                      </button>
                      <button
                        className="ghost-button compact-button"
                        disabled={index === (draft.segments?.length ?? 1) - 1}
                        onClick={() => handleMoveSegment(index, 1)}
                        type="button"
                      >
                        Down
                      </button>
                      <button
                        className="ghost-button compact-button danger-button"
                        onClick={() => handleRemoveSegment(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="segment-helper-row">
                    <button
                      className="ghost-button compact-button"
                      onClick={() => handleInheritPreviousArrival(index)}
                      type="button"
                    >
                      Inherit previous arrival
                    </button>
                    <button
                      className="ghost-button compact-button"
                      onClick={() => handleSuggestLayover(index, 45)}
                      type="button"
                    >
                      +45 min
                    </button>
                    <button
                      className="ghost-button compact-button"
                      onClick={() => handleSuggestLayover(index, 90)}
                      type="button"
                    >
                      +90 min
                    </button>
                    <button
                      className="ghost-button compact-button"
                      onClick={() => handleSuggestLayover(index, 180)}
                      type="button"
                    >
                      +180 min
                    </button>
                  </div>

                  <div className="form-grid">
                    <label>
                      {t("carrierOperator")}
                      <div className="autocomplete-field">
                        <input
                          onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                          onChange={(event) => updateExtraSegmentField(index, "carrierName", event.target.value)}
                          onFocus={() => setActiveSuggestField(`segment:${index}:carrier` as SuggestField)}
                          placeholder="Carrier"
                          value={segment.carrierName}
                        />
                        {activeSuggestField === (`segment:${index}:carrier` as SuggestField) &&
                        (segmentAirlineSuggestions[index] ?? []).length ? (
                          <div className="autocomplete-panel">
                            {(segmentAirlineSuggestions[index] ?? []).slice(0, 6).map((airline) => (
                              <button
                                className="autocomplete-option"
                                key={airline.id}
                                onMouseDown={() => applyExtraSegmentAirlineSuggestion(index, airline)}
                                type="button"
                              >
                                <strong>{airline.nameEn}</strong>
                                <span>{`${airline.nameZh || "Airline"} | ${airline.iataCode}`}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label>
                      {getTicketNumberLabel(draft.ticketType, t("flightNo"), t("trainNo"))}
                      <input
                        onChange={(event) => updateExtraSegmentField(index, "code", event.target.value)}
                        placeholder="MU561"
                        value={segment.code}
                      />
                    </label>

                    {draft.ticketType === "flight" ? (
                      <div className="segment-lookup-inline">
                        <div className="ticket-form-row ticket-form-row-lookup">
                          <label>
                            Lookup date
                            <input
                              onChange={(event) =>
                                setSegmentLookupDates((current) => ({
                                  ...current,
                                  [index]: event.target.value,
                                }))
                              }
                              type="date"
                              value={segmentLookupDates[index] ?? getDateOnly(segment.departureTimeLocal)}
                            />
                          </label>

                          <div className="flight-lookup-actions">
                            <button
                              className="ghost-button"
                              disabled={Boolean(segmentLookupBusy[index]) || !segment.code.trim() || !(segmentLookupDates[index] ?? getDateOnly(segment.departureTimeLocal)).trim()}
                              onClick={() => void handleLookupSegmentFlight(index)}
                              type="button"
                            >
                              {segmentLookupBusy[index] ? "Looking up..." : "Lookup flight"}
                            </button>
                            <small className="field-directory-note">
                              Lookup uses your saved flight data source setting for this segment.
                            </small>
                          </div>

                          {segmentLookupMessages[index] ? (
                            <p className="flight-lookup-message">{segmentLookupMessages[index]}</p>
                          ) : null}

                          {(segmentLookupCandidates[index] ?? []).length ? (
                            <div className="flight-lookup-candidate-list">
                              {(segmentLookupCandidates[index] ?? []).map((candidate) => (
                                <article className="flight-lookup-candidate-card" key={`${index}-${candidate.id}`}>
                                  <div className="flight-lookup-candidate-top">
                                    <div>
                                      <strong>{`${candidate.carrierName} ${candidate.code}`}</strong>
                                      <span>{candidate.providerLabel}</span>
                                    </div>
                                    <button
                                      className="primary-button compact-button"
                                      onClick={() => handleApplySegmentFlightLookupCandidate(index, candidate)}
                                      type="button"
                                    >
                                      Apply candidate
                                    </button>
                                  </div>
                                  <p className="flight-lookup-candidate-summary">
                                    {`${candidate.departure.name} (${candidate.departure.code}) -> ${candidate.arrival.name} (${candidate.arrival.code})`}
                                  </p>
                                  <div className="field-meta-list">
                                    {candidate.departureTimeLocal ? (
                                      <span className="field-meta-chip">
                                        {candidate.departureTimeLocal.replace("T", " ")}
                                      </span>
                                    ) : null}
                                    {candidate.arrivalTimeLocal ? (
                                      <span className="field-meta-chip">
                                        {candidate.arrivalTimeLocal.replace("T", " ")}
                                      </span>
                                    ) : null}
                                    {candidate.departureTerminal ? (
                                      <span className="field-meta-chip">{`Dep ${candidate.departureTerminal}`}</span>
                                    ) : null}
                                    {candidate.arrivalTerminal ? (
                                      <span className="field-meta-chip">{`Arr ${candidate.arrivalTerminal}`}</span>
                                    ) : null}
                                  </div>
                                  <small className="field-directory-note">{candidate.sourceNote}</small>
                                </article>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <label>
                      {t("departure")}
                      <div className="autocomplete-field">
                        <input
                          onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                          onChange={(event) =>
                            updateExtraSegmentLocationField(index, "departure", "name", event.target.value)
                          }
                          onFocus={() => setActiveSuggestField(`segment:${index}:departure` as SuggestField)}
                          placeholder={getLocationNamePlaceholder(draft.ticketType, "departure")}
                          value={segment.departure.name}
                        />
                        {activeSuggestField === (`segment:${index}:departure` as SuggestField) &&
                        (segmentDepartureSuggestions[index] ?? []).length ? (
                          <div className="autocomplete-panel">
                            {(segmentDepartureSuggestions[index] ?? []).slice(0, 6).map((location) => (
                              <button
                                className="autocomplete-option"
                                key={location.id}
                                onMouseDown={() => applyExtraSegmentLocationSuggestion(index, "departure", location)}
                                type="button"
                              >
                                <strong>{location.nameZh || location.nameEn || location.code || "Location"}</strong>
                                <span>{joinLocationMeta(location)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label>
                      {t("arrival")}
                      <div className="autocomplete-field">
                        <input
                          onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                          onChange={(event) =>
                            updateExtraSegmentLocationField(index, "arrival", "name", event.target.value)
                          }
                          onFocus={() => setActiveSuggestField(`segment:${index}:arrival` as SuggestField)}
                          placeholder={getLocationNamePlaceholder(draft.ticketType, "arrival")}
                          value={segment.arrival.name}
                        />
                        {activeSuggestField === (`segment:${index}:arrival` as SuggestField) &&
                        (segmentArrivalSuggestions[index] ?? []).length ? (
                          <div className="autocomplete-panel">
                            {(segmentArrivalSuggestions[index] ?? []).slice(0, 6).map((location) => (
                              <button
                                className="autocomplete-option"
                                key={location.id}
                                onMouseDown={() => applyExtraSegmentLocationSuggestion(index, "arrival", location)}
                                type="button"
                              >
                                <strong>{location.nameZh || location.nameEn || location.code || "Location"}</strong>
                                <span>{joinLocationMeta(location)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </label>

                    {draft.ticketType === "flight" ? (
                      <>
                        <label>
                          {t("departureTerminal")}
                          <input
                            onChange={(event) => updateExtraSegmentField(index, "departureTerminal", event.target.value)}
                            placeholder="T1"
                            value={segment.departureTerminal ?? ""}
                          />
                        </label>

                        <label>
                          {t("arrivalTerminal")}
                          <input
                            onChange={(event) => updateExtraSegmentField(index, "arrivalTerminal", event.target.value)}
                            placeholder="T2"
                            value={segment.arrivalTerminal ?? ""}
                          />
                        </label>
                      </>
                    ) : null}

                    <label>
                      {t("departureCode")}
                      <input
                        onChange={(event) =>
                          updateExtraSegmentLocationField(index, "departure", "code", event.target.value)
                        }
                        placeholder={locationCodePlaceholder}
                        value={segment.departure.code}
                      />
                    </label>

                    <label>
                      {t("arrivalCode")}
                      <input
                        onChange={(event) =>
                          updateExtraSegmentLocationField(index, "arrival", "code", event.target.value)
                        }
                        placeholder={locationCodePlaceholder}
                        value={segment.arrival.code}
                      />
                    </label>

                    <label>
                      Departure timezone
                      <input
                        onChange={(event) =>
                          updateExtraSegmentLocationField(index, "departure", "timezone", event.target.value)
                        }
                        placeholder="Asia/Shanghai"
                        value={segment.departure.timezone}
                      />
                    </label>

                    <label>
                      Arrival timezone
                      <input
                        onChange={(event) =>
                          updateExtraSegmentLocationField(index, "arrival", "timezone", event.target.value)
                        }
                        placeholder="Australia/Sydney"
                        value={segment.arrival.timezone}
                      />
                    </label>

                    <label>
                      {t("departureTime")}
                      <input
                        onChange={(event) =>
                          updateExtraSegmentField(index, "departureTimeLocal", event.target.value)
                        }
                        type="datetime-local"
                        value={segment.departureTimeLocal}
                      />
                    </label>

                    <label>
                      {t("arrivalTime")}
                      <input
                        onChange={(event) => updateExtraSegmentField(index, "arrivalTimeLocal", event.target.value)}
                        type="datetime-local"
                        value={segment.arrivalTimeLocal}
                      />
                    </label>

                    <label>
                      {t("cabinClass")}
                      <input
                        onChange={(event) => updateExtraSegmentField(index, "classInfo", event.target.value)}
                        placeholder="Economy"
                        value={segment.classInfo}
                      />
                    </label>

                    <label>
                      {t("seat")}
                      <input
                        onChange={(event) => updateExtraSegmentField(index, "seatInfo", event.target.value)}
                        placeholder="12A"
                        value={segment.seatInfo}
                      />
                    </label>
                  </div>

                  <label>
                    Segment notes
                    <textarea
                      onChange={(event) => updateExtraSegmentField(index, "notes", event.target.value)}
                      placeholder="Transfer notes, baggage rules, onward remarks..."
                      value={segment.notes}
                    />
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No onward segments yet</strong>
              <p>Add another leg here for transfers, open-jaw plans, or return segments.</p>
            </div>
          )}
        </section>

        <div className="form-utility-row">
          <div className="route-summary-card">
            <span>Route summary</span>
            <strong>{routeSummary}</strong>
            <small>
              {draft.ticketType === "flight"
                ? "Directory-backed airport and airline lookup is active."
                : "Directory-backed station lookup is active."}
            </small>
            <small>{`${effectiveSegments.length} segment(s) planned in this itinerary.`}</small>
            {segmentValidationMessages.length ? (
              <div className="segment-warning-list">
                {segmentValidationMessages.map((item) => (
                  <span
                    className={
                      item.severity === "warning"
                        ? "segment-warning-chip segment-warning-chip-danger"
                        : "segment-warning-chip"
                    }
                    key={item.key}
                  >
                    {item.message}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button className="ghost-button compact-button" onClick={handleSwapRoute} type="button">
            Swap route
          </button>
        </div>

        <div className="form-actions">
          {onCancelEdit ? (
            <button className="ghost-button" onClick={onCancelEdit} type="button">
              {t("cancelEdit")}
            </button>
          ) : null}
          <button className="primary-button wide" type="submit">
            {isSaving
              ? mode === "edit"
                ? "Updating ticket..."
                : "Saving ticket..."
              : mode === "edit"
                ? t("updateTicket")
                : t("saveTicketDraft")}
          </button>
        </div>
    </form>
  );
}
