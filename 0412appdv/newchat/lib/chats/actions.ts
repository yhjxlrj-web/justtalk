"use server";

import { revalidatePath } from "next/cache";
import type {
  DeleteChatHistoryState,
  LeaveChatRoomState,
  OpenDirectChatState
} from "@/lib/chats/action-state";
import { resetChatRoomSummariesForRoom } from "@/lib/chats/room-summary";
import { findOrCreateDirectChat, getChatRoomSummary } from "@/lib/chats/chats";
import { getFriendshipBetweenUsers } from "@/lib/friends/relationship";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import type { ChatRoomSummary } from "@/types/chat";

async function ensureAcceptedFriendship(currentUserId: string, otherUserId: string) {
  const admin = createSupabaseAdminClient();
  const existingRelationship = await getFriendshipBetweenUsers(currentUserId, otherUserId);

  if (existingRelationship?.status === "accepted") {
    return existingRelationship.id;
  }

  if (existingRelationship) {
    const { error: updateError } = await admin
      .from("friendships")
      .update({
        requester_id: currentUserId,
        addressee_id: otherUserId,
        status: "accepted"
      })
      .eq("id", existingRelationship.id);

    if (updateError) {
      throw new Error(updateError.message ?? "We couldn't connect this friend right now.");
    }

    return existingRelationship.id;
  }

  const { data: insertedFriendship, error: insertError } = (await admin
    .from("friendships")
    .insert({
      requester_id: currentUserId,
      addressee_id: otherUserId,
      status: "accepted"
    })
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message?: string } | null;
  };

  if (insertError || !insertedFriendship) {
    throw new Error(insertError?.message ?? "We couldn't add this friend right now.");
  }

  return insertedFriendship.id;
}

export async function openDirectChatAction(
  _prevState: OpenDirectChatState,
  formData: FormData
): Promise<OpenDirectChatState> {
  const friendId = String(formData.get("friendId") ?? "").trim();

  if (!friendId) {
    return {
      error: "Missing friend information for this chat."
    };
  }

  const authClient = await createSupabaseActionClient();
  const authResponse = await authClient.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "You need to sign in again before opening a chat."
    };
  }

  if (user.id === friendId) {
    return {
      error: "You can't open a direct chat with yourself."
    };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const chatId = await findOrCreateDirectChat(adminClient, user.id, friendId);

    return { chatId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't open this chat right now. Please try again."
    };
  }
}

export async function openCommunityChatAction(
  _prevState: OpenDirectChatState,
  formData: FormData
): Promise<OpenDirectChatState> {
  const otherUserId = String(formData.get("friendId") ?? "").trim();

  if (!otherUserId) {
    return {
      error: "Missing profile information for this conversation."
    };
  }

  const authClient = await createSupabaseActionClient();
  const authResponse = await authClient.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "You need to sign in again before opening a chat."
    };
  }

  if (user.id === otherUserId) {
    return {
      error: "You can't start a chat with yourself."
    };
  }

  try {
    const friendshipId = await ensureAcceptedFriendship(user.id, otherUserId);
    const adminClient = createSupabaseAdminClient();
    const chatId = await findOrCreateDirectChat(adminClient, user.id, otherUserId);

    revalidatePath("/home");

    return {
      chatId,
      friendshipId,
      otherUserId
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't open this chat right now. Please try again."
    };
  }
}

export async function getChatRoomSummaryAction(roomId: string): Promise<{
  room: ChatRoomSummary | null;
  error?: string;
}> {
  if (!isUuid(roomId)) {
    return {
      room: null,
      error: "Invalid room id."
    };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      room: null,
      error: "You need to sign in again."
    };
  }

  try {
    const room = await getChatRoomSummary(client, roomId, user.id);
    return { room };
  } catch (error) {
    return {
      room: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to fetch room summary."
    };
  }
}

export async function deleteChatHistoryAction(
  _prevState: DeleteChatHistoryState,
  formData: FormData
): Promise<DeleteChatHistoryState> {
  const chatId = String(formData.get("chatId") ?? "").trim();
  return deleteChatHistory(chatId);
}

export async function deleteChatHistory(chatId: string): Promise<DeleteChatHistoryState> {

  if (!chatId) {
    return {
      error: "Missing chat room information."
    };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "You need to sign in again before managing this chat."
    };
  }

  const { data: membership, error: membershipError } = await client
    .from("chat_participants")
    .select("id")
    .eq("chat_id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      error: "You no longer have access to this chat."
    };
  }

  const admin = createSupabaseAdminClient();
  const { error: deleteError } = await admin.from("messages").delete().eq("chat_id", chatId);

  if (deleteError) {
    return {
      error: deleteError.message ?? "We couldn't clear this chat history right now."
    };
  }

  await resetChatRoomSummariesForRoom(chatId);

  revalidatePath(`/chat/${chatId}`);
  revalidatePath("/home");

  return {
    success: true
  };
}

export async function leaveChatRoomAction(
  _prevState: LeaveChatRoomState,
  formData: FormData
): Promise<LeaveChatRoomState> {
  const chatId = String(formData.get("chatId") ?? "").trim();
  return leaveChatRoom(chatId);
}

export async function leaveChatRoom(chatId: string): Promise<LeaveChatRoomState> {
  if (!chatId) {
    return {
      error: "Missing chat room information."
    };
  }

  const client = await createSupabaseActionClient();
  const authResponse = await client.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "You need to sign in again before leaving this chat."
    };
  }

  const { data: membership, error: membershipError } = await client
    .from("chat_participants")
    .select("id")
    .eq("chat_id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      error: "You are no longer a participant in this chat."
    };
  }

  const admin = createSupabaseAdminClient();
  const { error: leaveError } = await admin.from("chats").delete().eq("id", chatId);

  if (leaveError) {
    return {
      error: leaveError.message ?? "We couldn't close this chat right now."
    };
  }

  revalidatePath(`/chat/${chatId}`);
  revalidatePath("/home");

  return {
    redirectTo: "/home?tab=chats"
  };
}
