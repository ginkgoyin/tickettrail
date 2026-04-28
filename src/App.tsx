import { startTransition, useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TicketForm } from "./components/TicketForm";
import { TicketList } from "./components/TicketList";
import { createTicket, listTickets } from "./lib/ticketService";
import type { TicketDraft, TicketRecord } from "./types/ticket";

export default function App() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;

  useEffect(() => {
    let isMounted = true;

    const loadTickets = async () => {
      try {
        const storedTickets = await listTickets();
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setTickets(storedTickets);
          setSelectedId(storedTickets[0]?.id ?? "");
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load tickets.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadTickets();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateTicket = async (draft: TicketDraft) => {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const nextTicket = await createTicket(draft);
      startTransition(() => {
        setTickets((current) => [nextTicket, ...current]);
        setSelectedId(nextTicket.id);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save ticket.");
    } finally {
      setIsSaving(false);
    }
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
            <p className="hero-copy">
              {loading
                ? "Loading local archive..."
                : "SQLite-backed ticket storage is active for this MVP."}
            </p>
            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
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
            <TicketForm isSaving={isSaving} onCreateTicket={handleCreateTicket} />
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
