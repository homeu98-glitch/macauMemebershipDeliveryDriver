# Supabase setup

Run the SQL script below in the Supabase SQL editor:

- `supabase/001_init_schema.sql`

## What it creates

- rider profile tables
- registration review tables
- document metadata tables
- order, assignment, event, and proof tables
- private storage buckets for rider documents and delivery proofs
- row-level security policies for riders and admins

## After running the SQL

1. Create at least one admin user in Supabase Auth.
2. Copy that user's `id`.
3. Insert it into `public.admin_users`.

Example:

```sql
insert into public.admin_users (user_id)
values ('YOUR_AUTH_USER_UUID');
```

## Storage path convention

Use the authenticated user's `auth.uid()` as the first folder segment so the storage policies work.

Examples:

- `driver-documents/<auth_user_id>/selfie.jpg`
- `driver-documents/<auth_user_id>/macau-id.jpg`
- `driver-documents/<auth_user_id>/driving-licence.jpg`
- `delivery-proofs/<auth_user_id>/order-123-proof.jpg`

## App-side notes

- The Android app should only use:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Never put the Supabase `service_role` key inside the APK.
- Any privileged order sync, JWT verification, or callback work should stay on your server or in Supabase Edge Functions.

## Suggested next SQL after first run

If you want, I can prepare follow-up scripts for:

- seed demo data
- helper SQL views for backoffice
- RPC functions for order acceptance and status updates
- audit-friendly callback queues
