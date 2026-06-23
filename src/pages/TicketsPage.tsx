import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Dashboard } from "../components/Dashboard";
import { SmartImport } from "../components/SmartImport";
import { TicketForm } from "../components/TicketForm";
import { TicketList, type TicketListView } from "../components/TicketList";
import { useI18n } from "../lib/i18n";

type SmartImportProps = ComponentProps<typeof SmartImport>;
type TicketFormProps = ComponentProps<typeof TicketForm>;
type TicketListProps = ComponentProps<typeof TicketList>;
type DashboardProps = ComponentProps<typeof Dashboard>;
type TicketsSubview = "browse" | "detail";
type TicketTypeTab = TicketListProps["filters"]["ticketType"];
type TicketComposerTab = "form" | "ocr" | "text";
type TicketDetailReturnContext =
  | {
      from: "journey-detail";
      journeyId: string;
    }
  | null;

interface TicketsPageProps {
  importProps: SmartImportProps;
  formProps: TicketFormProps;
  listProps: TicketListProps;
  dashboardProps: DashboardProps;
  detailBackContext?: TicketDetailReturnContext;
  detailOpenRequest?: string;
  onBackFromDetail?: () => void;
  onConsumeDetailOpenRequest?: () => void;
}

function cleanRouteTitleLabel(value: string | undefined) {
  const text = (value ?? "").trim();
  if (!text) {
    return "--";
  }

  return (
    text
      .replace(/\([^)]*\)/g, "")
      .replace(/国际机场$/u, "")
      .replace(/机场$/u, "")
      .replace(/火车站$/u, "")
      .replace(/高铁站$/u, "")
      .replace(/站$/u, "")
      .replace(/ International Airport$/i, "")
      .replace(/ Airport$/i, "")
      .replace(/ Railway Station$/i, "")
      .replace(/ Rail Station$/i, "")
      .replace(/ Train Station$/i, "")
      .replace(/ Station$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim() || text
  );
}

export function TicketsPage({
  importProps,
  formProps,
  listProps,
  dashboardProps,
  detailBackContext,
  detailOpenRequest,
  onBackFromDetail,
  onConsumeDetailOpenRequest,
}: TicketsPageProps) {
  const { t } = useI18n();
  const [subview, setSubview] = useState<TicketsSubview>("browse");
  const [showComposer, setShowComposer] = useState(false);
  const [composerTab, setComposerTab] = useState<TicketComposerTab>("form");
  const [viewMode, setViewMode] = useState<TicketListView>("list");

  const ticketTabs: Array<{ value: TicketTypeTab; label: string }> = [
    { value: "all", label: t("all") },
    { value: "flight", label: t("flights") },
    { value: "train", label: t("rail") },
  ];

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

  useEffect(() => {
    if (detailOpenRequest && dashboardProps.ticket) {
      setSubview("detail");
      onConsumeDetailOpenRequest?.();
    }
  }, [dashboardProps.ticket, detailOpenRequest, onConsumeDetailOpenRequest]);

  const detailHeader = useMemo(() => {
    if (!dashboardProps.ticket) {
      return {
        title: t("ticketDetail"),
        subtitle: "",
      };
    }

    const detail = dashboardProps.detail?.ticket.id === dashboardProps.ticket.id
      ? dashboardProps.detail
      : null;
    const departureTitle = cleanRouteTitleLabel(
      detail?.map.origin.label || dashboardProps.ticket.departure.name,
    );
    const arrivalTitle = cleanRouteTitleLabel(
      detail?.map.destination.label || dashboardProps.ticket.arrival.name,
    );
    const departureCode = dashboardProps.ticket.departure.code || detail?.map.origin.code || "--";
    const arrivalCode = dashboardProps.ticket.arrival.code || detail?.map.destination.code || "--";

    return {
      title: `${departureTitle} to ${arrivalTitle}`,
      subtitle: `${departureCode} -> ${arrivalCode}`,
    };
  }, [dashboardProps.detail, dashboardProps.ticket, t]);

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
    setComposerTab("ocr");
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

  const handleBackFromDetail = () => {
    if (detailBackContext?.from === "journey-detail") {
      onBackFromDetail?.();
      return;
    }

    setSubview("browse");
  };

  const composerModal = showComposer ? (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label={formProps.mode === "edit" ? t("editTicketRecord") : t("addTicket")}
        aria-modal="true"
        className="modal-shell tickets-modal"
        role="dialog"
      >
        <div className="tickets-modal-header">
          <h3>{formProps.mode === "edit" ? t("editTicketRecord") : t("addTicket")}</h3>
          <button
            aria-label={`${t("close")} ${formProps.mode === "edit" ? t("edit") : t("addTicket")}`}
            className="modal-close-button"
            onClick={handleCancelComposer}
            type="button"
          >
            <svg aria-hidden="true" className="modal-close-icon" viewBox="0 0 24 24">
              <path
                d="M6.7 6.7a1 1 0 0 1 1.4 0L12 10.59l3.9-3.9a1 1 0 1 1 1.4 1.42L13.41 12l3.9 3.9a1 1 0 0 1-1.42 1.4L12 13.41l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.89-3.89-3.9-3.9a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {formProps.mode === "create" ? (
          <div className="tickets-modal-tabs">
            <button
              className={composerTab === "form" ? "theme-chip active" : "theme-chip"}
              onClick={() => setComposerTab("form")}
              type="button"
            >
              Manual
            </button>
            <button
              className={composerTab === "ocr" ? "theme-chip active" : "theme-chip"}
              onClick={() => setComposerTab("ocr")}
              type="button"
            >
              Image OCR
            </button>
            <button
              className={composerTab === "text" ? "theme-chip active" : "theme-chip"}
              onClick={() => setComposerTab("text")}
              type="button"
            >
              Text import
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
            <SmartImport
              {...importProps}
              mode={composerTab === "text" ? "text" : "ocr"}
              onApplyImport={handleApplyImport}
            />
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
          <button className="ghost-button compact-button" onClick={handleBackFromDetail} type="button">
            {t("backToList")}
          </button>
          <div className="tickets-detail-title">
            <h3>{detailHeader.title}</h3>
            <p>{detailHeader.subtitle}</p>
          </div>
          <div className="tickets-subview-actions">
            <button className="ghost-button compact-button" onClick={handleEditSelectedTicket} type="button">
              {t("edit")}
            </button>
            <button
              aria-label={t("deleteTicket")}
              className="ghost-button compact-button danger-button ticket-delete-button"
              disabled={isDeleting}
              onClick={() => void handleDeleteSelectedTicket()}
              title={t("deleteTicket")}
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
        <Dashboard {...dashboardProps} mode="tickets" />
        {composerModal}
      </section>
    );
  }

  return (
    <section className="section-stack tickets-browse-view">
      <div className="tickets-topbar">
        <div className="tickets-browse-switch-row">
          <div aria-label="Ticket type views" className="tickets-tab-group" role="tablist">
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
          <span className="tickets-switch-divider" aria-hidden="true">/</span>
          <div className="tickets-tab-group" role="tablist" aria-label="Ticket view mode">
            <button
              aria-selected={viewMode === "list"}
              className={viewMode === "list" ? "theme-chip active" : "theme-chip"}
              onClick={() => setViewMode("list")}
              role="tab"
              type="button"
            >
              {t("list")}
            </button>
            <button
              aria-selected={viewMode === "timeline"}
              className={viewMode === "timeline" ? "theme-chip active" : "theme-chip"}
              onClick={() => setViewMode("timeline")}
              role="tab"
              type="button"
            >
              {t("timeline")}
            </button>
          </div>
        </div>

        <div className="tickets-topbar-actions">
          <button className="primary-button" onClick={handleOpenComposer} type="button">
            {t("addTicket")}
          </button>
          <button className="ghost-button" onClick={handleOpenImportComposer} type="button">
            {t("ocrImport")}
          </button>
        </div>
      </div>

      <TicketList {...listProps} onSelect={handleSelectTicket} onViewModeChange={setViewMode} viewMode={viewMode} />
      {composerModal}
    </section>
  );
}
