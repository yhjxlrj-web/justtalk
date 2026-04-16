# Deploying to Render

This project is ready for a Node-based Next.js deployment on Render as a **Web Service**.

## Service Type

- Runtime: `Node`
- Service type: `Web Service`
- Environment: `Node`

## Commands

- Build command: `npm install && npm run build`
- Start command: `npm run start`

`next start` is the correct production command for this app.
Do not use static export.
Do not set `output: "export"` in Next.js config.

## Required Environment Variables

Set these in the Render dashboard for the web service:

- `NEXT_PUBLIC_SUPABASE_URL`
  Public Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Public Supabase anon key used by the browser and SSR helpers
- `SUPABASE_SERVICE_ROLE_KEY`
  Server-only key for privileged account cleanup and admin operations
- `OPENAI_API_KEY`
  Server-only OpenAI key for message translation
- `OPENAI_TRANSLATION_MODEL`
  Optional model override for server-side translation
  Example: `gpt-5-mini`

## Important Production Notes

- Keep all OpenAI usage server-side only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` to the client.
- Render automatically provides `PORT`; `next start` uses it correctly.
- This app uses App Router, API routes, server actions, and Supabase SSR helpers, so it must run as a Node service, not a static site.
- Supabase Realtime must be enabled for the tables used by chat updates, especially:
  - `messages`
  - `message_translations`
  - `chats`
  - `chat_participants`
- Make sure the Supabase database schema and migrations are applied before deploying.
- Make sure the Supabase Storage bucket for avatars exists if profile uploads are enabled.
- For auth email verification, your Supabase project should allow the Render production domain in its redirect URL settings.
- For login/session stability behind Render, keep the app on HTTPS in production and configure Supabase site URL / redirect URLs to the deployed Render hostname.

## Suggested Render Setup Steps

1. Create a new Web Service from this repository.
2. Set the build command to `npm install && npm run build`.
3. Set the start command to `npm run start`.
4. Add the required environment variables.
5. Apply the SQL migration in `supabase/migrations/`.
6. Update Supabase auth redirect URLs to the deployed Render domain.
7. Deploy.

## Verification Checklist

- `npm run build` succeeds
- Login works in production
- Signup verification links return to the production domain
- Profile photo uploads succeed
- Chat messages save and translations are created server-side
- Realtime subscriptions receive new messages and translation updates
