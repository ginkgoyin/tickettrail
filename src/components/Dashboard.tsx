import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  buildMapSvgFromSegments,
  buildStubSvg,
  exportPng,
  exportSvg,
  type StubTheme,
  visualizationSizes,
} from "../lib/visualization";
import type { TicketAttachment, TicketDetailPayload, TicketRecord } from "../types/ticket";

const RouteMap = lazy(async () => import("./RouteMap").then((module) => ({ default: module.RouteMap })));

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
  attachmentBusy: boolean;
  onAddAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}

function isImageAttachment(attachment: TicketAttachment) {
  return attachment.mimeType.startsWith("image/");
}

export function Dashboard({
  detail,
  isLoading,
  ticket,
  attachmentBusy,
  onAddAttachment,
  onDeleteAttachment,
}: DashboardProps) {
  const [exportMessage, setExportMessage] = useState("");
  const [stubTheme, setStubTheme] = useState<StubTheme>("boarding");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const activeDetail = detail?.ticket.id === ticket.id ? detail : null;
  const isTrainTicket = ticket.ticketType === "train";

  useEffect(() => {
    setStubTheme(isTrainTicket ? "ledger" : "boarding");
  }, [isTrainTicket, ticket.id]);

  const mapSvg = useMemo(
    () => (activeDetail ? buildMapSvgFromSegments(activeDetail.map, activeDetail.segments) : ""),
    [activeDetail],
  );
  const stubSvg = useMemo(
    () => (activeDetail ? buildStubSvg(activeDetail.stub, stubTheme, activeDetail.segments) : ""),
    [activeDetail, stubTheme],
  );

  const handleExportSvg = (kind: "map" | "stub") => {
    if (!activeDetail) {
      return;
    }

    if (kind === "map") {
      exportSvg(`${activeDetail.ticket.code}-route-map.svg`, mapSvg);
      setExportMessage("\u8def\u7ebf SVG \u5df2\u5bfc\u51fa\u3002");
      return;
    }

    exportSvg(`${activeDetail.ticket.code}-ticket-stub.svg`, stubSvg);
    setExportMessage("\u7968\u6839 SVG \u5df2\u5bfc\u51fa\u3002");
  };

  const handleExportPng = async () => {
    if (!activeDetail) {
      return;
    }

    try {
      await exportPng(
        `${activeDetail.ticket.code}-ticket-stub.png`,
        stubSvg,
        visualizationSizes.stub.width,
        visualizationSizes.stub.height,
      );
      setExportMessage("\u7968\u6839 PNG \u5df2\u5bfc\u51fa\u3002");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "PNG \u5bfc\u51fa\u5931\u8d25\u3002");
    }
  };

  const handleChooseAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await onAddAttachment(file);
  };

  const themeOptions: StubTheme[] = isTrainTicket
    ? ["ledger", "boarding", "night"]
    : ["boarding", "ledger", "night"];

  return (
    <section className="panel dashboard">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>{ticket.routeLabel}</h3>
        </div>
        <span className="status-pill">{`${ticket.status} | ${ticket.segmentCount} segment(s)`}</span>
      </div>

      {isLoading ? (
        <p className="detail-loading">
          {"\u6b63\u5728\u52a0\u8f7d\u8def\u7ebf\u3001\u7968\u6839\u548c\u9644\u4ef6\u6570\u636e..."}
        </p>
      ) : null}

      <article className="map-preview">
        {activeDetail ? (
          <>
            <Suspense
              fallback={
                <p className="detail-loading">
                  {"\u6b63\u5728\u52a0\u8f7d\u771f\u5b9e\u5730\u56fe\u7ec4\u4ef6..."}
                </p>
              }
            >
              <RouteMap route={activeDetail.map} segments={activeDetail.segments} />
            </Suspense>
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("map")} type="button">
                {"\u5bfc\u51fa\u8def\u7ebf SVG"}
              </button>
            </div>
            {activeDetail.segments.length > 1 ? (
              <div className="segment-stack">
                {activeDetail.segments.map((segment) => (
                  <article className="segment-card" key={`${segment.code}-${segment.segmentIndex}`}>
                    <div className="segment-card-top">
                      <div>
                        <span className="ticket-kind">{`Segment ${segment.segmentIndex + 1}`}</span>
                        <strong>{segment.lineLabel}</strong>
                      </div>
                      <span className="status-pill">{segment.distanceHintKm} km</span>
                    </div>
                    <div className="ticket-meta">
                      <span>{segment.code || "--"}</span>
                      <span>{segment.carrierName}</span>
                      <span>{segment.directionHint}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="map-grid">
            <div className="map-node">
              <span>FROM</span>
              <strong>{ticket.departure.code || "--"}</strong>
              <p>{ticket.departure.name}</p>
            </div>
            <div className="map-line">
              <span className="line-dot" />
              <span className="line-path" />
              <span className="line-arrow">{"->"}</span>
            </div>
            <div className="map-node">
              <span>TO</span>
              <strong>{ticket.arrival.code || "--"}</strong>
              <p>{ticket.arrival.name}</p>
            </div>
          </div>
        )}
        {activeDetail ? (
          <div className="map-summary">
            <span>{activeDetail.map.directionHint}</span>
            <span>{activeDetail.map.distanceHintKm} km</span>
            <span>
              {activeDetail.map.viewport.minLatitude.toFixed(2)} /{" "}
              {activeDetail.map.viewport.maxLatitude.toFixed(2)} lat
            </span>
          </div>
        ) : null}
      </article>

      <article className="stub-preview">
        {activeDetail ? (
          <>
            <div className="theme-switcher">
              {themeOptions.map((theme) => (
                <button
                  key={theme}
                  className={stubTheme === theme ? "theme-chip active" : "theme-chip"}
                  onClick={() => setStubTheme(theme)}
                  type="button"
                >
                  {theme === "boarding"
                    ? "\u767b\u673a\u724c"
                    : theme === "ledger"
                      ? "\u62a5\u9500\u51ed\u8bc1"
                      : "\u591c\u95f4\u9713\u8679"}
                </button>
              ))}
            </div>
            <div className="svg-frame stub-canvas" dangerouslySetInnerHTML={{ __html: stubSvg }} />
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("stub")} type="button">
                {"\u5bfc\u51fa\u7968\u6839 SVG"}
              </button>
              <button className="primary-button" onClick={() => void handleExportPng()} type="button">
                {"\u5bfc\u51fa\u7968\u6839 PNG"}
              </button>
            </div>
          </>
        ) : (
          <>
            <header>
              <span>{ticket.ticketType.toUpperCase()}</span>
              <strong>{ticket.code}</strong>
            </header>
            <div className="stub-body">
              <div>
                <span>{ticket.departure.name}</span>
                <strong>{ticket.departureTimeLocal.replace("T", " ")}</strong>
              </div>
              <div>
                <span>{ticket.arrival.name}</span>
                <strong>{ticket.arrivalTimeLocal.replace("T", " ")}</strong>
              </div>
            </div>
            <footer>
              <span>{ticket.carrierName}</span>
              <span>{`${ticket.classInfo || "TBD"} / ${ticket.seatInfo || "TBD"}`}</span>
            </footer>
          </>
        )}
      </article>

      <article className="attachments-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Attachments</p>
            <h3>Original ticket files</h3>
          </div>
          <span className="status-pill">{activeDetail?.attachments.length ?? 0} files</span>
        </div>
        <input
          accept="image/*,application/pdf"
          className="hidden-file-input"
          onChange={(event) => void handleFileChange(event)}
          ref={fileInputRef}
          type="file"
        />
        <div className="export-row">
          <button
            className="primary-button"
            disabled={!activeDetail || attachmentBusy}
            onClick={handleChooseAttachment}
            type="button"
          >
            {attachmentBusy ? "\u6b63\u5728\u5904\u7406\u9644\u4ef6..." : "\u6dfb\u52a0\u9644\u4ef6"}
          </button>
        </div>
        {activeDetail?.attachments.length ? (
          <div className="attachment-grid">
            {activeDetail.attachments.map((attachment) => (
              <article className="attachment-card" key={attachment.id}>
                {isImageAttachment(attachment) && attachment.previewUrl ? (
                  <img
                    alt={attachment.fileName}
                    className="attachment-preview"
                    src={attachment.previewUrl}
                  />
                ) : (
                  <div className="attachment-fallback">
                    <strong>{attachment.mimeType.includes("pdf") ? "PDF" : "FILE"}</strong>
                  </div>
                )}
                <div className="attachment-meta">
                  <strong>{attachment.fileName}</strong>
                  <span>{Math.max(1, Math.round(attachment.fileSize / 1024))} KB</span>
                  <span>{attachment.createdAt.replace("T", " ").slice(0, 16)}</span>
                </div>
                <div className="attachment-actions">
                  {attachment.previewUrl ? (
                    <a className="ghost-button compact-button" href={attachment.previewUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                  <button
                    className="ghost-button compact-button danger-button"
                    disabled={attachmentBusy}
                    onClick={() => void onDeleteAttachment(attachment.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No attachments yet</strong>
            <p>Upload screenshots, scanned tickets, or PDF reimbursement files for this record.</p>
          </div>
        )}
      </article>

      {exportMessage ? <p className="detail-loading">{exportMessage}</p> : null}

      {ticket.segments?.length ? (
        <article className="detail-card">
          <span>Onward itinerary</span>
          <strong>{`${ticket.segments.length} saved onward segment(s)`}</strong>
          <p className="map-summary">
            {ticket.segments.map((segment, index) => (
              <span key={`${segment.code}-${index}`}>
                {`${index + 2}. ${segment.departure.name} -> ${segment.arrival.name} (${segment.code || "--"})`}
              </span>
            ))}
          </p>
        </article>
      ) : null}

      <article className="detail-grid">
        <div className="detail-card">
          <span>Departure timezone</span>
          <strong>{ticket.departure.timezone}</strong>
        </div>
        <div className="detail-card">
          <span>Arrival timezone</span>
          <strong>{ticket.arrival.timezone}</strong>
        </div>
        <div className="detail-card">
          <span>Notes</span>
          <strong>{activeDetail?.stub.notes || ticket.notes || "No notes yet"}</strong>
        </div>
        <div className="detail-card">
          <span>{"\u8d77\u70b9\u5750\u6807"}</span>
          <strong>
            {activeDetail
              ? `${activeDetail.map.origin.latitude.toFixed(2)}, ${activeDetail.map.origin.longitude.toFixed(2)}`
              : "Pending"}
          </strong>
        </div>
      </article>
    </section>
  );
}
