import { createWorker } from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

function normalizeOcrText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to decode the image for OCR."));
      nextImage.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function preprocessImage(file: File) {
  const image = await loadImage(file);
  const scale = image.width < 1600 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable for OCR preprocessing.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    const grayscale = red * 0.299 + green * 0.587 + blue * 0.114;
    const boosted = grayscale > 178 ? 255 : grayscale < 92 ? 0 : Math.min(255, Math.max(0, (grayscale - 92) * 1.9));

    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
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
    const processedCanvas = await preprocessImage(file);
    const result = await worker.recognize(processedCanvas);
    return {
      text: normalizeOcrText(result.data.text),
      confidence: Math.max(0, Math.min(1, (result.data.confidence || 0) / 100)),
    };
  } finally {
    await worker.terminate();
  }
}
