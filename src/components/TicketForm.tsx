import { useState, type FormEvent } from "react";
import type { TicketDraft, TicketType } from "../types/ticket";

const defaultDraft: TicketDraft = {
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

interface TicketFormProps {
  isSaving: boolean;
  onCreateTicket: (draft: TicketDraft) => Promise<void>;
}

export function TicketForm({ isSaving, onCreateTicket }: TicketFormProps) {
  const [draft, setDraft] = useState<TicketDraft>(defaultDraft);

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

    void onCreateTicket(draft).then(() => {
      setDraft(defaultDraft);
    });
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Capture</p>
          <h3>Create ticket record</h3>
        </div>
        <span className="status-pill">{isSaving ? "Saving..." : "SQLite flow"}</span>
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
          <label>
            Carrier
            <input
              value={draft.carrierName}
              onChange={(event) => updateField("carrierName", event.target.value)}
              placeholder="China Eastern"
            />
          </label>
          <label>
            Flight / Train No.
            <input
              value={draft.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="MU561"
            />
          </label>
          <label>
            Departure
            <input
              value={draft.departure.name}
              onChange={(event) => updateLocationField("departure", "name", event.target.value)}
              placeholder="Shanghai Pudong"
            />
          </label>
          <label>
            Arrival
            <input
              value={draft.arrival.name}
              onChange={(event) => updateLocationField("arrival", "name", event.target.value)}
              placeholder="Sydney Airport"
            />
          </label>
          <label>
            Departure code
            <input
              value={draft.departure.code}
              onChange={(event) => updateLocationField("departure", "code", event.target.value)}
              placeholder="PVG"
            />
          </label>
          <label>
            Arrival code
            <input
              value={draft.arrival.code}
              onChange={(event) => updateLocationField("arrival", "code", event.target.value)}
              placeholder="SYD"
            />
          </label>
          <label>
            Departure time
            <input
              type="datetime-local"
              value={draft.departureTimeLocal}
              onChange={(event) => updateField("departureTimeLocal", event.target.value)}
            />
          </label>
          <label>
            Arrival time
            <input
              type="datetime-local"
              value={draft.arrivalTimeLocal}
              onChange={(event) => updateField("arrivalTimeLocal", event.target.value)}
            />
          </label>
          <label>
            Cabin / Class
            <input
              value={draft.classInfo}
              onChange={(event) => updateField("classInfo", event.target.value)}
              placeholder="Economy"
            />
          </label>
          <label>
            Seat
            <input
              value={draft.seatInfo}
              onChange={(event) => updateField("seatInfo", event.target.value)}
              placeholder="12A"
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Special handling, baggage, transfer comments..."
          />
        </label>

        <button className="primary-button wide" type="submit">
          {isSaving ? "Saving ticket..." : "Save ticket draft"}
        </button>
      </form>
    </section>
  );
}
