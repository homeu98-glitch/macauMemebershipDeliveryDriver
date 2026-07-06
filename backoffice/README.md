# Membership Delivery Driver Backoffice

Production-style Next.js backoffice for rider operations, order monitoring, callback visibility, and deployment readiness.

## What is included

- Next.js App Router with TypeScript
- Login page with Supabase Auth admin login
- Dashboard with operational KPIs and live summaries
- Rider applications and approval workflow
- Rider list view
- Orders list and order detail pages
- Callback logs view
- Settings page with Supabase and API environment placeholders
- Responsive UI with Traditional Chinese copy and brighter theme
- Vercel-ready project structure

## Tech stack

- Next.js 14
- React 18
- TypeScript
- CSS via `app/globals.css`
- Optional Supabase client placeholder via `@supabase/supabase-js`

## Local setup

1. Open a terminal in the project root
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Copy the example environment file:

   ```powershell
   Copy-Item '.env.example' '.env.local'
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Open `http://localhost:3000`

## Environment variables

Use the placeholders in `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://macau-delivery.vercel.app
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-service-role-key
BACKOFFICE_SESSION_SECRET=replace-with-a-long-random-session-secret
JWT_SHARED_SECRET=replace-with-your-jwt-shared-secret
SITEB_DELIVERY_CLIENT_ID=macau-ledger
SITEB_DELIVERY_CLIENT_SECRET=replace-with-siteb-delivery-client-secret
SITEB_DELIVERY_WEBHOOK_SECRET=replace-with-siteb-webhook-secret
SITEB_DELIVERY_CLIENT_SECRET_PREVIOUS=
```

`SUPABASE_SERVICE_ROLE_KEY` and `BACKOFFICE_SESSION_SECRET` are server-only values. Never expose them in the browser or Android app.

## Vercel deployment

1. Import the repository into Vercel.
2. Add the environment variables from `.env.example`.
3. Build command: `npm run build`
4. Output: default Next.js output

No extra Vercel configuration is required for the current setup.

## Project structure

```text
app/
├─ api/auth/
├─ callbacks/page.tsx
├─ dashboard/page.tsx
├─ login/page.tsx
├─ orders/
│  ├─ [id]/page.tsx
│  └─ page.tsx
├─ riders/
│  ├─ applications/page.tsx
│  └─ page.tsx
├─ settings/page.tsx
├─ globals.css
└─ layout.tsx
components/
├─ backoffice.tsx
└─ root-frame.tsx
lib/
├─ auth.ts
├─ data.ts
└─ supabase.ts
middleware.ts
.env.example
package.json
```

## Notes for production hardening

- Keep service-role access server-side only.
- Use `JWT_SHARED_SECRET` for callback retries to your main API.
- Connect order creation and callback logs to your main site or Edge Functions.
- Add audit logging, role-based access control, and pagination as data volumes grow.
