import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Dashboard } from "../components/Dashboard";
import { SmartImport } from "../components/SmartImport";
import { TicketForm } from "../components/TicketForm";
import { TicketList } from "../components/TicketList";

type SmartImportProps = ComponentProps<typeof SmartImport>;
type TicketFormProps = ComponentProps<typeof TicketForm>;
type TicketListProps = ComponentProps<typeof TicketList>;
type DashboardProps = ComponentProps<typeof Dashboard>;
type TicketsSubview = "browse" | "detail";
type TicketTypeTab = TicketListProps["filters"]["ticketType"];
type TicketComposerTab = "form" | "import";

interface TicketsPageProps {
  importProps: SmartImportProps;
  formProps: TicketFormProps;
  listProps: TicketListProps;
  dashboardProps: DashboardProps;
}

const ticketTabs: Array<{ value: TicketTypeTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "flight", label: "Flights" },
  { value: "train", label: "Rail" },
];

export function TicketsPage({
  importProps,
  formProps,
  listProps,
  dashboardProps,
}: TicketsPageProps) {
  const [subview, setSubview] = useState<TicketsSubview>("browse");
  const [showComposer, setShowComposer] = useState(false);
  const [composerTab, setComposerTab] = useState<TicketComposerTab>("form");

  const shouldForceComposerOpen = Boolean(
    formProps.mode === "edit" || formProps.initialDraft || formProps.importedDraft || formProps.importReview?.length,
  );

  useEffect(() => {
    if (shouldForceComposerOpen) {
      setShowComposer(true);
      setComposerTab("form");
    }
  }, [shouldForceComposerOpen]);

  useEffect(() => {
    if (!dashboardProps.ticket && subview === "detail") {
      setSubview("browse");
    }
  }, [dashboardProps.ticket, subview]);

  const detailTitle = useMemo(() => {
    if (!dashboardProps.ticket) {
      return "Ticket detail";
    }

    return `${dashboardProps.ticket.routeLabel} - ${dashboardProps.ticket.code}`;
  }, [dashboardProps.ticket]);

  const handleTabChange = (ticketType: TicketTypeTab) => {
    listProps.onFiltersChange({
      ...listProps.filters,
      ticketType,
    });
    setSubview("browse");
  };

  const handleSelectTicket = (ticketId: string) => {
    listProps.onSelect(ticketId);
    setSubview("detail");
  };

  const handleOpenComposer = () => {
    setShowComposer(true);
    setComposerTab("form");
    setSubview("browse");
  };

  const handleCancelComposer = () => {
    setShowComposer(false);
    setComposerTab("form");
    formProps.onCancelEdit?.();
  };

  const handleOpenImportComposer = () => {
    setShowComposer(true);
    setComposerTab("import");
    setSubview("browse");
  };

  const handleApplyImport = (result: Parameters<SmartImportProps["onApplyImport"]>[0]) => {
    importProps.onApplyImport(result);
    setComposerTab("form");
  };

  const handleSubmitTicket = async (draft: Parameters<TicketFormProps["onSubmitTicket"]>[0]) => {
    const wasEditing = formProps.mode === "edit";
    await formProps.onSubmitTicket(draft);
    setShowComposer(false);
    setComposerTab("form");
    setSubview(wasEditing ? "detail" : "browse");
  };

  const handleEditSelectedTicket = () => {
    if (!dashboardProps.ticket) {
      return;
    }

    listProps.onEdit(dashboardProps.ticket.id);
    setShowComposer(true);
    setComposerTab("form");
  };

  const handleDeleteSelectedTicket = async () => {
    if (!dashboardProps.ticket) {
      return;
    }

    const deleted = await Promise.resolve(listProps.onDelete(dashboardProps.ticket.id));
    if (deleted) {
      setShowComposer(false);
      setComposerTab("form");
      setSubview("browse");
    }
  };

  const composerModal = showComposer ? (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label={formProps.mode === "edit" ? "Edit ticket dialog" : "Add ticket dialog"}
        aria-modal="true"
        className="modal-shell tickets-modal"
        role="dialog"
      >
        <div className="tickets-modal-header">
          <h3>{formProps.mode === "edit" ? "Edit ticket record" : "Add ticket"}</h3>
          <button
            aria-label={formProps.mode === "edit" ? "Close edit ticket" : "Close add ticket"}
            className="modal-close-button"
            onClick={handleCancelComposer}
            type="button"
          >
            X
          </button>
        </div>

        {formProps.mode === "create" ? (
          <div className="tickets-modal-tabs">
            <button
              className={composerTab === "form" ? "theme-chip active" : "theme-chip"}
              onClick={() => setComposerTab("form")}
              type="button"
            >
              Ticket form
            </button>
            <button
              className={composerTab === "import" ? "theme-chip active" : "theme-chip"}
              onClick={() => setComposerTab("import")}
              type="button"
            >
              OCR / import
            </button>
          </div>
        ) : null}

        <div className="tickets-modal-body">
          {formProps.mode === "edit" || composerTab === "form" ? (
            <TicketForm
              {...formProps}
              onCancelEdit={handleCancelComposer}
              onSubmitTicket={handleSubmitTicket}
            />
          ) : (
            <SmartImport {...importProps} onApplyImport={handleApplyImport} />
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (subview === "detail" && dashboardProps.ticket) {
    const isDeleting = listProps.busyTicketId === dashboardProps.ticket.id;

    return (
      <section className="section-stack tickets-detail-view">
        <div className="tickets-subview-header">
          <button className="ghost-button compact-button" onClick={() => setSubview("browse")} type="button">
            Back to list
          </button>
          <div className="tickets-subview-heading">
            <div>
              <span className="ticket-kind">Selected ticket</span>
              <h3>{detailTitle}</h3>
            </div>
            <div className="tickets-subview-actions">
              <button className="ghost-button compact-button" onClick={handleEditSelectedTicket} type="button">
                Edit
              </button>
              <button
                aria-label="Delete ticket"
                className="ghost-button compact-button danger-button ticket-delete-button"
                disabled={isDeleting}
                onClick={() => void handleDeleteSelectedTicket()}
                title="Delete ticket"
                type="button"
              >
                <svg aria-hidden="true" className="ticket-delete-icon" viewBox="0 0 24 24">
                  <path
                    d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm1 11a2 2 0 0 1-2-2V8h12v10a2 2 0 0 1-2 2H8Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <Dashboard {...dashboardProps} mode="tickets" />
        {composerModal}
      </section>
    );
  }

  return (
    <section className="section-stack tickets-browse-view">
      <div className="tickets-topbar">
        <div className="tickets-tab-group" role="tablist" aria-label="Ticket type views">
          {ticketTabs.map((tab) => (
            <button
              aria-selected={listProps.filters.ticketType === tab.value}
              className={listProps.filters.ticketType === tab.value ? "theme-chip active" : "theme-chip"}
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tickets-topbar-actions">
          <button className="primary-button" onClick={handleOpenComposer} type="button">
            Add ticket
          </button>
          <button className="ghost-button" onClick={handleOpenImportComposer} type="button">
            OCR / import
          </button>
        </div>
      </div>

      <TicketList {...listProps} onSelect={handleSelectTicket} />
      {composerModal}
    </section>
  );
}
