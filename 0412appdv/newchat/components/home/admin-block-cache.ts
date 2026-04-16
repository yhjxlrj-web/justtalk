import type { DeveloperBlockEntry } from "@/types/admin";

type DeveloperBlockCacheEntry = {
  entries: DeveloperBlockEntry[];
  fetchedAt: number;
};

const developerBlockCache = new Map<string, DeveloperBlockCacheEntry>();

function getStorageKey(userId: string) {
  return `talkbridge:developer-blocks:${userId}`;
}

export function getCachedDeveloperBlocks(userId: string) {
  const cachedEntry = developerBlockCache.get(userId);

  if (cachedEntry) {
    return cachedEntry;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(userId));

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as DeveloperBlockCacheEntry;

    if (!parsed || !Array.isArray(parsed.entries) || typeof parsed.fetchedAt !== "number") {
      return null;
    }

    developerBlockCache.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedDeveloperBlocks(userId: string, entry: DeveloperBlockCacheEntry) {
  developerBlockCache.set(userId, entry);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}
