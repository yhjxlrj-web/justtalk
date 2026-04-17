"use client";

import { compressImageFile } from "@/lib/images/compress-image";

export type CompressedChatImageResult = {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
};

export async function compressImageForChat(file: File): Promise<CompressedChatImageResult> {
  const result = await compressImageFile(file, {
    jpegQuality: 0.8,
    maxDimension: 1600,
    minBypassBytes: 300 * 1024,
    webpQuality: 0.78
  });

  return {
    compressedFile: result.compressedFile,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    width: result.width,
    height: result.height,
    mimeType: result.mimeType
  };
}
