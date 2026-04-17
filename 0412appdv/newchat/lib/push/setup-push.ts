import { PushNotifications } from "@capacitor/push-notifications";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SetupPushOptions = {
  userId: string;
  onRoomPushAction?: (roomId: string) => void;
  onRoomPushReceived?: (roomId: string) => void;
};

let listenersAttached = false;
let pushRegistered = false;
let activePushOptions: SetupPushOptions | null = null;
let pushSupabaseClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function normalizePushRoomIdCandidate(value: unknown) {
  if (typeof value === "string") {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function extractRoomIdFromPushPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const payloadRecord = payload as Record<string, unknown>;
  const data = payloadRecord.data;

  if (!data || typeof data !== "object") {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  return (
    normalizePushRoomIdCandidate(dataRecord.roomId) ??
    normalizePushRoomIdCandidate(dataRecord.room_id) ??
    normalizePushRoomIdCandidate(dataRecord.chatId) ??
    normalizePushRoomIdCandidate(dataRecord.chat_id) ??
    normalizePushRoomIdCandidate(dataRecord.conversationId) ??
    normalizePushRoomIdCandidate(dataRecord.conversation_id)
  );
}

export async function setupPush(options: SetupPushOptions) {
  activePushOptions = options;

  if (!pushSupabaseClient) {
    pushSupabaseClient = createSupabaseBrowserClient();
  }

  const supabase = pushSupabaseClient;
  const permStatus = await PushNotifications.requestPermissions();

  if (permStatus.receive !== "granted") {
    console.log("[push] permission not granted");
    return;
  }

  await PushNotifications.createChannel({
    id: "justtalk-default",
    name: "JustTalk Notifications",
    description: "Messages, hearts, and friend requests",
    importance: 5,
    visibility: 1,
    sound: "default",
    vibration: true
  });

  if (!listenersAttached) {
    PushNotifications.addListener("registration", async (token) => {
      const currentUserId = activePushOptions?.userId;

      if (!currentUserId) {
        return;
      }

      console.log("[push] registration token:", token.value);

      const { error } = await supabase.from("device_push_tokens").upsert(
        {
          user_id: currentUserId,
          fcm_token: token.value,
          platform: "android",
          is_active: true,
          last_seen_at: new Date().toISOString()
        },
        {
          onConflict: "fcm_token"
        }
      );

      if (error) {
        console.error("[push] failed to save token:", error);
      } else {
        console.log("[push] token saved");
      }
    });

    PushNotifications.addListener("registrationError", (error) => {
      console.error("[push] registration error:", error);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[push] notification received:", notification);
      const roomId = extractRoomIdFromPushPayload(notification);

      if (!roomId) {
        return;
      }

      console.log("[push] room prewarm candidate from foreground notification", {
        roomId
      });
      activePushOptions?.onRoomPushReceived?.(roomId);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[push] notification action:", action);
      const roomId =
        extractRoomIdFromPushPayload(action?.notification) ??
        extractRoomIdFromPushPayload(action);

      if (!roomId) {
        return;
      }

      console.log("[push] room route candidate from notification action", {
        roomId
      });
      activePushOptions?.onRoomPushAction?.(roomId);
    });

    listenersAttached = true;
  }

  if (pushRegistered) {
    return;
  }

  await PushNotifications.register();
  pushRegistered = true;
}
