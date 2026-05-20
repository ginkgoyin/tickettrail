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
  onApplyImport: (result: ImportParseResult) => void;
}

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toConfidenceLabel(value: number) {
  if (value >= 0.8) return "高";
  if (value >= 0.55) return "中";
  return "低";
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

export function SmartImport({ onApplyImport }: SmartImportProps) {
  const [rawText, setRawText] = useState("");
  const [lastApplied, setLastApplied] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);
  const [directoryReviews, setDirectoryReviews] = useState<ImportFieldReview[]>([]);
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
                label: "承运方",
                severity: "suggestion",
                message: "本地航空公司主数据提供了更可靠的候选，可直接选择。",
                suggestedValue: candidateNames[0],
                suggestedValues: candidateNames,
              });
            }
          } catch {
            // Ignore directory lookup errors and keep parser-only fallback.
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
          nameLabel: "出发地",
          codeLabel: "出发代码",
          timezoneLabel: "出发时区",
          currentName: parsed.draft.departure.name,
          currentCode: parsed.draft.departure.code,
          currentTimezone: parsed.draft.departure.timezone,
        },
        {
          value: parsed.draft.arrival.code || parsed.draft.arrival.name,
          nameField: "arrival.name",
          codeField: "arrival.code",
          timezoneField: "arrival.timezone",
          nameLabel: "到达地",
          codeLabel: "到达代码",
          timezoneLabel: "到达时区",
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
              message: "本地点主数据提供了更可靠的地点候选。",
              suggestedValue: candidateNames[0],
              suggestedValues: candidateNames,
            });
          }

          if (candidateCodes.length && (!lookup.currentCode || !candidateCodes.includes(lookup.currentCode))) {
            nextReviews = upsertReview(nextReviews, {
              field: lookup.codeField,
              label: lookup.codeLabel,
              severity: "suggestion",
              message: "可以补充更标准的地点代码。",
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
              message: "本地点主数据提供了更匹配的时区候选。",
              suggestedValue: candidateTimezones[0],
              suggestedValues: candidateTimezones,
            });
          }
        } catch {
          // Ignore directory lookup errors and keep parser-only fallback.
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
        ? "已将火车票信息填入表单。"
        : "已将机票信息填入表单。",
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
    setOcrStatus("正在初始化 OCR...");
    setOcrProgress(0);
    setOcrConfidence(0);

    try {
      const result = await recognizeTicketImage(file, (progress) => {
        setOcrStatus(progress.status);
        setOcrProgress(progress.progress);
      });

      setRawText(result.text);
      setOcrConfidence(result.confidence);
      setOcrStatus("识别完成，可以直接套用到表单。");
      setOcrProgress(1);
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "图片 OCR 识别失败。");
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
            {isRecognizing ? "正在识别图片..." : "从票据截图识别"}
          </button>
          <span className="detail-loading">也可以直接粘贴 OCR 结果或复制文本</span>
        </div>

        {ocrStatus ? (
          <div className="ocr-status-card">
            <div className="ocr-status-main">
              <strong>{ocrStatus}</strong>
              <small>{`进度 ${toPercent(ocrProgress)}`}</small>
            </div>
            <span className="ticket-status ticket-status-confidence">
              {`识字置信度 ${toConfidenceLabel(ocrConfidence)} ${toPercent(ocrConfidence)}`}
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
                  {`置信度 ${toConfidenceLabel(parsed.confidence)} ${toPercent(parsed.confidence)}`}
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
                {showNormalized ? "隐藏纠错文本" : "查看纠错后文本"}
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
                        {review.severity === "warning" ? "需要检查" : "可直接套用"}
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
