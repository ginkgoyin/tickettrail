import { useEffect, useState, type FormEvent } from "react";
import type { TicketDraft, TicketType } from "../types/ticket";
import type { ImportFieldKey, ImportFieldReview } from "../lib/importParser";

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.carrierName || !draft.code || !draft.departure.name || !draft.arrival.name) {
      return;
    }

    void onSubmitTicket(draft).then(() => {
      if (mode === "create") {
        setDraft(createDefaultDraft());
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
        {review.suggestedValue ? (
          <>
            {" "}
            <button
              className="field-suggestion-button"
              onClick={() => {
                const value = review.suggestedValue ?? "";
                switch (field) {
                  case "carrierName":
                  case "code":
                  case "departureTimeLocal":
                  case "arrivalTimeLocal":
                  case "classInfo":
                  case "seatInfo":
                  case "notes":
                    updateField(field, value);
                    break;
                  case "departure.name":
                    updateLocationField("departure", "name", value);
                    break;
                  case "departure.code":
                    updateLocationField("departure", "code", value);
                    break;
                  case "departure.timezone":
                    updateLocationField("departure", "timezone", value);
                    break;
                  case "arrival.name":
                    updateLocationField("arrival", "name", value);
                    break;
                  case "arrival.code":
                    updateLocationField("arrival", "code", value);
                    break;
                  case "arrival.timezone":
                    updateLocationField("arrival", "timezone", value);
                    break;
                }
              }}
              type="button"
            >
              {`套用建议值 ${review.suggestedValue}`}
            </button>
          </>
        ) : null}
      </small>
    );
  };

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
            <input
              value={draft.carrierName}
              onChange={(event) => updateField("carrierName", event.target.value)}
              placeholder="China Eastern"
            />
            {renderReviewNote("carrierName")}
          </label>
          <label className={getLabelClassName("code")}>
            Flight / Train No.
            <input
              value={draft.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="MU561"
            />
            {renderReviewNote("code")}
          </label>
          <label className={getLabelClassName("departure.name")}>
            Departure
            <input
              value={draft.departure.name}
              onChange={(event) => updateLocationField("departure", "name", event.target.value)}
              placeholder="Shanghai Pudong"
            />
            {renderReviewNote("departure.name")}
          </label>
          <label className={getLabelClassName("arrival.name")}>
            Arrival
            <input
              value={draft.arrival.name}
              onChange={(event) => updateLocationField("arrival", "name", event.target.value)}
              placeholder="Sydney Airport"
            />
            {renderReviewNote("arrival.name")}
          </label>
          <label className={getLabelClassName("departure.code")}>
            Departure code
            <input
              value={draft.departure.code}
              onChange={(event) => updateLocationField("departure", "code", event.target.value)}
              placeholder="PVG"
            />
            {renderReviewNote("departure.code")}
          </label>
          <label className={getLabelClassName("arrival.code")}>
            Arrival code
            <input
              value={draft.arrival.code}
              onChange={(event) => updateLocationField("arrival", "code", event.target.value)}
              placeholder="SYD"
            />
            {renderReviewNote("arrival.code")}
          </label>
          <label className={getLabelClassName("departure.timezone")}>
            Departure timezone
            <input
              value={draft.departure.timezone}
              onChange={(event) => updateLocationField("departure", "timezone", event.target.value)}
              placeholder="Asia/Shanghai"
            />
            {renderReviewNote("departure.timezone")}
          </label>
          <label className={getLabelClassName("arrival.timezone")}>
            Arrival timezone
            <input
              value={draft.arrival.timezone}
              onChange={(event) => updateLocationField("arrival", "timezone", event.target.value)}
              placeholder="Australia/Sydney"
            />
            {renderReviewNote("arrival.timezone")}
          </label>
          <label className={getLabelClassName("departureTimeLocal")}>
            Departure time
            <input
              type="datetime-local"
              value={draft.departureTimeLocal}
              onChange={(event) => updateField("departureTimeLocal", event.target.value)}
            />
            {renderReviewNote("departureTimeLocal")}
          </label>
          <label className={getLabelClassName("arrivalTimeLocal")}>
            Arrival time
            <input
              type="datetime-local"
              value={draft.arrivalTimeLocal}
              onChange={(event) => updateField("arrivalTimeLocal", event.target.value)}
            />
            {renderReviewNote("arrivalTimeLocal")}
          </label>
          <label className={getLabelClassName("classInfo")}>
            Cabin / Class
            <input
              value={draft.classInfo}
              onChange={(event) => updateField("classInfo", event.target.value)}
              placeholder="Economy"
            />
            {renderReviewNote("classInfo")}
          </label>
          <label className={getLabelClassName("seatInfo")}>
            Seat
            <input
              value={draft.seatInfo}
              onChange={(event) => updateField("seatInfo", event.target.value)}
              placeholder="12A"
            />
            {renderReviewNote("seatInfo")}
          </label>
        </div>

        <label className={getLabelClassName("notes")}>
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Special handling, baggage, transfer comments..."
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
