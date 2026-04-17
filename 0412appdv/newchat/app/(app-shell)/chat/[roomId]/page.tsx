import { redirect } from "next/navigation";
import { ChatRoomRealtime } from "@/components/chat/chat-room-realtime";
import { getServerUserOrRedirectOnInvalidSession } from "@/lib/auth/server-session";
import { getLightweightChatRoomEntryData } from "@/lib/chats/chats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";

export default async function ChatRoomPage({
  params
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  if (!isUuid(roomId)) {
    redirect("/home?tab=chats");
  }

  const supabase = await createSupabaseServerClient();
  const user = await getServerUserOrRedirectOnInvalidSession(supabase);

  if (!user) {
    redirect("/login");
  }

  const room = await getLightweightChatRoomEntryData(supabase, roomId, user.id);

  if (!room) {
    redirect("/home?tab=chats");
  }

  return (
    <ChatRoomRealtime
      room={room}
      initialMessages={[]}
      viewerId={user.id}
    />
  );
}
