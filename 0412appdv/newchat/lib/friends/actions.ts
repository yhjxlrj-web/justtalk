"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateFriendRequestFormState,
  ManageFriendshipFormState,
  RespondToFriendRequestFormState
} from "@/lib/friends/action-state";
import type { FriendRelationshipStatus } from "@/types/friends";

type ExistingFriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRelationshipStatus;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function createOrReuseFriendRequest(params: {
  requesterId: string;
  targetProfile: ProfileLookupRow;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const { requesterId, supabase, targetProfile } = params;
  const { data: existingRows, error: existingError } = (await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${requesterId})`
    )) as {
    data: ExistingFriendshipRow[] | null;
    error: { message?: string } | null;
  };

  if (existingError) {
    return {
      errors: {
        form:
          existingError.message ??
          "We couldn't verify the current friendship state. Please try again."
      }
    } satisfies CreateFriendRequestFormState;
  }

  const existingRelationship = existingRows?.[0] ?? null;

  if (existingRelationship) {
    if (existingRelationship.status === "accepted") {
      return {
        errors: {
          form: "You're already friends with this person."
        }
      } satisfies CreateFriendRequestFormState;
    }

    if (existingRelationship.status === "pending") {
      return {
        errors: {
          form:
            existingRelationship.requester_id === requesterId
              ? "A friend request is already pending."
              : "This person already sent you a request. Accept it below to connect."
        },
        friendshipId: existingRelationship.id,
        otherUserId: targetProfile.id,
        relationshipStatus: "pending"
      } satisfies CreateFriendRequestFormState;
    }

    if (existingRelationship.status === "blocked") {
      return {
        errors: {
          form: "This relationship can't be requested right now."
        }
      } satisfies CreateFriendRequestFormState;
    }

    const { error: reopenError } = await supabase
      .from("friendships")
      .update({
        requester_id: requesterId,
        addressee_id: targetProfile.id,
        status: "pending"
      })
      .eq("id", existingRelationship.id);

    if (reopenError) {
      return {
        errors: {
          form: reopenError.message ?? "We couldn't re-open this friend request. Please try again."
        }
      } satisfies CreateFriendRequestFormState;
    }

    revalidatePath("/home");

    return {
      errors: {},
      friendshipId: existingRelationship.id,
      otherUserId: targetProfile.id,
      relationshipStatus: "pending",
      successMessage: `Friend request sent to ${targetProfile.display_name || "that user"}.`
    } satisfies CreateFriendRequestFormState;
  }

  const { data: insertedFriendship, error: insertError } = (await supabase
    .from("friendships")
    .insert({
      requester_id: requesterId,
      addressee_id: targetProfile.id,
      status: "pending"
    })
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message?: string } | null;
  };

  if (insertError || !insertedFriendship) {
    return {
      errors: {
        form: insertError?.message ?? "We couldn't send the friend request. Please try again."
      }
    } satisfies CreateFriendRequestFormState;
  }

  revalidatePath("/home");

  return {
    errors: {},
    friendshipId: insertedFriendship.id,
    otherUserId: targetProfile.id,
    relationshipStatus: "pending",
    successMessage: `Friend request sent to ${targetProfile.display_name || "that user"}.`
  } satisfies CreateFriendRequestFormState;
}

export async function createFriendRequestAction(
  _prevState: CreateFriendRequestFormState,
  formData: FormData
): Promise<CreateFriendRequestFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email) {
    return {
      errors: {
        email: "Enter the email address of the person you'd like to add."
      }
    };
  }

  if (!isValidEmail(email)) {
    return {
      errors: {
        email: "Enter a valid email address."
      }
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      errors: {
        form: "Your session has expired. Please sign in again."
      }
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: targetProfile, error: targetError } = (await admin
    .from("profiles")
    .select("id, email, display_name")
    .ilike("email", email)
    .maybeSingle()) as {
    data: ProfileLookupRow | null;
    error: { message?: string } | null;
  };

  if (targetError) {
    return {
      errors: {
        form: targetError.message ?? "We couldn't search for that user right now. Please try again."
      }
    };
  }

  if (!targetProfile) {
    return {
      errors: {
        email: "We couldn't find a user with that email."
      }
    };
  }

  if (targetProfile.id === user.id) {
    return {
      errors: {
        email: "You can't send a friend request to yourself."
      }
    };
  }

  return createOrReuseFriendRequest({
    requesterId: user.id,
    supabase,
    targetProfile
  });
}

export async function createFriendRequestByUserIdAction(
  _prevState: CreateFriendRequestFormState,
  formData: FormData
): Promise<CreateFriendRequestFormState> {
  const otherUserId = String(formData.get("otherUserId") ?? "").trim();

  if (!otherUserId) {
    return {
      errors: {
        form: "Missing user information for this request."
      }
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      errors: {
        form: "Your session has expired. Please sign in again."
      }
    };
  }

  if (otherUserId === user.id) {
    return {
      errors: {
        form: "You can't send a friend request to yourself."
      }
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: targetProfile, error: targetError } = (await admin
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", otherUserId)
    .maybeSingle()) as {
    data: ProfileLookupRow | null;
    error: { message?: string } | null;
  };

  if (targetError || !targetProfile) {
    return {
      errors: {
        form: targetError?.message ?? "We couldn't find that user right now."
      }
    };
  }

  return createOrReuseFriendRequest({
    requesterId: user.id,
    supabase,
    targetProfile
  });
}

export async function respondToFriendRequestAction(
  _prevState: RespondToFriendRequestFormState,
  formData: FormData
): Promise<RespondToFriendRequestFormState> {
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!friendshipId || (decision !== "accepted" && decision !== "rejected")) {
    return {
      error: "This request action is invalid. Please refresh and try again."
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "Your session has expired. Please sign in again."
    };
  }

  const { data: friendship, error: friendshipError } = (await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("id", friendshipId)
    .maybeSingle()) as {
    data: ExistingFriendshipRow | null;
    error: { message?: string } | null;
  };

  if (friendshipError || !friendship) {
    return {
      error: "We couldn't find that request anymore. Please refresh and try again."
    };
  }

  if (friendship.addressee_id !== user.id || friendship.status !== "pending") {
    return {
      error: "This request is no longer available to respond to."
    };
  }

  const { error: updateError } = await supabase
    .from("friendships")
    .update({ status: decision })
    .eq("id", friendship.id);

  if (updateError) {
    return {
      error:
        updateError.message ??
        `We couldn't ${decision === "accepted" ? "accept" : "reject"} the request. Please try again.`
    };
  }

  revalidatePath("/home");

  return {
    decision,
    successMessage: decision === "accepted" ? "Friend request accepted." : "Friend request rejected."
  };
}

export async function manageFriendshipAction(
  _prevState: ManageFriendshipFormState,
  formData: FormData
): Promise<ManageFriendshipFormState> {
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const otherUserId = String(formData.get("otherUserId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (
    !otherUserId ||
    !friendshipId ||
    (action !== "block" && action !== "unblock")
  ) {
    return {
      error: "This action is invalid. Please refresh and try again."
    };
  }

  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    return {
      error: "Your session has expired. Please sign in again."
    };
  }

  console.log("manageFriendshipAction start", {
    action,
    friendshipId,
    otherUserId,
    userId: user.id
  });

  const admin = createSupabaseAdminClient();

  if (action === "unblock") {
    const { data: deletedBlocks, error: unblockError } = (await admin
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", otherUserId)
      .select("id")) as {
      data: Array<{ id: string }> | null;
      error: { message?: string } | null;
    };

    console.log("manageFriendshipAction unblock delete result", {
      action,
      friendshipId,
      otherUserId,
      userId: user.id,
      deletedBlockIds: deletedBlocks?.map((row) => row.id) ?? [],
      deletedCount: deletedBlocks?.length ?? 0,
      unblockError
    });

    if (unblockError) {
      return {
        error: unblockError.message ?? "We couldn't unblock this user right now."
      };
    }

    if (!deletedBlocks || deletedBlocks.length === 0) {
      return {
        error: "This blocked user could not be found anymore."
      };
    }

    revalidatePath("/home");
    revalidatePath("/chat");

    return {
      action,
      friendshipId,
      otherUserId,
      successMessage: "User unblocked."
    };
  }

  const { data: friendship, error: friendshipError } = (await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("id", friendshipId)
    .maybeSingle()) as {
    data: ExistingFriendshipRow | null;
    error: { message?: string } | null;
  };

  if (friendshipError || !friendship) {
    return {
      error: "This friendship could not be found anymore."
    };
  }

  if (friendship.requester_id !== user.id && friendship.addressee_id !== user.id) {
    return {
      error: "You can't manage this friendship."
    };
  }

  if (action === "block") {
    const { error: blockError } = await admin.from("user_blocks").upsert(
      {
        blocker_user_id: user.id,
        blocked_user_id: otherUserId
      },
      {
        onConflict: "blocker_user_id,blocked_user_id",
        ignoreDuplicates: false
      }
    );

    if (blockError) {
      return {
        error: blockError.message ?? "We couldn't block this user right now."
      };
    }
  }

  revalidatePath("/home");
  revalidatePath("/chat");

  return {
    action,
    friendshipId,
    otherUserId,
    successMessage: action === "block" ? "User blocked." : "User unblocked."
  };
}
