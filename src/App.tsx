import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { BackupPanel } from "./components/BackupPanel";
import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { SmartImport } from "./components/SmartImport";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { TicketForm } from "./components/TicketForm";
import { TicketList, type SavedFilterView, type TicketFilters, type TicketSort } from "./components/TicketList";
import { reviewImportedDraft, type ImportFieldReview, type ImportParseResult } from "./lib/importParser";
import {
  addTicketAttachment,
  createBackup,
  createTicket,
  deleteTicket,
  deleteTicketAttachment,
  exportArchiveBundle,
  exportBackup,
  getBackupReadiness,
  getTicketDetail,
  importArchiveBundle,
  listBackups,
  listTickets,
  restoreBackup,
  updateTicket,
  updateTicketStatus,
} from "./lib/ticketService";
import type {
  BackupReadiness,
  BackupRecord,
  TicketDetailPayload,
  TicketDraft,
  TicketRecord,
  TicketStatus,
} from "./types/ticket";

const defaultFilters: TicketFilters = {
  query: "",
  ticketType: "all",
  status: "all",
  sort: "created_desc",
};

const savedViewsStorageKey = "tickettrail.saved-filter-views";

function asComparableText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeSavedViews(rawValue: unknown): SavedFilterView[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((item): item is Partial<SavedFilterView> & { id: string; name: string; filters: TicketFilters } => {
      return Boolean(
        item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          item.filters &&
          typeof item.filters === "object",
      );
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      filters: {
        query: item.filters.query ?? "",
        ticketType: item.filters.ticketType ?? "all",
        status: item.filters.status ?? "all",
        sort: item.filters.sort ?? "created_desc",
      },
      createdAt: item.createdAt ?? new Date().toISOString(),
      pinned: item.pinned ?? false,
    }))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
}

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
    asComparableText(ticket.code),
    asComparableText(ticket.routeLabel),
    asComparableText(ticket.carrierName),
    asComparableText(ticket.notes),
    asComparableText(ticket.departure?.name),
    asComparableText(ticket.arrival?.name),
    asComparableText(ticket.departure?.code),
    asComparableText(ticket.arrival?.code),
    asComparableText(ticket.departure?.timezone),
    asComparableText(ticket.arrival?.timezone),
    asComparableText(ticket.departureTimeLocal),
    asComparableText(ticket.arrivalTimeLocal),
    asComparableText(ticket.ticketType),
    asComparableText(ticket.status),
    ...(ticket.segments ?? []).flatMap((segment) => [
      asComparableText(segment.code),
      asComparableText(segment.carrierName),
      asComparableText(segment.departure?.name),
      asComparableText(segment.arrival?.name),
      asComparableText(segment.departure?.code),
      asComparableText(segment.arrival?.code),
      asComparableText(segment.departure?.timezone),
      asComparableText(segment.arrival?.timezone),
      asComparableText(segment.departureTimeLocal),
      asComparableText(segment.arrivalTimeLocal),
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
      return asComparableText(left.createdAt).localeCompare(asComparableText(right.createdAt));
    }
    if (sort === "departure_asc") {
      return asComparableText(left.departureTimeLocal).localeCompare(asComparableText(right.departureTimeLocal));
    }
    if (sort === "departure_desc") {
      return asComparableText(right.departureTimeLocal).localeCompare(asComparableText(left.departureTimeLocal));
    }

    return asComparableText(right.createdAt).localeCompare(asComparableText(left.createdAt));
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
  const [savedViews, setSavedViews] = useState<SavedFilterView[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [backupReadiness, setBackupReadiness] = useState<BackupReadiness | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
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
    try {
      const storedValue = window.localStorage.getItem(savedViewsStorageKey);
      if (!storedValue) {
        return;
      }

      const parsed = JSON.parse(storedValue) as unknown;
      setSavedViews(normalizeSavedViews(parsed));
    } catch {
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(savedViewsStorageKey, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    let isMounted = true;

    const loadArchiveState = async () => {
      try {
        const [storedTickets, storedBackups, readiness] = await Promise.all([
          listTickets(),
          listBackups(),
          getBackupReadiness(),
        ]);
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setTickets(storedTickets);
          setBackups(storedBackups);
          setBackupReadiness(readiness);
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

    void loadArchiveState();

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
          setSelectedDetail(null);
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

  const handleApplyAnalyticsFilter = (patch: Partial<TicketFilters>) => {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        ...patch,
      }));
    });
  };

  const handleApplyArchiveQuery = (query: string) => {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        query,
      }));
    });
  };

  const handleSaveCurrentView = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    startTransition(() => {
      setSavedViews((current) => {
        const nextView: SavedFilterView = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
          name: normalizedName,
          filters: { ...filters },
          createdAt: new Date().toISOString(),
          pinned: false,
        };

        return normalizeSavedViews([nextView, ...current.filter((view) => view.name !== normalizedName)]);
      });
    });
  };

  const handleApplySavedView = (viewId: string) => {
    const matchedView = savedViews.find((view) => view.id === viewId);
    if (!matchedView) {
      return;
    }

    startTransition(() => {
      setFilters({ ...matchedView.filters });
    });
  };

  const handleDeleteSavedView = (viewId: string) => {
    startTransition(() => {
      setSavedViews((current) => current.filter((view) => view.id !== viewId));
    });
  };

  const handleUpdateSavedView = (viewId: string) => {
    startTransition(() => {
      setSavedViews((current) =>
        normalizeSavedViews(
          current.map((view) =>
            view.id === viewId
              ? {
                  ...view,
                  filters: { ...filters },
                }
              : view,
          ),
        ),
      );
    });
  };

  const handleRenameSavedView = (viewId: string, name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    startTransition(() => {
      setSavedViews((current) =>
        normalizeSavedViews(
          current.map((view) => (view.id === viewId ? { ...view, name: normalizedName } : view)),
        ),
      );
    });
  };

  const handleTogglePinSavedView = (viewId: string) => {
    startTransition(() => {
      setSavedViews((current) =>
        normalizeSavedViews(
          current.map((view) => (view.id === viewId ? { ...view, pinned: !view.pinned } : view)),
        ),
      );
    });
  };

  const handleCreateBackup = async () => {
    setBackupBusy(true);
    setErrorMessage("");
    setBackupStatusMessage("");
    setBackupNotice("");

    try {
      const nextBackup = await createBackup();
      const readiness = await getBackupReadiness();
      setBackupNotice(`已创建备份：${nextBackup.label}`);
      startTransition(() => {
        setBackups((current) => [nextBackup, ...current.filter((item) => item.id !== nextBackup.id)]);
        setBackupReadiness(readiness);
        setBackupStatusMessage(`已创建备份：${nextBackup.label}`);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const targetBackup = backups.find((backup) => backup.id === backupId);
    const confirmMessage = targetBackup
      ? `将恢复备份“${targetBackup.label}”。\n其中包含 ${targetBackup.ticketCount} 张票和 ${targetBackup.attachmentCount} 个附件。\n恢复后会覆盖当前数据库和附件，确定继续吗？`
      : "恢复备份会覆盖当前数据库和附件，确定继续吗？";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBackupBusy(true);
    setErrorMessage("");
    setBackupStatusMessage("");
    setBackupNotice("");

    try {
      await restoreBackup(backupId);
      const [restoredTickets, restoredBackups, readiness] = await Promise.all([
        listTickets(),
        listBackups(),
        getBackupReadiness(),
      ]);
      const restoredBackup = restoredBackups.find((backup) => backup.id === backupId);
      setBackupNotice(restoredBackup ? `已恢复备份：${restoredBackup.label}` : "已恢复选中的备份。");
      startTransition(() => {
        setTickets(restoredTickets);
        setBackups(restoredBackups);
        setBackupReadiness(readiness);
        setSelectedId(restoredTickets[0]?.id ?? "");
        setEditingId("");
        setImportedDraft(null);
        setImportReview(null);
        setBackupStatusMessage(restoredBackup ? `已恢复备份：${restoredBackup.label}` : "已恢复选中的备份。");
        setDetailVersion((current) => current + 1);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleExportBackup = async (backupId: string) => {
    setBackupBusy(true);
    setErrorMessage("");
    setBackupStatusMessage("");

    try {
      const exportPath = await exportBackup(backupId);
      setBackupNotice(`备份已导出到：${exportPath}`);
      startTransition(() => {
        setBackupStatusMessage(`备份已导出到：${exportPath}`);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleExportArchiveBundle = async () => {
    setBackupBusy(true);
    setErrorMessage("");
    setBackupStatusMessage("");
    setBackupNotice("");

    try {
      const archivePath = await exportArchiveBundle();
      setBackupNotice(`整库包已导出：${archivePath}`);
      startTransition(() => {
        setBackupStatusMessage(`整库包已导出：${archivePath}`);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export archive bundle.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportArchiveBundle = async (bundlePath: string) => {
    if (!window.confirm("导入整库包会覆盖当前数据库和附件，确定继续吗？")) {
      return;
    }

    setBackupBusy(true);
    setErrorMessage("");
    setBackupStatusMessage("");
    setBackupNotice("");

    try {
      await importArchiveBundle(bundlePath);
      const [restoredTickets, restoredBackups, readiness] = await Promise.all([
        listTickets(),
        listBackups(),
        getBackupReadiness(),
      ]);
      setBackupNotice(`整库包已导入：${bundlePath}`);
      startTransition(() => {
        setTickets(restoredTickets);
        setBackups(restoredBackups);
        setBackupReadiness(readiness);
        setSelectedId(restoredTickets[0]?.id ?? "");
        setEditingId("");
        setImportedDraft(null);
        setImportReview(null);
        setBackupStatusMessage(`整库包已导入：${bundlePath}`);
        setDetailVersion((current) => current + 1);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to import archive bundle.");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <AppErrorBoundary>
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
              <BackupPanel
                backups={backups}
                readiness={backupReadiness}
                isBusy={backupBusy}
                onCreateBackup={handleCreateBackup}
                onExportArchiveBundle={handleExportArchiveBundle}
                onImportArchiveBundle={handleImportArchiveBundle}
                onExportBackup={handleExportBackup}
                onRestoreBackup={handleRestoreBackup}
                statusMessage={backupNotice || backupStatusMessage}
              />
              <StatisticsPanel
                activeArchiveContext={filters}
                onApplyArchiveFilter={handleApplyAnalyticsFilter}
                tickets={visibleTickets}
                totalCount={tickets.length}
              />
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
                onDeleteSavedView={handleDeleteSavedView}
                onEdit={handleEditTicket}
                onApplySavedView={handleApplySavedView}
                onFiltersChange={setFilters}
                onRenameSavedView={handleRenameSavedView}
                onResetFilters={() => setFilters(defaultFilters)}
                onSaveCurrentView={handleSaveCurrentView}
                onSelect={setSelectedId}
                onTogglePinSavedView={handleTogglePinSavedView}
                onUpdateSavedView={handleUpdateSavedView}
                onUpdateStatus={handleUpdateStatus}
                savedViews={savedViews}
                selectedId={selectedTicket?.id ?? ""}
                tickets={visibleTickets}
                totalCount={tickets.length}
              />
            </div>
            <Dashboard
              activeArchiveContext={filters}
              attachmentBusy={attachmentBusy}
              detail={selectedDetail}
              isLoading={detailLoading}
              onAddAttachment={handleAddAttachment}
              onApplyArchiveFilter={handleApplyArchiveQuery}
              onDeleteAttachment={handleDeleteAttachment}
              onSelectTicket={setSelectedId}
              ticket={selectedTicket}
              ticketsInView={visibleTickets}
              totalCount={tickets.length}
            />
          </section>
        </AppErrorBoundary>
      </main>
    </div>
  );
}

