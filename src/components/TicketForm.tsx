import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ImportFieldKey, ImportFieldReview } from "../lib/importParser";
import { searchAirlines, searchLocations } from "../lib/ticketService";
import type {
  AirlineDirectoryEntry,
  LocationDirectoryEntry,
  TicketDraft,
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
    departureTimeLocal: "",
    arrivalTimeLocal: "",
    classInfo: "",
    seatInfo: "",
    notes: "",
  };
}

function cloneDraft(draft: TicketDraft): TicketDraft {
  return {
    ...draft,
    departure: { ...draft.departure },
    arrival: { ...draft.arrival },
  };
}

type SuggestField = "carrierName" | "departure.name" | "arrival.name" | null;

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

export function TicketForm({
  isSaving,
  mode,
  initialDraft,
  importedDraft,
  importReview,
  onSubmitTicket,
  onCancelEdit,
}: TicketFormProps) {
  const [draft, setDraft] = useState<TicketDraft>(createDefaultDraft());
  const [activeSuggestField, setActiveSuggestField] = useState<SuggestField>(null);
  const [airlineSuggestions, setAirlineSuggestions] = useState<AirlineDirectoryEntry[]>([]);
  const [departureSuggestions, setDepartureSuggestions] = useState<LocationDirectoryEntry[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationDirectoryEntry[]>([]);
  const reviewMap = buildReviewMap(mode === "edit" ? null : importReview);

  useEffect(() => {
    if (mode === "edit") {
      setDraft(initialDraft ? cloneDraft(initialDraft) : createDefaultDraft());
      return;
    }

    if (importedDraft) {
      setDraft(cloneDraft(importedDraft));
      return;
    }

    setDraft(createDefaultDraft());
  }, [importedDraft, initialDraft, mode]);

  useEffect(() => {
    let isMounted = true;

    const loadAirlineSuggestions = async () => {
      if (draft.ticketType !== "flight" || draft.carrierName.trim().length < 1) {
        setAirlineSuggestions([]);
        return;
      }

      try {
        const results = await searchAirlines(draft.carrierName.trim());
        if (isMounted) {
          setAirlineSuggestions(results);
        }
      } catch {
        if (isMounted) {
          setAirlineSuggestions([]);
        }
      }
    };

    void loadAirlineSuggestions();

    return () => {
      isMounted = false;
    };
  }, [draft.carrierName, draft.ticketType]);

  useEffect(() => {
    let isMounted = true;

    const loadLocationSuggestions = async (
      query: string,
      setResults: (results: LocationDirectoryEntry[]) => void,
    ) => {
      if (query.trim().length < 1) {
        setResults([]);
        return;
      }

      try {
        const results = await searchLocations(query.trim());
        if (isMounted) {
          setResults(results);
        }
      } catch {
        if (isMounted) {
          setResults([]);
        }
      }
    };

    void loadLocationSuggestions(draft.departure.name || draft.departure.code || "", setDepartureSuggestions);
    void loadLocationSuggestions(draft.arrival.name || draft.arrival.code || "", setArrivalSuggestions);

    return () => {
      isMounted = false;
    };
  }, [draft.arrival.code, draft.arrival.name, draft.departure.code, draft.departure.name]);

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.carrierName || !draft.code || !draft.departure.name || !draft.arrival.name) {
      return;
    }

    void onSubmitTicket(draft).then(() => {
      if (mode === "create") {
        setDraft(createDefaultDraft());
        setAirlineSuggestions([]);
        setDepartureSuggestions([]);
        setArrivalSuggestions([]);
      }
    });
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
                {`套用 ${suggestedValue}`}
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

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Capture</p>
          <h3>{mode === "edit" ? "Edit ticket record" : "Create ticket record"}</h3>
        </div>
        <span className="status-pill">
          {isSaving ? "Saving..." : mode === "edit" ? "Update mode" : importedDraft ? "Imported draft" : "SQLite flow"}
        </span>
      </div>

      <form className="ticket-form" onSubmit={handleSubmit}>
        <div className="toggle-group" role="tablist" aria-label="Ticket type">
          {(["flight", "train"] as TicketType[]).map((type) => (
            <button
              key={type}
              className={draft.ticketType === type ? "toggle active" : "toggle"}
              onClick={() => updateField("ticketType", type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className={getLabelClassName("carrierName")}>
            Carrier
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
                      <span>{`${airline.nameZh || "Airline"} · ${airline.iataCode}`}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("carrierName")}
          </label>

          <label className={getLabelClassName("code")}>
            Flight / Train No.
            <input
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="MU561"
              value={draft.code}
            />
            {renderReviewNote("code")}
          </label>

          <label className={getLabelClassName("departure.name")}>
            Departure
            <div className="autocomplete-field">
              <input
                onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                onChange={(event) => updateLocationField("departure", "name", event.target.value)}
                onFocus={() => setActiveSuggestField("departure.name")}
                placeholder="Shanghai Pudong"
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
                      <span>
                        {[
                          location.code || "",
                          location.nameEn || "",
                          location.timezone || "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("departure.name")}
          </label>

          <label className={getLabelClassName("arrival.name")}>
            Arrival
            <div className="autocomplete-field">
              <input
                onBlur={() => window.setTimeout(() => setActiveSuggestField(null), 120)}
                onChange={(event) => updateLocationField("arrival", "name", event.target.value)}
                onFocus={() => setActiveSuggestField("arrival.name")}
                placeholder="Sydney Airport"
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
                      <span>
                        {[
                          location.code || "",
                          location.nameEn || "",
                          location.timezone || "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {renderReviewNote("arrival.name")}
          </label>

          <label className={getLabelClassName("departure.code")}>
            Departure code
            <input
              onChange={(event) => updateLocationField("departure", "code", event.target.value)}
              placeholder="PVG"
              value={draft.departure.code}
            />
            {renderReviewNote("departure.code")}
          </label>

          <label className={getLabelClassName("arrival.code")}>
            Arrival code
            <input
              onChange={(event) => updateLocationField("arrival", "code", event.target.value)}
              placeholder="SYD"
              value={draft.arrival.code}
            />
            {renderReviewNote("arrival.code")}
          </label>

          <label className={getLabelClassName("departure.timezone")}>
            Departure timezone
            <input
              onChange={(event) => updateLocationField("departure", "timezone", event.target.value)}
              placeholder="Asia/Shanghai"
              value={draft.departure.timezone}
            />
            {renderReviewNote("departure.timezone")}
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

          <label className={getLabelClassName("departureTimeLocal")}>
            Departure time
            <input
              onChange={(event) => updateField("departureTimeLocal", event.target.value)}
              type="datetime-local"
              value={draft.departureTimeLocal}
            />
            {renderReviewNote("departureTimeLocal")}
          </label>

          <label className={getLabelClassName("arrivalTimeLocal")}>
            Arrival time
            <input
              onChange={(event) => updateField("arrivalTimeLocal", event.target.value)}
              type="datetime-local"
              value={draft.arrivalTimeLocal}
            />
            {renderReviewNote("arrivalTimeLocal")}
          </label>

          <label className={getLabelClassName("classInfo")}>
            Cabin / Class
            <input
              onChange={(event) => updateField("classInfo", event.target.value)}
              placeholder="Economy"
              value={draft.classInfo}
            />
            {renderReviewNote("classInfo")}
          </label>

          <label className={getLabelClassName("seatInfo")}>
            Seat
            <input
              onChange={(event) => updateField("seatInfo", event.target.value)}
              placeholder="12A"
              value={draft.seatInfo}
            />
            {renderReviewNote("seatInfo")}
          </label>
        </div>

        <label className={getLabelClassName("notes")}>
          Notes
          <textarea
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Special handling, baggage, transfer comments..."
            value={draft.notes}
          />
          {renderReviewNote("notes")}
        </label>

        <div className="form-actions">
          {mode === "edit" ? (
            <button className="ghost-button" onClick={onCancelEdit} type="button">
              Cancel edit
            </button>
          ) : null}
          <button className="primary-button wide" type="submit">
            {isSaving
              ? mode === "edit"
                ? "Updating ticket..."
                : "Saving ticket..."
              : mode === "edit"
                ? "Update ticket"
                : "Save ticket draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
