"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { hasUserBlocked } from "@/lib/friends/relationship";
import type { CommunityHeartActionState } from "@/lib/community/action-state";

export async function sendCommunityHeartAction(
  _prevState: CommunityHeartActionState,
  formData: FormData
): Promise<CommunityHeartActionState> {
  const receiverUserId = String(formData.get("receiverUserId") ?? "").trim();

  console.log("community heart action click", {
    receiverUserId
  });

  if (!receiverUserId) {
    return {
      error: "Missing profile information for this heart."
    };
  }

  const authClient = await createSupabaseActionClient();
  const authResponse = await authClient.auth.getUser();
  const user = authResponse.data?.user ?? null;

  console.log("community heart action start", {
    receiverUserId,
    senderUserId: user?.id ?? null
  });

  if (!user) {
    return {
      error: "You need to sign in again before sending a heart."
    };
  }

  if (user.id === receiverUserId) {
    return {
      error: "You can't send a heart to yourself."
    };
  }

  try {
    const senderBlockedReceiver = await hasUserBlocked(user.id, receiverUserId);
    const receiverBlockedSender = await hasUserBlocked(receiverUserId, user.id);

    console.log("community heart block check", {
      senderUserId: user.id,
      receiverUserId,
      senderBlockedReceiver,
      receiverBlockedSender
    });

    if (senderBlockedReceiver || receiverBlockedSender) {
      return {
        error: "This profile is no longer available."
      };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "This profile is no longer available."
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: existingNotification, error: existingNotificationError } = (await admin
    .from("community_notifications")
    .select("id, receiver_user_id")
    .eq("sender_user_id", user.id)
    .eq("receiver_user_id", receiverUserId)
    .eq("type", "heart")
    .maybeSingle()) as {
    data: { id: string; receiver_user_id: string } | null;
    error: { message?: string } | null;
  };

  console.log("community heart existing state", {
    senderUserId: user.id,
    receiverUserId,
    existingNotificationId: existingNotification?.id ?? null,
    existingNotificationError
  });

  if (existingNotificationError) {
    return {
      error: existingNotificationError.message ?? "We couldn't send this heart right now."
    };
  }

  if (existingNotification) {
    return {
      alreadySent: true,
      notificationId: existingNotification.id,
      receiverUserId,
      success: true
    };
  }

  const { data: senderProfile, error: senderProfileError } = (await admin
    .from("profiles")
    .select(
      "id, display_name, avatar_url"
    )
    .eq("id", user.id)
    .maybeSingle()) as {
    data: { id: string; display_name?: string | null; avatar_url?: string | null } | null;
    error: { message?: string } | null;
  };

  if (senderProfileError) {
    return {
      error: senderProfileError.message ?? "We couldn't send this heart right now."
    };
  }

  const insertPayload = {
    sender_user_id: user.id,
    receiver_user_id: receiverUserId,
    sender_display_name: senderProfile?.display_name ?? user.email ?? "JustTalk user",
    sender_avatar_url: senderProfile?.avatar_url ?? null,
    type: "heart" as const,
    created_at: new Date().toISOString()
  };

  console.log("community heart insert payload", insertPayload);

  const { data: insertedNotification, error: insertError } = (await admin
    .from("community_notifications")
    .insert(insertPayload)
    .select("id, receiver_user_id")
    .single()) as {
      data: { id: string; receiver_user_id: string } | null;
      error: { message?: string } | null;
    };

  console.log("community heart write result", {
    senderUserId: user.id,
    receiverUserId,
    insertedNotificationId: insertedNotification?.id ?? null,
    insertError
  });

  if (insertError || !insertedNotification) {
    return {
      error: insertError?.message ?? "We couldn't send this heart right now."
    };
  }

  return {
    alreadySent: false,
    notificationId: insertedNotification.id,
    receiverUserId: insertedNotification.receiver_user_id,
    success: true
  };
}
