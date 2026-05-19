import { useMemo, useRef, useState } from "react";
import { parseImportedText, type ImportParseResult } from "../lib/importParser";
import { recognizeTicketImage } from "../lib/ocrService";
import type { TicketDraft } from "../types/ticket";

interface SmartImportProps {
  onApplyImport: (draft: TicketDraft) => void;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function SmartImport({ onApplyImport }: SmartImportProps) {
  const [rawText, setRawText] = useState("");
  const [lastApplied, setLastApplied] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo<ImportParseResult | null>(() => parseImportedText(rawText), [rawText]);

  const handleApply = () => {
    if (!parsed) {
      return;
    }

    onApplyImport(parsed.draft);
    setLastApplied(
      parsed.detectedType === "train"
        ? "\u5df2\u5c06\u706b\u8f66\u7968\u4fe1\u606f\u586b\u5165\u8868\u5355\u3002"
        : "\u5df2\u5c06\u673a\u7968\u4fe1\u606f\u586b\u5165\u8868\u5355\u3002",
    );
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsRecognizing(true);
    setLastApplied("");
    setOcrStatus("\u6b63\u5728\u521d\u59cb\u5316 OCR...");
    setOcrProgress(0);

    try {
      const result = await recognizeTicketImage(file, (progress) => {
        setOcrStatus(progress.status);
        setOcrProgress(progress.progress);
      });

      setRawText(result.text);
      setOcrStatus("\u8bc6\u522b\u5b8c\u6210\uff0c\u53ef\u4ee5\u76f4\u63a5\u5957\u7528\u5230\u8868\u5355\u3002");
      setOcrProgress(1);
    } catch (error) {
      setOcrStatus(
        error instanceof Error
          ? error.message
          : "\u56fe\u7247 OCR \u8bc6\u522b\u5931\u8d25\u3002",
      );
    } finally {
      setIsRecognizing(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Import</p>
          <h3>Smart text import</h3>
        </div>
        <span className="status-pill">
          {parsed ? `${parsed.matchedFields.length} fields matched` : "Paste OCR text"}
        </span>
      </div>

      <div className="smart-import">
        <input
          accept="image/png,image/jpeg,image/webp,image/bmp"
          className="hidden-file-input"
          onChange={(event) => void handleImageChange(event)}
          ref={fileInputRef}
          type="file"
        />

        <div className="import-actions">
          <button
            className="primary-button"
            disabled={isRecognizing}
            onClick={handleChooseImage}
            type="button"
          >
            {isRecognizing
              ? "\u6b63\u5728\u8bc6\u522b\u56fe\u7247..."
              : "\u4ece\u7968\u636e\u622a\u56fe\u8bc6\u522b"}
          </button>
          <span className="detail-loading">
            {"\u4e5f\u53ef\u4ee5\u76f4\u63a5\u7c98\u8d34 OCR \u7ed3\u679c\u6216\u590d\u5236\u6587\u672c"}
          </span>
        </div>

        {ocrStatus ? (
          <div className="ocr-status-card">
            <strong>{ocrStatus}</strong>
            <span>{toPercent(ocrProgress)}</span>
          </div>
        ) : null}

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
