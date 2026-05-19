import { useMemo, useState } from "react";
import { parseImportedText, type ImportParseResult } from "../lib/importParser";
import type { TicketDraft } from "../types/ticket";

interface SmartImportProps {
  onApplyImport: (draft: TicketDraft) => void;
}

export function SmartImport({ onApplyImport }: SmartImportProps) {
  const [rawText, setRawText] = useState("");
  const [lastApplied, setLastApplied] = useState("");

  const parsed = useMemo<ImportParseResult | null>(() => parseImportedText(rawText), [rawText]);

  const handleApply = () => {
    if (!parsed) {
      return;
    }

    onApplyImport(parsed.draft);
    setLastApplied(parsed.detectedType === "train" ? "已将火车票信息填入表单。" : "已将机票信息填入表单。");
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Import</p>
          <h3>Smart text import</h3>
        </div>
        <span className="status-pill">{parsed ? `${parsed.matchedFields.length} fields matched` : "Paste OCR text"}</span>
      </div>

      <div className="smart-import">
        <label>
          OCR / copied ticket text
          <textarea
            className="import-textarea"
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste OCR output, SMS, email text, or copied ticket details here..."
            value={rawText}
          />
        </label>

        {parsed ? (
          <div className="import-preview">
            <div className="import-summary">
              <span className="ticket-status ticket-status-saved">{parsed.detectedType}</span>
              <strong>{parsed.draft.code || "No code detected yet"}</strong>
              <p>{`${parsed.draft.departure.name || "--"} -> ${parsed.draft.arrival.name || "--"}`}</p>
            </div>
            <div className="import-grid">
              <div className="detail-card">
                <span>Carrier</span>
                <strong>{parsed.draft.carrierName || "Pending"}</strong>
              </div>
              <div className="detail-card">
                <span>Departure time</span>
                <strong>{parsed.draft.departureTimeLocal || "Pending"}</strong>
              </div>
              <div className="detail-card">
                <span>Arrival time</span>
                <strong>{parsed.draft.arrivalTimeLocal || "Pending"}</strong>
              </div>
            </div>
            {parsed.warnings.length ? (
              <div className="import-warnings">
                {parsed.warnings.map((warning) => (
                  <p className="error-banner" key={warning}>
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="form-actions">
              <button className="primary-button" onClick={handleApply} type="button">
                Apply to form
              </button>
              <button className="ghost-button" onClick={() => setRawText("")} type="button">
                Clear text
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>Ready for semi-automatic import</strong>
            <p>Paste recognized text from screenshots, PDFs, SMS, or booking pages to auto-fill the form.</p>
          </div>
        )}

        {lastApplied ? <p className="detail-loading">{lastApplied}</p> : null}
      </div>
    </section>
  );
}
