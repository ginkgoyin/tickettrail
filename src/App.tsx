import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TicketForm } from "./components/TicketForm";
import { TicketList } from "./components/TicketList";
import { initialTickets } from "./data/mockTickets";
import type { TicketDraft, TicketRecord } from "./types/ticket";

const buildRouteLabel = (ticket: TicketDraft) =>
  `${ticket.departure.name} -> ${ticket.arrival.name}`;

function createTicketRecord(ticket: TicketDraft): TicketRecord {
  const now = new Date().toISOString();

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `ticket-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    routeLabel: buildRouteLabel(ticket),
    ...ticket,
  };
}

export default function App() {
  const [tickets, setTickets] = useState<TicketRecord[]>(initialTickets);
  const [selectedId, setSelectedId] = useState<string>(initialTickets[0]?.id ?? "");

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;

  const handleCreateTicket = (draft: TicketDraft) => {
    const nextTicket = createTicketRecord(draft);
    setTickets((current) => [nextTicket, ...current]);
    setSelectedId(nextTicket.id);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <Header />
        <section className="hero">
          <div>
            <p className="eyebrow">Windows MVP Scaffold</p>
            <h1>TicketTrail</h1>
            <p className="hero-copy">
              Capture flights and rail trips, normalize them into structured journeys,
              preview map routes, and prepare branded ticket-stub exports.
            </p>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-value">{tickets.length}</span>
              <span className="stat-label">Stored tickets</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {tickets.filter((ticket) => ticket.ticketType === "flight").length}
              </span>
              <span className="stat-label">Flights</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {tickets.filter((ticket) => ticket.ticketType === "train").length}
              </span>
              <span className="stat-label">Rail segments</span>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel-stack">
            <TicketForm onCreateTicket={handleCreateTicket} />
            <TicketList
              tickets={tickets}
              selectedId={selectedTicket?.id ?? ""}
              onSelect={setSelectedId}
            />
          </div>
          <Dashboard ticket={selectedTicket} />
        </section>
      </main>
    </div>
  );
}
