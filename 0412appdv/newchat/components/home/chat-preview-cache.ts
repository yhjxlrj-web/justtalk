"use client";

import type { ChatRoomPreview } from "@/types/home";

const CHAT_PREVIEW_CACHE_EVENT = "talkbridge:chat-preview-cache";

let cachedChatPreviews: ChatRoomPreview[] | null = null;

function filterBlockedPreviews(
  previews: ChatRoomPreview[],
  blockedPeerUserIds: Iterable<string>
) {
  const blockedPeerIdSet = new Set(blockedPeerUserIds);

  if (blockedPeerIdSet.size === 0) {
    return {
      filteredPreviews: previews,
      blockedRoomIds: [] as string[]
    };
  }

  const blockedRoomIds = previews
    .filter((preview) => !!preview.peerUserId && blockedPeerIdSet.has(preview.peerUserId))
    .map((preview) => preview.roomId);

  return {
    filteredPreviews: previews.filter(
      (preview) => !(preview.peerUserId && blockedPeerIdSet.has(preview.peerUserId))
    ),
    blockedRoomIds
  };
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isReadAfterLatest(preview: ChatRoomPreview) {
  const viewerLastSeenAt = toTimestamp(preview.viewerLastSeenAt);
  const latestMessageCreatedAt = toTimestamp(preview.latestMessageCreatedAt);

  if (viewerLastSeenAt === 0) {
    return false;
  }

  if (latestMessageCreatedAt === 0) {
    return true;
  }

  return viewerLastSeenAt >= latestMessageCreatedAt;
}

function emitCacheUpdate(previews: ChatRoomPreview[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ChatRoomPreview[]>(CHAT_PREVIEW_CACHE_EVENT, {
      detail: previews
    })
  );
}

export function getCachedChatPreviews() {
  return cachedChatPreviews;
}

export function setCachedChatPreviews(previews: ChatRoomPreview[]) {
  cachedChatPreviews = previews;
  emitCacheUpdate(previews);
}

export function mergeChatPreviews(
  cachedPreviews: ChatRoomPreview[] | null,
  incomingPreviews: ChatRoomPreview[],
  blockedPeerUserIds: Iterable<string> = [],
  options?: {
    pruneMissingIncomingRooms?: boolean;
  }
) {
  const { filteredPreviews: safeIncomingPreviews, blockedRoomIds: blockedIncomingRoomIds } =
    filterBlockedPreviews(incomingPreviews, blockedPeerUserIds);
  const { filteredPreviews: safeCachedPreviews, blockedRoomIds: blockedCachedRoomIds } =
    filterBlockedPreviews(cachedPreviews ?? [], blockedPeerUserIds);

  console.log("mergeChatPreviews block filter", {
    incomingPreviewCount: incomingPreviews.length,
    cachedPreviewCount: cachedPreviews?.length ?? 0,
    blockedFilteredRoomIds: Array.from(new Set([...blockedIncomingRoomIds, ...blockedCachedRoomIds]))
  });

  if (!safeCachedPreviews || safeCachedPreviews.length === 0) {
    return safeIncomingPreviews;
  }

  const previewMap = new Map<string, ChatRoomPreview>();
  const incomingRoomIdSet = new Set(safeIncomingPreviews.map((preview) => preview.roomId));

  for (const preview of safeCachedPreviews) {
    if (options?.pruneMissingIncomingRooms && safeIncomingPreviews.length > 0 && !incomingRoomIdSet.has(preview.roomId)) {
      continue;
    }

    previewMap.set(preview.roomId, preview);
  }

  for (const incomingPreview of safeIncomingPreviews) {
    const cachedPreview = previewMap.get(incomingPreview.roomId);

    if (!cachedPreview) {
      previewMap.set(incomingPreview.roomId, incomingPreview);
      continue;
    }

    const cachedTimestamp = toTimestamp(cachedPreview.latestMessageCreatedAt);
    const incomingTimestamp = toTimestamp(incomingPreview.latestMessageCreatedAt);
    const cachedReadTimestamp = toTimestamp(cachedPreview.viewerLastSeenAt);
    const incomingReadTimestamp = toTimestamp(incomingPreview.viewerLastSeenAt);
    const cachedReadAfterLatest = isReadAfterLatest(cachedPreview);
    const incomingReadAfterLatest = isReadAfterLatest(incomingPreview);

    const incomingHasNewerMessage =
      incomingTimestamp > cachedTimestamp ||
      (!!incomingPreview.lastMessageId &&
        incomingPreview.lastMessageId !== cachedPreview.lastMessageId &&
        incomingTimestamp >= cachedTimestamp);

    const incomingHasNewerReadState = incomingReadTimestamp > cachedReadTimestamp;
    const shouldKeepCachedReadState =
      cachedPreview.unreadCount === 0 &&
      cachedReadAfterLatest &&
      !incomingHasNewerMessage &&
      !incomingHasNewerReadState &&
      !incomingReadAfterLatest;

    if (shouldKeepCachedReadState) {
      continue;
    }

    if (
      incomingHasNewerMessage ||
      incomingHasNewerReadState ||
      ((!cachedReadAfterLatest || incomingReadAfterLatest) &&
        incomingPreview.unreadCount !== cachedPreview.unreadCount)
    ) {
      previewMap.set(incomingPreview.roomId, {
        ...cachedPreview,
        ...incomingPreview
      });
    }
  }

  const mergedPreviews = [...previewMap.values()].sort((left, right) => {
    const leftTimestamp = toTimestamp(left.latestMessageCreatedAt);
    const rightTimestamp = toTimestamp(right.latestMessageCreatedAt);
    return rightTimestamp - leftTimestamp;
  });

  console.log("mergeChatPreviews result", {
    resultCount: mergedPreviews.length,
    resultRoomIds: mergedPreviews.map((preview) => preview.roomId)
  });

  return mergedPreviews;
}

export function filterChatPreviewsByBlockedPeerIds(
  previews: ChatRoomPreview[],
  blockedPeerUserIds: Iterable<string>
) {
  return filterBlockedPreviews(previews, blockedPeerUserIds);
}

export function patchCachedChatPreview(
  roomId: string,
  updater: (preview: ChatRoomPreview) => ChatRoomPreview,
  options?: {
    moveToFront?: boolean;
  }
) {
  if (!cachedChatPreviews) {
    return;
  }

  let patchedPreview: ChatRoomPreview | null = null;
  const untouchedPreviews: ChatRoomPreview[] = [];

  for (const preview of cachedChatPreviews) {
    if (preview.roomId === roomId) {
      patchedPreview = updater(preview);
      continue;
    }

    untouchedPreviews.push(preview);
  }

  if (!patchedPreview) {
    return;
  }

  const nextPreviews = options?.moveToFront
    ? [patchedPreview, ...untouchedPreviews]
    : cachedChatPreviews.map((preview) =>
        preview.roomId === roomId ? patchedPreview : preview
      );

  setCachedChatPreviews(nextPreviews);
}

export function removeCachedChatPreviews(
  predicate: (preview: ChatRoomPreview) => boolean
) {
  if (!cachedChatPreviews) {
    return [] as string[];
  }

  const removedRoomIds = cachedChatPreviews
    .filter(predicate)
    .map((preview) => preview.roomId);

  if (removedRoomIds.length === 0) {
    return removedRoomIds;
  }

  setCachedChatPreviews(cachedChatPreviews.filter((preview) => !predicate(preview)));
  return removedRoomIds;
}

export function removeCachedDirectChatPreviewsByPeerUserId(peerUserId: string) {
  if (!cachedChatPreviews || !peerUserId) {
    return [] as ChatRoomPreview[];
  }

  const removedPreviews = cachedChatPreviews.filter(
    (preview) => Boolean(preview.peerUserId) && preview.peerUserId === peerUserId
  );

  if (removedPreviews.length === 0) {
    return removedPreviews;
  }

  setCachedChatPreviews(
    cachedChatPreviews.filter(
      (preview) => !(Boolean(preview.peerUserId) && preview.peerUserId === peerUserId)
    )
  );

  return removedPreviews;
}

export function subscribeChatPreviewCache(listener: (previews: ChatRoomPreview[]) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCacheUpdate = (event: Event) => {
    listener((event as CustomEvent<ChatRoomPreview[]>).detail);
  };

  window.addEventListener(CHAT_PREVIEW_CACHE_EVENT, handleCacheUpdate);

  return () => {
    window.removeEventListener(CHAT_PREVIEW_CACHE_EVENT, handleCacheUpdate);
  };
}
