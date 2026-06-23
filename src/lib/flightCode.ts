export function normalizeFlightNumberInput(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

export function isNumericOnlyFlightNumber(code: string): boolean {
  return /^\d+$/.test(code.trim());
}

export function extractFlightCodePrefix(code: string): string | null {
  const normalized = normalizeFlightNumberInput(code);
  const match = normalized.match(/^([A-Z0-9]{2,3}?)(\d+[A-Z]?)$/);
  if (!match) {
    return null;
  }

  const prefix = match[1] ?? "";
  return /[A-Z]/.test(prefix) ? prefix : null;
}

export function isLikelyFullFlightNumber(code: string): boolean {
  return extractFlightCodePrefix(code) !== null;
}
