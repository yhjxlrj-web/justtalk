"use client";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.78;
const WEBP_QUALITY = 0.76;

export type CompressedChatImageResult = {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load image for compression."));
    };

    image.src = objectUrl;
  });
}

function detectTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const sampleWidth = Math.min(width, 64);
  const sampleHeight = Math.min(height, 64);
  const offsetX = Math.max(0, Math.floor((width - sampleWidth) / 2));
  const offsetY = Math.max(0, Math.floor((height - sampleHeight) / 2));
  const imageData = context.getImageData(offsetX, offsetY, sampleWidth, sampleHeight).data;

  for (let index = 3; index < imageData.length; index += 4) {
    if (imageData[index] < 250) {
      return true;
    }
  }

  return false;
}

function fileNameWithExtension(name: string, extension: string) {
  const trimmedName = name.replace(/\.[^.]+$/, "").trim() || "image";
  return `${trimmedName}.${extension}`;
}

export async function compressImageForChat(file: File): Promise<CompressedChatImageResult> {
  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(originalWidth, originalHeight));
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const targetHeight = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas is not available for image compression.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const hasTransparency =
    file.type === "image/png" ? detectTransparency(context, targetWidth, targetHeight) : false;
  const targetMimeType = hasTransparency
    ? "image/png"
    : file.type === "image/webp"
      ? "image/webp"
      : "image/jpeg";
  const quality = targetMimeType === "image/webp" ? WEBP_QUALITY : JPEG_QUALITY;

  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, targetMimeType, quality);
  });

  if (!compressedBlob) {
    throw new Error("Unable to create compressed image blob.");
  }

  const extension =
    targetMimeType === "image/png" ? "png" : targetMimeType === "image/webp" ? "webp" : "jpg";
  const compressedFile = new File([compressedBlob], fileNameWithExtension(file.name, extension), {
    type: targetMimeType,
    lastModified: Date.now()
  });

  return {
    compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    width: targetWidth,
    height: targetHeight,
    mimeType: targetMimeType
  };
}
