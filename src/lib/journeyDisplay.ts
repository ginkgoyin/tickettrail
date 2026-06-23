const JOURNEY_DISPLAY_SEPARATOR = ` ${String.fromCodePoint(0x00b7)} `;

export function normalizeJourneyDisplayText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\s*(?:\uFFFD)+\s*/g, JOURNEY_DISPLAY_SEPARATOR)
    .replace(/\s*[\u00B7\u2022]+\s*/g, JOURNEY_DISPLAY_SEPARATOR)
    .replace(/\s+/g, " ")
    .trim();
}

export function joinJourneyDisplayLabels(labels: string[], limit?: number) {
  const normalizedLabels = labels.map((label) => normalizeJourneyDisplayText(label)).filter(Boolean);
  if (normalizedLabels.length === 0) {
    return "";
  }

  if (!limit || normalizedLabels.length <= limit) {
    return normalizedLabels.join(JOURNEY_DISPLAY_SEPARATOR);
  }

  return normalizedLabels.slice(0, limit).join(JOURNEY_DISPLAY_SEPARATOR) + JOURNEY_DISPLAY_SEPARATOR + "...";
}
