"use client";

import { isHeicLikeFile } from "@/lib/images/image-file-support";

type CompressionOptions = {
  jpegQuality?: number;
  maxDimension?: number;
  minBypassBytes?: number;
  webpQuality?: number;
};

export type CompressedImageResult = {
  compressedFile: File;
  compressedSize: number;
  height: number;
  mimeType: string;
  originalSize: number;
  wasCompressed: boolean;
  width: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.8;
const DEFAULT_WEBP_QUALITY = 0.8;
const DEFAULT_MIN_BYPASS_BYTES = 280 * 1024;

function fileNameWithExtension(name: string, extension: string) {
  const trimmedName = name.replace(/\.[^.]+$/, "").trim() || "image";
  return `${trimmedName}.${extension}`;
}

async function loadImageBitmapFromFile(file: File) {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image"
      });
    } catch (error) {
      console.warn("createImageBitmap decode failed, fallback to Image element", error);
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode selected image."));
    };

    image.src = objectUrl;
  });
}

function getDecodedSize(decodedImage: ImageBitmap | HTMLImageElement) {
  if ("naturalWidth" in decodedImage) {
    return {
      height: decodedImage.naturalHeight || decodedImage.height,
      width: decodedImage.naturalWidth || decodedImage.width
    };
  }

  return {
    height: decodedImage.height,
    width: decodedImage.width
  };
}

function detectTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const sampleWidth = Math.min(width, 72);
  const sampleHeight = Math.min(height, 72);
  const offsetX = Math.max(0, Math.floor((width - sampleWidth) / 2));
  const offsetY = Math.max(0, Math.floor((height - sampleHeight) / 2));
  const pixels = context.getImageData(offsetX, offsetY, sampleWidth, sampleHeight).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250) {
      return true;
    }
  }

  return false;
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  if (isHeicLikeFile(file)) {
    throw new Error("HEIC/HEIF images must be converted before compression.");
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const webpQuality = options.webpQuality ?? DEFAULT_WEBP_QUALITY;
  const minBypassBytes = options.minBypassBytes ?? DEFAULT_MIN_BYPASS_BYTES;
  const decodedImage = await loadImageBitmapFromFile(file);
  const originalSize = file.size;
  const { width: originalWidth, height: originalHeight } = getDecodedSize(decodedImage);

  const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const targetHeight = Math.max(1, Math.round(originalHeight * scale));
  const resizeNeeded = targetWidth !== originalWidth || targetHeight !== originalHeight;

  if (!resizeNeeded && originalSize <= minBypassBytes) {
    return {
      compressedFile: file,
      compressedSize: file.size,
      height: originalHeight,
      mimeType: file.type || "image/jpeg",
      originalSize,
      wasCompressed: false,
      width: originalWidth
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas context is not available.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decodedImage, 0, 0, targetWidth, targetHeight);

  if ("close" in decodedImage && typeof decodedImage.close === "function") {
    decodedImage.close();
  }

  const hasTransparency =
    file.type === "image/png" ? detectTransparency(context, targetWidth, targetHeight) : false;
  const targetMimeType = hasTransparency
    ? "image/png"
    : file.type === "image/webp"
      ? "image/webp"
      : "image/jpeg";
  const quality = targetMimeType === "image/webp" ? webpQuality : jpegQuality;

  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, targetMimeType, quality);
  });

  if (!compressedBlob) {
    throw new Error("Unable to create compressed image.");
  }

  const extension =
    targetMimeType === "image/png" ? "png" : targetMimeType === "image/webp" ? "webp" : "jpg";
  const compressedFile = new File([compressedBlob], fileNameWithExtension(file.name, extension), {
    lastModified: Date.now(),
    type: targetMimeType
  });

  if (!resizeNeeded && compressedFile.size >= originalSize) {
    return {
      compressedFile: file,
      compressedSize: file.size,
      height: originalHeight,
      mimeType: file.type || targetMimeType,
      originalSize,
      wasCompressed: false,
      width: originalWidth
    };
  }

  return {
    compressedFile,
    compressedSize: compressedFile.size,
    height: targetHeight,
    mimeType: targetMimeType,
    originalSize,
    wasCompressed: true,
    width: targetWidth
  };
}
