import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { SmartImport } from "./components/SmartImport";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { TicketForm } from "./components/TicketForm";
import { TicketList } from "./components/TicketList";
import { reviewImportedDraft, type ImportFieldReview, type ImportParseResult } from "./lib/importParser";
import {
  addTicketAttachment,
  createTicket,
  deleteTicket,
  deleteTicketAttachment,
  getTicketDetail,
  listTickets,
  updateTicket,
  updateTicketStatus,
} from "./lib/ticketService";
import type { TicketDetailPayload, TicketDraft, TicketRecord, TicketStatus, TicketType } from "./types/ticket";

type TicketSort = "created_desc" | "created_asc" | "departure_asc" | "departure_desc";

interface TicketFilters {
  query: string;
  ticketType: "all" | TicketType;
  status: "all" | Exclude<TicketStatus, "draft">;
  sort: TicketSort;
}

const defaultFilters: TicketFilters = {
  query: "",
  ticketType: "all",
  status: "all",
  sort: "created_desc",
};

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
    segments: ticket.segments?.map((segment) => ({
      ...segment,
      departure: { ...segment.departure },
      arrival: { ...segment.arrival },
    })),
  };
}

function matchesQuery(ticket: TicketRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    ticket.code,
    ticket.routeLabel,
    ticket.carrierName,
    ticket.notes,
    ticket.departure.name,
    ticket.arrival.name,
    ticket.departure.code || "",
    ticket.arrival.code || "",
    ...(ticket.segments ?? []).flatMap((segment) => [
      segment.code,
      segment.carrierName,
      segment.departure.name,
      segment.arrival.name,
      segment.departure.code || "",
      segment.arrival.code || "",
    ]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function sortTickets(tickets: TicketRecord[], sort: TicketSort) {
  const nextTickets = [...tickets];

  nextTickets.sort((left, right) => {
    if (sort === "created_asc") {
      return left.createdAt.localeCompare(right.createdAt);
    }
    if (sort === "departure_asc") {
      return left.departureTimeLocal.localeCompare(right.departureTimeLocal);
    }
    if (sort === "departure_desc") {
      return right.departureTimeLocal.localeCompare(left.departureTimeLocal);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  return nextTickets;
}

export default function App() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editingId, setEditingId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState("");
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<TicketDetailPayload | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [filters, setFilters] = useState<TicketFilters>(defaultFilters);
  const [importedDraft, setImportedDraft] = useState<TicketDraft | null>(null);
  const [importReview, setImportReview] = useState<ImportFieldReview[] | null>(null);

  const deferredQuery = useDeferredValue(filters.query);

  const visibleTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) => {
      if (!matchesQuery(ticket, deferredQuery)) {
        return false;
      }
      if (filters.ticketType !== "all" && ticket.ticketType !== filters.ticketType) {
        return false;
      }
      if (filters.status !== "all" && ticket.status !== filters.status) {
        return false;
      }
      return true;
    });

    return sortTickets(filtered, filters.sort);
  }, [deferredQuery, filters.sort, filters.status, filters.ticketType, tickets]);

  const selectedTicket = visibleTickets.find((ticket) => ticket.id === selectedId) ?? visibleTickets[0] ?? null;
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
    if (visibleTickets.length === 0) {
      setSelectedId("");
      setSelectedDetail(null);
      return;
    }

    const selectedStillVisible = visibleTickets.some((ticket) => ticket.id === selectedId);
    if (!selectedStillVisible) {
      setSelectedId(visibleTickets[0].id);
    }
  }, [selectedId, visibleTickets]);

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
          setImportedDraft(null);
          setImportReview(null);
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
    setImportedDraft(null);
    setImportReview(null);
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

  const handleAddAttachment = async (file: File) => {
    if (!selectedTicket) {
      return;
    }

    setAttachmentBusy(true);
    setErrorMessage("");

    try {
      await addTicketAttachment(selectedTicket.id, file);
      setDetailVersion((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add attachment.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTicket) {
      return;
    }

    setAttachmentBusy(true);
    setErrorMessage("");

    try {
      await deleteTicketAttachment(attachmentId, selectedTicket.id);
      setDetailVersion((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete attachment.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleApplyImport = (result: ImportParseResult) => {
    setEditingId("");
    setImportedDraft(result.draft);
    setImportReview(result ? reviewImportedDraft(result) : null);
    setErrorMessage("");
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
                : `Archive ready: ${visibleTickets.length} visible ticket(s) from ${tickets.length} total.`}
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
            <SmartImport onApplyImport={handleApplyImport} />
            <StatisticsPanel tickets={visibleTickets} totalCount={tickets.length} />
            <TicketForm
              importReview={importReview}
              importedDraft={importedDraft}
              initialDraft={formDraft}
              isSaving={isSaving}
              mode={editingTicket ? "edit" : "create"}
              onCancelEdit={() => setEditingId("")}
              onSubmitTicket={handleSubmitTicket}
            />
            <TicketList
              busyTicketId={busyTicketId}
              filters={filters}
              onDelete={handleDeleteTicket}
              onEdit={handleEditTicket}
              onFiltersChange={setFilters}
              onResetFilters={() => setFilters(defaultFilters)}
              onSelect={setSelectedId}
              onUpdateStatus={handleUpdateStatus}
              selectedId={selectedTicket?.id ?? ""}
              tickets={visibleTickets}
              totalCount={tickets.length}
            />
          </div>
          <Dashboard
            attachmentBusy={attachmentBusy}
            detail={selectedDetail}
            isLoading={detailLoading}
            onAddAttachment={handleAddAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            ticket={selectedTicket}
          />
        </section>
      </main>
    </div>
  );
}
