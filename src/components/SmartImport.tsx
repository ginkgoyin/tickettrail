import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  parseImportedText,
  reviewImportedDraft,
  type ImportFieldReview,
  type ImportParseResult,
} from "../lib/importParser";
import { searchAirlines } from "../lib/ticketService";
import { recognizeTicketImage } from "../lib/ocrService";

interface SmartImportProps {
  onApplyImport: (result: ImportParseResult) => void;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toConfidenceLabel(value: number) {
  if (value >= 0.8) return "\u9ad8";
  if (value >= 0.55) return "\u4e2d";
  return "\u4f4e";
}

export function SmartImport({ onApplyImport }: SmartImportProps) {
  const [rawText, setRawText] = useState("");
  const [lastApplied, setLastApplied] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);
  const [airlineReviews, setAirlineReviews] = useState<ImportFieldReview[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo<ImportParseResult | null>(() => parseImportedText(rawText), [rawText]);
  const fieldReviews = useMemo<ImportFieldReview[]>(() => (parsed ? reviewImportedDraft(parsed) : []), [parsed]);
  const mergedReviews = useMemo(() => {
    if (!airlineReviews.length) {
      return fieldReviews;
    }

    const merged = [...fieldReviews];
    const carrierReviewIndex = merged.findIndex((review) => review.field === "carrierName");

    if (carrierReviewIndex >= 0) {
      merged[carrierReviewIndex] = airlineReviews[0];
      return merged;
    }

    return [...airlineReviews, ...merged];
  }, [airlineReviews, fieldReviews]);

  useEffect(() => {
    let isMounted = true;

    const loadAirlineCandidates = async () => {
      if (!parsed || parsed.detectedType !== "flight") {
        setAirlineReviews([]);
        return;
      }

      const airlineCode = parsed.draft.code.slice(0, 2).trim();
      const query = [airlineCode, parsed.draft.carrierName].filter(Boolean).join(" ").trim();
      if (!query) {
        setAirlineReviews([]);
        return;
      }

      try {
        const candidates = await searchAirlines(query);
        if (!isMounted || !candidates.length) {
          if (isMounted) {
            setAirlineReviews([]);
          }
          return;
        }

        const candidateNames = candidates.map((candidate) => candidate.nameEn);
        const existingName = parsed.draft.carrierName.trim();
        const needsReview = !existingName || !candidateNames.includes(existingName);

        if (!needsReview) {
          setAirlineReviews([]);
          return;
        }

        setAirlineReviews([
          {
            field: "carrierName",
            label: "承运方",
            severity: "suggestion",
            message: "本地航空公司主数据提供了更可靠的候选，可直接选择。",
            suggestedValue: candidateNames[0],
            suggestedValues: candidateNames,
          },
        ]);
      } catch {
        if (isMounted) {
          setAirlineReviews([]);
        }
      }
    };

    void loadAirlineCandidates();

    return () => {
      isMounted = false;
    };
  }, [parsed]);

  const handleApply = () => {
    if (!parsed) {
      return;
    }

    onApplyImport(parsed);
    setLastApplied(
      parsed.detectedType === "train"
        ? "\u5df2\u5c06\u706b\u8f66\u7968\u4fe1\u606f\u586b\u5165\u8868\u5355\u3002"
        : "\u5df2\u5c06\u673a\u7968\u4fe1\u606f\u586b\u5165\u8868\u5355\u3002",
    );
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsRecognizing(true);
    setLastApplied("");
    setOcrStatus("\u6b63\u5728\u521d\u59cb\u5316 OCR...");
    setOcrProgress(0);
    setOcrConfidence(0);

    try {
      const result = await recognizeTicketImage(file, (progress) => {
        setOcrStatus(progress.status);
        setOcrProgress(progress.progress);
      });

      setRawText(result.text);
      setOcrConfidence(result.confidence);
      setOcrStatus("\u8bc6\u522b\u5b8c\u6210\uff0c\u53ef\u4ee5\u76f4\u63a5\u5957\u7528\u5230\u8868\u5355\u3002");
      setOcrProgress(1);
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "\u56fe\u7247 OCR \u8bc6\u522b\u5931\u8d25\u3002");
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
            {isRecognizing ? "\u6b63\u5728\u8bc6\u522b\u56fe\u7247..." : "\u4ece\u7968\u636e\u622a\u56fe\u8bc6\u522b"}
          </button>
          <span className="detail-loading">
            {"\u4e5f\u53ef\u4ee5\u76f4\u63a5\u7c98\u8d34 OCR \u7ed3\u679c\u6216\u590d\u5236\u6587\u672c"}
          </span>
        </div>

        {ocrStatus ? (
          <div className="ocr-status-card">
            <div className="ocr-status-main">
              <strong>{ocrStatus}</strong>
              <small>{`\u8fdb\u5ea6 ${toPercent(ocrProgress)}`}</small>
            </div>
            <span className="ticket-status ticket-status-confidence">
              {`\u8bc6\u5b57\u7f6e\u4fe1\u5ea6 ${toConfidenceLabel(ocrConfidence)} ${toPercent(ocrConfidence)}`}
            </span>
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
              <div className="import-summary-top">
                <span className="ticket-status ticket-status-saved">{parsed.detectedType}</span>
                <span className="ticket-status ticket-status-confidence">
                  {`\u7f6e\u4fe1\u5ea6 ${toConfidenceLabel(parsed.confidence)} ${toPercent(parsed.confidence)}`}
                </span>
              </div>
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
            <div className="import-actions">
              <button
                className="ghost-button compact-button"
                onClick={() => setShowNormalized((current) => !current)}
                type="button"
              >
                {showNormalized ? "\u9690\u85cf\u7ea0\u9519\u6587\u672c" : "\u67e5\u770b\u7ea0\u9519\u540e\u6587\u672c"}
              </button>
            </div>
            {showNormalized ? (
              <div className="normalized-text-panel">
                <strong>Normalized OCR text</strong>
                <pre>{parsed.normalizedText}</pre>
              </div>
            ) : null}
            {mergedReviews.length ? (
              <div className="import-review-list">
                {mergedReviews.map((review) => (
                  <div className="import-review-card" key={`${review.field}-${review.message}`}>
                    <div className="import-review-header">
                      <strong>{review.label}</strong>
                      <span
                        className={
                          review.severity === "warning"
                            ? "ticket-status ticket-status-warning"
                            : "ticket-status ticket-status-suggestion"
                        }
                      >
                        {review.severity === "warning" ? "\u9700\u8981\u68c0\u67e5" : "\u53ef\u76f4\u63a5\u5957\u7528"}
                      </span>
                    </div>
                    <p>{review.message}</p>
                    {review.suggestedValues?.length ? (
                      <div className="field-suggestion-chip-list">
                        {review.suggestedValues.map((suggestedValue) => (
                          <code className="field-suggestion-code" key={`${review.field}-${suggestedValue}`}>
                            {suggestedValue}
                          </code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
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
