import { startTransition, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TicketForm } from "./components/TicketForm";
import { TicketList } from "./components/TicketList";
import {
  createTicket,
  deleteTicket,
  getTicketDetail,
  listTickets,
  updateTicket,
  updateTicketStatus,
} from "./lib/ticketService";
import type { TicketDetailPayload, TicketDraft, TicketRecord, TicketStatus } from "./types/ticket";

function buildDraftFromTicket(ticket: TicketRecord): TicketDraft {
  return {
    ticketType: ticket.ticketType,
    carrierName: ticket.carrierName,
    code: ticket.code,
    departure: { ...ticket.departure },
    arrival: { ...ticket.arrival },
    departureTimeLocal: ticket.departureTimeLocal,
    arrivalTimeLocal: ticket.arrivalTimeLocal,
    classInfo: ticket.classInfo,
    seatInfo: ticket.seatInfo,
    notes: ticket.notes,
  };
}

export default function App() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editingId, setEditingId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<TicketDetailPayload | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;
  const editingTicket = tickets.find((ticket) => ticket.id === editingId) ?? null;
  const formDraft = useMemo(() => (editingTicket ? buildDraftFromTicket(editingTicket) : null), [editingTicket]);

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

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    let isMounted = true;

    const loadDetail = async () => {
      setDetailLoading(true);

      try {
        const detail = await getTicketDetail(selectedId);
        if (isMounted) {
          setSelectedDetail(detail);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load ticket detail.");
        }
      } finally {
        if (isMounted) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedId, detailVersion]);

  const handleSubmitTicket = async (draft: TicketDraft) => {
    setIsSaving(true);
    setErrorMessage("");

    try {
      if (editingTicket) {
        const nextTicket = await updateTicket(editingTicket.id, draft);
        startTransition(() => {
          setTickets((current) =>
            current.map((ticket) => (ticket.id === editingTicket.id ? nextTicket : ticket)),
          );
          setSelectedId(nextTicket.id);
          setEditingId("");
          setDetailVersion((current) => current + 1);
        });
      } else {
        const nextTicket = await createTicket(draft);
        startTransition(() => {
          setTickets((current) => [nextTicket, ...current]);
          setSelectedId(nextTicket.id);
          setDetailVersion((current) => current + 1);
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTicket = (ticketId: string) => {
    setEditingId(ticketId);
    setSelectedId(ticketId);
    setErrorMessage("");
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || !window.confirm(`Delete ticket ${ticket.code} (${ticket.routeLabel})?`)) {
      return;
    }

    setBusyTicketId(ticketId);
    setErrorMessage("");

    try {
      await deleteTicket(ticketId);
      startTransition(() => {
        const remainingTickets = tickets.filter((item) => item.id !== ticketId);
        setTickets(remainingTickets);
        setSelectedId((current) => (current === ticketId ? remainingTickets[0]?.id ?? "" : current));
        setEditingId((current) => (current === ticketId ? "" : current));
        setDetailVersion((current) => current + 1);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete ticket.");
    } finally {
      setBusyTicketId("");
    }
  };

  const handleUpdateStatus = async (
    ticketId: string,
    status: Exclude<TicketStatus, "draft">,
  ) => {
    setBusyTicketId(ticketId);
    setErrorMessage("");

    try {
      const nextTicket = await updateTicketStatus(ticketId, status);
      startTransition(() => {
        setTickets((current) =>
          current.map((ticket) => (ticket.id === ticketId ? nextTicket : ticket)),
        );
        setDetailVersion((current) => current + 1);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update ticket status.");
    } finally {
      setBusyTicketId("");
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
            <TicketForm
              initialDraft={formDraft}
              isSaving={isSaving}
              mode={editingTicket ? "edit" : "create"}
              onCancelEdit={() => setEditingId("")}
              onSubmitTicket={handleSubmitTicket}
            />
            <TicketList
              busyTicketId={busyTicketId}
              onDelete={handleDeleteTicket}
              onEdit={handleEditTicket}
              onSelect={setSelectedId}
              onUpdateStatus={handleUpdateStatus}
              selectedId={selectedTicket?.id ?? ""}
              tickets={tickets}
            />
          </div>
          <Dashboard detail={selectedDetail} isLoading={detailLoading} ticket={selectedTicket} />
        </section>
      </main>
    </div>
  );
}
