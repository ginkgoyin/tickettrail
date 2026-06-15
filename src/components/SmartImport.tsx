import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  parseImportedText,
  reviewImportedDraft,
  type ImportFieldReview,
  type ImportParseResult,
} from "../lib/importParser";
import { searchAirlines, searchLocations } from "../lib/ticketService";
import { recognizeTicketImage } from "../lib/ocrService";

interface SmartImportProps {
  mode?: "ocr" | "text";
  onApplyImport: (result: ImportParseResult) => void;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toConfidenceLabel(value: number) {
  if (value >= 0.8) return "High";
  if (value >= 0.55) return "Medium";
  return "Low";
}

function upsertReview(reviews: ImportFieldReview[], nextReview: ImportFieldReview) {
  const next = [...reviews];
  const index = next.findIndex((review) => review.field === nextReview.field);
  if (index >= 0) {
    next[index] = nextReview;
    return next;
  }

  next.push(nextReview);
  return next;
}

export function SmartImport({ mode = "ocr", onApplyImport }: SmartImportProps) {
  const [rawText, setRawText] = useState("");
  const [lastApplied, setLastApplied] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);
  const [directoryReviews, setDirectoryReviews] = useState<ImportFieldReview[]>([]);
  const [sourceMode, setSourceMode] = useState<"ocr" | "text">(mode);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo<ImportParseResult | null>(() => parseImportedText(rawText), [rawText]);
  const fieldReviews = useMemo<ImportFieldReview[]>(() => (parsed ? reviewImportedDraft(parsed) : []), [parsed]);
  const mergedReviews = useMemo(() => {
    if (!directoryReviews.length) {
      return fieldReviews;
    }

    return directoryReviews.reduce((current, nextReview) => upsertReview(current, nextReview), [...fieldReviews]);
  }, [directoryReviews, fieldReviews]);

  useEffect(() => {
    setSourceMode(mode);
  }, [mode]);

  useEffect(() => {
    let isMounted = true;

    const loadDirectoryReviews = async () => {
      if (!parsed) {
        setDirectoryReviews([]);
        return;
      }

      let nextReviews: ImportFieldReview[] = [];

      if (parsed.detectedType === "flight") {
        const airlineCode = parsed.draft.code.slice(0, 2).trim();
        const airlineQuery = [airlineCode, parsed.draft.carrierName].filter(Boolean).join(" ").trim();
        if (airlineQuery) {
          try {
            const candidates = await searchAirlines(airlineQuery);
            const candidateNames = candidates.map((candidate) => candidate.nameEn);
            const existingName = parsed.draft.carrierName.trim();

            if (candidateNames.length && (!existingName || !candidateNames.includes(existingName))) {
              nextReviews = upsertReview(nextReviews, {
                field: "carrierName",
                label: "Carrier / operator",
                severity: "suggestion",
                message: "Local airline directory found a stronger carrier match you can apply to the form.",
                suggestedValue: candidateNames[0],
                suggestedValues: candidateNames,
              });
            }
          } catch {
            // Keep parser-only fallback when directory lookup fails.
          }
        }
      }

      const locationLookups: Array<{
        value: string;
        nameField: "departure.name" | "arrival.name";
        codeField: "departure.code" | "arrival.code";
        timezoneField: "departure.timezone" | "arrival.timezone";
        nameLabel: string;
        codeLabel: string;
        timezoneLabel: string;
        currentName: string;
        currentCode?: string;
        currentTimezone: string;
      }> = [
        {
          value: parsed.draft.departure.code || parsed.draft.departure.name,
          nameField: "departure.name",
          codeField: "departure.code",
          timezoneField: "departure.timezone",
          nameLabel: "Departure",
          codeLabel: "Departure code",
          timezoneLabel: "Departure timezone",
          currentName: parsed.draft.departure.name,
          currentCode: parsed.draft.departure.code,
          currentTimezone: parsed.draft.departure.timezone,
        },
        {
          value: parsed.draft.arrival.code || parsed.draft.arrival.name,
          nameField: "arrival.name",
          codeField: "arrival.code",
          timezoneField: "arrival.timezone",
          nameLabel: "Arrival",
          codeLabel: "Arrival code",
          timezoneLabel: "Arrival timezone",
          currentName: parsed.draft.arrival.name,
          currentCode: parsed.draft.arrival.code,
          currentTimezone: parsed.draft.arrival.timezone,
        },
      ];

      for (const lookup of locationLookups) {
        if (!lookup.value.trim()) {
          continue;
        }

        try {
          const candidates = await searchLocations(lookup.value);
          if (!candidates.length) {
            continue;
          }

          const candidateNames = candidates
            .map((candidate) => candidate.nameZh || candidate.nameEn || candidate.code || "")
            .filter(Boolean);
          const candidateCodes = candidates.map((candidate) => candidate.code || "").filter(Boolean);
          const candidateTimezones = candidates.map((candidate) => candidate.timezone || "").filter(Boolean);

          if (candidateNames.length && (!lookup.currentName || !candidateNames.includes(lookup.currentName))) {
            nextReviews = upsertReview(nextReviews, {
              field: lookup.nameField,
              label: lookup.nameLabel,
              severity: "suggestion",
              message: "Local location data found a stronger place label candidate.",
              suggestedValue: candidateNames[0],
              suggestedValues: candidateNames,
            });
          }

          if (candidateCodes.length && (!lookup.currentCode || !candidateCodes.includes(lookup.currentCode))) {
            nextReviews = upsertReview(nextReviews, {
              field: lookup.codeField,
              label: lookup.codeLabel,
              severity: "suggestion",
              message: "A more standard code is available for this endpoint.",
              suggestedValue: candidateCodes[0],
              suggestedValues: candidateCodes,
            });
          }

          if (
            candidateTimezones.length &&
            (!lookup.currentTimezone || !candidateTimezones.includes(lookup.currentTimezone))
          ) {
            nextReviews = upsertReview(nextReviews, {
              field: lookup.timezoneField,
              label: lookup.timezoneLabel,
              severity: "suggestion",
              message: "Local location data found a better timezone match.",
              suggestedValue: candidateTimezones[0],
              suggestedValues: candidateTimezones,
            });
          }
        } catch {
          // Keep parser-only fallback when directory lookup fails.
        }
      }

      if (isMounted) {
        setDirectoryReviews(nextReviews);
      }
    };

    void loadDirectoryReviews();

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
        ? "Applied train ticket details to the manual form."
        : "Applied flight ticket details to the manual form.",
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
    setOcrStatus("Initializing OCR...");
    setOcrProgress(0);
    setOcrConfidence(0);

    try {
      const result = await recognizeTicketImage(file, (progress) => {
        setOcrStatus(progress.status);
        setOcrProgress(progress.progress);
      });

      setRawText(result.text);
      setOcrConfidence(result.confidence);
      setOcrStatus("OCR finished. Review the extracted text before applying it.");
      setOcrProgress(1);
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "Image OCR failed.");
    } finally {
      setIsRecognizing(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Import into ticket form</h3>
          <p className="hero-copy">
            {sourceMode === "ocr"
              ? "Scan a ticket image, then review the parsed draft before applying it to the manual form."
              : "Paste copied booking text, OCR output, SMS, or email details, then review before applying."}
          </p>
        </div>
        <span className="status-pill">
          {parsed ? `${parsed.matchedFields.length} fields matched` : sourceMode === "ocr" ? "Image OCR" : "Text import"}
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

        <div className="import-source-tabs" role="tablist" aria-label="Import mode">
          <button
            className={sourceMode === "ocr" ? "theme-chip active" : "theme-chip"}
            onClick={() => setSourceMode("ocr")}
            role="tab"
            type="button"
          >
            Image OCR
          </button>
          <button
            className={sourceMode === "text" ? "theme-chip active" : "theme-chip"}
            onClick={() => setSourceMode("text")}
            role="tab"
            type="button"
          >
            Text import
          </button>
        </div>

        {sourceMode === "ocr" ? (
          <div className="import-intro-card">
            <strong>Step 1. Run OCR on a ticket image</strong>
            <p className="hero-copy">
              Use a screenshot, booking image, or scanned ticket. After OCR finishes, you can still edit the extracted text.
            </p>
            <div className="import-actions">
              <button
                className="primary-button"
                disabled={isRecognizing}
                onClick={handleChooseImage}
                type="button"
              >
                {isRecognizing ? "Recognizing image..." : "Choose image for OCR"}
              </button>
              <span className="detail-loading">PNG, JPG, WEBP, and BMP are supported.</span>
            </div>
          </div>
        ) : (
          <div className="import-intro-card">
            <strong>Step 1. Paste copied ticket text</strong>
            <p className="hero-copy">
              Paste booking text from email, SMS, train apps, airline pages, or your own OCR result.
            </p>
          </div>
        )}

        {ocrStatus ? (
          <div className="ocr-status-card">
            <div className="ocr-status-main">
              <strong>{ocrStatus}</strong>
              <small>{`Progress ${toPercent(ocrProgress)}`}</small>
            </div>
            <span className="ticket-status ticket-status-confidence">
              {`OCR confidence ${toConfidenceLabel(ocrConfidence)} ${toPercent(ocrConfidence)}`}
            </span>
          </div>
        ) : null}

        <label>
          {sourceMode === "ocr" ? "Step 2. Review OCR text" : "Step 2. Review imported text"}
          <textarea
            className="import-textarea"
            onChange={(event) => setRawText(event.target.value)}
            placeholder={
              sourceMode === "ocr"
                ? "OCR output will appear here. You can also paste or correct the text manually."
                : "Paste copied booking text, SMS content, OCR output, or reimbursement text here..."
            }
            value={rawText}
          />
        </label>

        {parsed ? (
          <div className="import-preview">
            <div className="import-summary">
              <div className="import-summary-top">
                <span className="ticket-status ticket-status-saved">{parsed.detectedType}</span>
                <span className="ticket-status ticket-status-confidence">
                  {`Parser confidence ${toConfidenceLabel(parsed.confidence)} ${toPercent(parsed.confidence)}`}
                </span>
              </div>
              <span className="import-step-label">Step 3. Review parsed draft</span>
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
                {showNormalized ? "Hide normalized text" : "Show normalized text"}
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
                        {review.severity === "warning" ? "Needs review" : "Suggested"}
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
                Apply to manual form
              </button>
              <button className="ghost-button" onClick={() => setRawText("")} type="button">
                Clear text
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>Ready to import into the add-ticket form</strong>
            <p>
              {sourceMode === "ocr"
                ? "Run OCR on a ticket image, then review the extracted text and parsed fields."
                : "Paste copied ticket details to generate a draft for the manual form."}
            </p>
          </div>
        )}

        {lastApplied ? <p className="detail-loading">{lastApplied}</p> : null}
      </div>
    </section>
  );
}
