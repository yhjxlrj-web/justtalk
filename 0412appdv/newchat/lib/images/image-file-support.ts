const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence"
]);

const GENERIC_BINARY_MIME_TYPES = new Set(["", "application/octet-stream"]);

const UPLOADABLE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([...UPLOADABLE_IMAGE_EXTENSIONS, ...HEIC_EXTENSIONS]);

const MIME_TO_EXTENSION: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const EXTENSION_TO_MIME: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

type FileLike = {
  name?: string | null;
  type?: string | null;
};

function normalizeMimeType(type: string | null | undefined) {
  return (type ?? "").trim().toLowerCase();
}

function normalizeFileName(name: string | null | undefined) {
  return (name ?? "").trim();
}

export function getImageFileExtension(fileName: string | null | undefined) {
  const normalized = normalizeFileName(fileName);

  if (!normalized) {
    return null;
  }

  const queryIndex = normalized.indexOf("?");
  const cleanName = queryIndex >= 0 ? normalized.slice(0, queryIndex) : normalized;
  const lastDotIndex = cleanName.lastIndexOf(".");

  if (lastDotIndex < 0 || lastDotIndex === cleanName.length - 1) {
    return null;
  }

  return cleanName.slice(lastDotIndex + 1).toLowerCase();
}

function isGenericBinaryMime(type: string) {
  return GENERIC_BINARY_MIME_TYPES.has(type);
}

export function isHeicLikeFile(fileLike: FileLike) {
  const mimeType = normalizeMimeType(fileLike.type);
  const extension = getImageFileExtension(fileLike.name);

  if (extension && HEIC_EXTENSIONS.has(extension)) {
    return true;
  }

  if (HEIC_MIME_TYPES.has(mimeType)) {
    return true;
  }

  if (isGenericBinaryMime(mimeType) && extension && HEIC_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}

export function isSupportedImageInput(fileLike: FileLike) {
  const mimeType = normalizeMimeType(fileLike.type);
  const extension = getImageFileExtension(fileLike.name);

  if (isHeicLikeFile(fileLike)) {
    return true;
  }

  if (mimeType in MIME_TO_EXTENSION) {
    return true;
  }

  if (extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (mimeType.startsWith("image/") && extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (isGenericBinaryMime(mimeType) && extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}

export function isUploadableImageFile(fileLike: FileLike) {
  if (isHeicLikeFile(fileLike)) {
    return false;
  }

  const mimeType = normalizeMimeType(fileLike.type);
  const extension = getImageFileExtension(fileLike.name);

  if (mimeType in MIME_TO_EXTENSION) {
    return true;
  }

  if (extension && UPLOADABLE_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (isGenericBinaryMime(mimeType) && extension && UPLOADABLE_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}

export function resolveUploadImageExtension(fileLike: FileLike): "jpg" | "png" | "webp" | null {
  const mimeType = normalizeMimeType(fileLike.type);
  const extension = getImageFileExtension(fileLike.name);

  if (mimeType in MIME_TO_EXTENSION) {
    return MIME_TO_EXTENSION[mimeType];
  }

  if (extension && extension in EXTENSION_TO_MIME) {
    if (extension === "jpeg") {
      return "jpg";
    }

    return extension as "jpg" | "png" | "webp";
  }

  return null;
}

export function resolveUploadImageMimeType(
  fileLike: FileLike
): "image/jpeg" | "image/png" | "image/webp" | null {
  const mimeType = normalizeMimeType(fileLike.type);

  if (mimeType in MIME_TO_EXTENSION) {
    const extension = MIME_TO_EXTENSION[mimeType];
    return EXTENSION_TO_MIME[extension];
  }

  const extension = getImageFileExtension(fileLike.name);

  if (extension && extension in EXTENSION_TO_MIME) {
    return EXTENSION_TO_MIME[extension];
  }

  return null;
}

export function withNormalizedImageExtension(fileName: string, extension: string) {
  const trimmedName = normalizeFileName(fileName);
  const baseName = trimmedName.replace(/\.[^.]+$/, "").trim() || "image";
  return `${baseName}.${extension}`;
}
