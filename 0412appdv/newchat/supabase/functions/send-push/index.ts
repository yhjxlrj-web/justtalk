import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SendPushRequest = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function base64UrlEncode(input: string | Uint8Array) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function createGoogleAccessToken(serviceAccount: FirebaseServiceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenJson.access_token) {
    throw new Error(
      `Failed to get Google access token: ${JSON.stringify(tokenJson)}`
    );
  }

  return tokenJson.access_token as string;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { userId, title, body, data }: SendPushRequest = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({
          error: "userId, title, body are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !serviceRoleKey || !serviceAccountRaw) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment secrets",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const serviceAccount = JSON.parse(
      serviceAccountRaw
    ) as FirebaseServiceAccount;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: tokenRows, error: tokenError } = await supabase
      .from("device_push_tokens")
      .select("id, fcm_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokenError) {
      throw new Error(`Failed to load push tokens: ${tokenError.message}`);
    }

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No active push tokens for this user",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await createGoogleAccessToken(serviceAccount);

    const results: Array<{
      token: string;
      ok: boolean;
      response: unknown;
    }> = [];

    for (const row of tokenRows) {
      const fcmResponse = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: row.fcm_token,
              notification: {
                title,
                body,
              },
              data: data ?? {},
              android: {
                priority: "high",
              },
            },
          }),
        }
      );

      const responseJson = await fcmResponse.json();

      results.push({
        token: row.fcm_token,
        ok: fcmResponse.ok,
        response: responseJson,
      });

      if (!fcmResponse.ok) {
        const errorText = JSON.stringify(responseJson);

        if (
          errorText.includes("UNREGISTERED") ||
          errorText.includes("registration-token-not-registered")
        ) {
          await supabase
            .from("device_push_tokens")
            .update({
              is_active: false,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});