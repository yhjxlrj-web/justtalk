"use client";

import heic2any from "heic2any";
import {
  getImageFileExtension,
  isHeicLikeFile,
  withNormalizedImageExtension
} from "@/lib/images/image-file-support";

type NormalizeSelectedImageOptions = {
  jpegQuality?: number;
  logScope?: "chat" | "profile" | "general";
};

const DEFAULT_HEIC_JPEG_QUALITY = 0.85;

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function logImageNormalization(
  phase: string,
  payload: Record<string, unknown>,
  options?: NormalizeSelectedImageOptions
) {
  if (!isDevelopment()) {
    return;
  }

  const scope = options?.logScope ?? "general";
  console.log(`[image-normalize:${scope}] ${phase}`, payload);
}

function toSingleBlob(result: Blob | Blob[]) {
  if (Array.isArray(result)) {
    return result[0] ?? null;
  }

  return result;
}

export async function normalizeSelectedImage(
  file: File,
  options: NormalizeSelectedImageOptions = {}
): Promise<File> {
  const extension = getImageFileExtension(file.name);
  const heicLike = isHeicLikeFile(file);

  logImageNormalization(
    "selected-file",
    {
      extension,
      isHeicLikeFile: heicLike,
      name: file.name,
      size: file.size,
      type: file.type || "(empty)"
    },
    options
  );

  if (!heicLike) {
    return file;
  }

  const quality = options.jpegQuality ?? DEFAULT_HEIC_JPEG_QUALITY;

  logImageNormalization(
    "normalize-start",
    {
      extension,
      name: file.name,
      quality,
      size: file.size,
      type: file.type || "(empty)"
    },
    options
  );

  try {
    const conversionResult = await heic2any({
      blob: file,
      quality,
      toType: "image/jpeg"
    });
    const convertedBlob = toSingleBlob(conversionResult as Blob | Blob[]);

    if (!(convertedBlob instanceof Blob)) {
      throw new Error("HEIC conversion returned no blob.");
    }

    const normalizedFileName = withNormalizedImageExtension(file.name || "image.heic", "jpg");
    const normalizedFile = new File([convertedBlob], normalizedFileName, {
      lastModified: Date.now(),
      type: "image/jpeg"
    });

    logImageNormalization(
      "normalize-success",
      {
        name: normalizedFile.name,
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type || "(empty)",
        size: normalizedFile.size,
        type: normalizedFile.type
      },
      options
    );

    return normalizedFile;
  } catch (error) {
    logImageNormalization(
      "normalize-failed",
      {
        error,
        name: file.name,
        size: file.size,
        type: file.type || "(empty)"
      },
      options
    );

    throw new Error("HEIC_IMAGE_CONVERSION_FAILED");
  }
}
