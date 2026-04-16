"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEVELOPER_EMAIL = "yhjxlrj@gmail.com";

type ChatMembershipRow = {
  chat_id: string;
};

type DirectChatRow = {
  id: string;
};

export async function developerUnblockUserAction(params: {
  blockId: string;
  blockerUserId: string;
  blockedUserId: string;
}) {
  if (!params.blockId || !params.blockerUserId || !params.blockedUserId) {
    return {
      error: "Missing block information."
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "Your session has expired."
    };
  }

  if ((user.email ?? "").trim().toLowerCase() !== DEVELOPER_EMAIL) {
    return {
      error: "Developer access is required."
    };
  }

  const admin = createSupabaseAdminClient();

  const { error: deleteBlockError } = await admin.from("user_blocks").delete().eq("id", params.blockId);

  if (deleteBlockError) {
    return {
      error: deleteBlockError.message ?? "We couldn't remove this block entry right now."
    };
  }

  const { error: deleteFriendshipsError } = await admin
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${params.blockerUserId},addressee_id.eq.${params.blockedUserId}),and(requester_id.eq.${params.blockedUserId},addressee_id.eq.${params.blockerUserId})`
    );

  if (deleteFriendshipsError) {
    console.error("developerUnblockUserAction friendship cleanup error", deleteFriendshipsError);
  }

  const [blockerMembershipsResult, blockedMembershipsResult] = await Promise.all([
    admin.from("chat_participants").select("chat_id").eq("user_id", params.blockerUserId),
    admin.from("chat_participants").select("chat_id").eq("user_id", params.blockedUserId)
  ]);

  const blockerMemberships = (blockerMembershipsResult.data ?? []) as ChatMembershipRow[];
  const blockedMemberships = (blockedMembershipsResult.data ?? []) as ChatMembershipRow[];
  const sharedChatIds = blockerMemberships
    .map((row) => row.chat_id)
    .filter((chatId) => blockedMemberships.some((row) => row.chat_id === chatId));

  if (sharedChatIds.length > 0) {
    const { data: directChats, error: directChatLookupError } = (await admin
      .from("chats")
      .select("id")
      .in("id", sharedChatIds)
      .eq("chat_type", "direct")) as {
      data: DirectChatRow[] | null;
      error: { message?: string } | null;
    };

    if (directChatLookupError) {
      console.error("developerUnblockUserAction direct chat lookup error", directChatLookupError);
    }

    const directChatIds = (directChats ?? []).map((row) => row.id);

    if (directChatIds.length > 0) {
      const { error: deleteParticipantsError } = await admin
        .from("chat_participants")
        .delete()
        .in("chat_id", directChatIds)
        .in("user_id", [params.blockerUserId, params.blockedUserId]);

      if (deleteParticipantsError) {
        console.error("developerUnblockUserAction participant cleanup error", deleteParticipantsError);
      }
    }
  }

  revalidatePath("/home");
  revalidatePath("/chat");

  return {
    blockId: params.blockId,
    success: true
  };
}
