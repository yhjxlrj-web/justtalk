"use client";

import type { CommunityProfileCacheEntry } from "@/types/community";

const COMMUNITY_CACHE_KEY_PREFIX = "justtalk:community-profiles";

const communityCacheByUserId = new Map<string, CommunityProfileCacheEntry>();

function getCommunityCacheStorageKey(userId: string) {
  return `${COMMUNITY_CACHE_KEY_PREFIX}:${userId}`;
}

export function getCommunityRefreshDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isCommunityCacheFresh(entry: CommunityProfileCacheEntry | null | undefined) {
  if (!entry) {
    return false;
  }

  return entry.refreshDate === getCommunityRefreshDateKey();
}

export function getCachedCommunityProfiles(userId: string) {
  if (!userId) {
    return null;
  }

  const cachedEntry = communityCacheByUserId.get(userId);

  if (cachedEntry) {
    return cachedEntry;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getCommunityCacheStorageKey(userId));

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as CommunityProfileCacheEntry;
    communityCacheByUserId.set(userId, parsedValue);
    return parsedValue;
  } catch (error) {
    console.error("Failed to read community cache", {
      userId,
      error
    });
    return null;
  }
}

export function setCachedCommunityProfiles(userId: string, entry: CommunityProfileCacheEntry) {
  if (!userId) {
    return;
  }

  communityCacheByUserId.set(userId, entry);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getCommunityCacheStorageKey(userId), JSON.stringify(entry));
  } catch (error) {
    console.error("Failed to write community cache", {
      userId,
      error
    });
  }
}
