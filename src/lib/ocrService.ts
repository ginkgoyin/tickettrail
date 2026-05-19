import { createWorker } from "tesseract.js";

export interface OcrResult {
  text: string;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

function normalizeOcrText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

export async function recognizeTicketImage(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  const worker = await createWorker(["chi_sim", "eng"], 1, {
    logger: (message) => {
      onProgress?.({
        status: message.status,
        progress: typeof message.progress === "number" ? message.progress : 0,
      });
    },
  });

  try {
    const result = await worker.recognize(file);
    return {
      text: normalizeOcrText(result.data.text),
    };
  } finally {
    await worker.terminate();
  }
}
