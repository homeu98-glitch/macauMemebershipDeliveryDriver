# Membership Delivery Driver

Macau-focused delivery driver project containing both the Android rider app and the Next.js backoffice.

## Project structure

```text
MembershipDeliveryDriver/
├─ app/                 # Android rider app (Kotlin + Jetpack Compose)
├─ backoffice/          # Next.js backoffice
├─ supabase/            # SQL schema and migrations
├─ build.gradle.kts
├─ settings.gradle.kts
└─ README.md
```

## Android rider app

The Android app includes:

- rider login and registration
- pending approval flow
- active order workflow
- real `已取貨` action
- proof-of-delivery upload flow
- Firebase push notifications
- per-event Cantonese notification sounds
- earnings and profile pages

Main Android entry points:

- `app/src/main/java/com/membershipdeliverydriver/app/DriverApp.kt`
- `app/src/main/java/com/membershipdeliverydriver/app/core/DriverRepository.kt`
- `app/src/main/java/com/membershipdeliverydriver/app/core/DriverNotifications.kt`

## Backoffice

The backoffice includes:

- dashboard
- rider approval workflow
- orders list and order details
- callback visibility
- push-token registration visibility
- dashboard test-order creation buttons
- testing page for fake orders and test push
- Firebase Admin push sending

Main backoffice entry points:

- `backoffice/app/dashboard/page.tsx`
- `backoffice/components/backoffice.tsx`
- `backoffice/lib/siteb-order-api.ts`
- `backoffice/lib/push-notifications.ts`

## Backoffice local setup

```powershell
cd backoffice
npm install
Copy-Item '.env.example' '.env.local'
npm run dev
```

## Backoffice environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-service-role-key
BACKOFFICE_SESSION_SECRET=replace-with-a-long-random-session-secret
JWT_SHARED_SECRET=replace-with-your-jwt-shared-secret
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

## Notes

- Keep service-role and Firebase Admin credentials server-side only.
- Do not place privileged keys inside the Android app.
- The Android app is built from the repo root with Gradle.
- The backoffice is deployed separately from `backoffice/`.
