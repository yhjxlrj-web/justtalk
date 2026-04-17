"use client";

import type { CommunityNotificationItem } from "@/types/community";

const COMMUNITY_NOTIFICATION_KEY_PREFIX = "justtalk:community-notifications:v2";
const COMMUNITY_NOTIFICATION_READ_KEY_PREFIX = "justtalk:community-notifications-read:v1";
const COMMUNITY_NOTIFICATION_LIMIT = 20;

const notificationCacheByUserId = new Map<string, CommunityNotificationItem[]>();
const notificationReadAtByUserId = new Map<string, number>();

function getNotificationStorageKey(userId: string) {
  return `${COMMUNITY_NOTIFICATION_KEY_PREFIX}:${userId}`;
}

function getNotificationReadStorageKey(userId: string) {
  return `${COMMUNITY_NOTIFICATION_READ_KEY_PREFIX}:${userId}`;
}

function normalizeNotifications(items: CommunityNotificationItem[]) {
  return [...items]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, COMMUNITY_NOTIFICATION_LIMIT);
}

export function getCachedCommunityNotifications(userId: string) {
  if (!userId) {
    return [];
  }

  const cachedItems = notificationCacheByUserId.get(userId);

  if (cachedItems) {
    return cachedItems;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getNotificationStorageKey(userId));

    if (!rawValue) {
      return [];
    }

    const parsedItems = normalizeNotifications(JSON.parse(rawValue) as CommunityNotificationItem[]);
    notificationCacheByUserId.set(userId, parsedItems);
    return parsedItems;
  } catch (error) {
    console.error("Failed to read community notification cache", {
      userId,
      error
    });
    return [];
  }
}

export function setCachedCommunityNotifications(userId: string, items: CommunityNotificationItem[]) {
  if (!userId) {
    return;
  }

  const normalizedItems = normalizeNotifications(items);
  notificationCacheByUserId.set(userId, normalizedItems);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getNotificationStorageKey(userId),
      JSON.stringify(normalizedItems)
    );
  } catch (error) {
    console.error("Failed to write community notification cache", {
      userId,
      error
    });
  }
}

export function getCachedCommunityNotificationsReadAt(userId: string) {
  if (!userId) {
    return 0;
  }

  const cachedReadAt = notificationReadAtByUserId.get(userId);

  if (cachedReadAt !== undefined) {
    return cachedReadAt;
  }

  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const rawValue = window.localStorage.getItem(getNotificationReadStorageKey(userId));

    if (!rawValue) {
      return 0;
    }

    const parsedReadAt = Number(rawValue);

    if (!Number.isFinite(parsedReadAt) || parsedReadAt < 0) {
      return 0;
    }

    notificationReadAtByUserId.set(userId, parsedReadAt);
    return parsedReadAt;
  } catch (error) {
    console.error("Failed to read community notification read marker", {
      userId,
      error
    });
    return 0;
  }
}

export function setCachedCommunityNotificationsReadAt(userId: string, readAt: number) {
  if (!userId) {
    return;
  }

  const normalizedReadAt =
    Number.isFinite(readAt) && readAt > 0 ? Math.floor(readAt) : 0;
  const cachedReadAt = getCachedCommunityNotificationsReadAt(userId);
  const nextReadAt = Math.max(cachedReadAt, normalizedReadAt);

  notificationReadAtByUserId.set(userId, nextReadAt);

  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getNotificationReadStorageKey(userId);
    const localStorageReadAt = Number(window.localStorage.getItem(storageKey) ?? "0");
    const mergedReadAt =
      Number.isFinite(localStorageReadAt) && localStorageReadAt > 0
        ? Math.max(localStorageReadAt, nextReadAt)
        : nextReadAt;

    window.localStorage.setItem(storageKey, String(mergedReadAt));
  } catch (error) {
    console.error("Failed to write community notification read marker", {
      userId,
      readAt: nextReadAt,
      error
    });
  }
}

export function upsertCommunityNotification(
  userId: string,
  notification: CommunityNotificationItem
) {
  const currentItems = getCachedCommunityNotifications(userId);
  const nextItems = [
    notification,
    ...currentItems.filter((item) => item.id !== notification.id)
  ];

  setCachedCommunityNotifications(userId, nextItems);
  return normalizeNotifications(nextItems);
}
