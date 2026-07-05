# Membership Delivery Driver Android App

Native Android V1 scaffold built with Kotlin and Jetpack Compose for a Macau-focused delivery driver workflow.

## Included scope

### Must-have V1
- Login screen
- Driver registration with:
  - selfie upload placeholder
  - Macau ID upload placeholder
  - driving licence upload placeholder
- Pending approval UI after registration
- Home dashboard
- Orders list
- Order detail page
- Online / offline availability toggle
- Shop navigation entry point
- Customer navigation entry point
- Earnings summary and history list
- Proof-of-delivery photo placeholder
- Issue reporting action
- Call actions for shop and customer

### Good-for-V1 included
- Lightweight repository pattern with fake in-memory data
- JWT / API gateway abstractions as placeholders
- Callback envelope models for later webhook or async integration
- Supabase config boundary using URL + anon key only
- StateFlow-based UI state with immutable models

## Project structure

```text
MembershipDeliveryDriver/
├─ build.gradle.kts
├─ settings.gradle.kts
├─ gradle.properties
├─ README.md
└─ app/
   ├─ build.gradle.kts
   └─ src/main/
      ├─ AndroidManifest.xml
      └─ java/com/membershipdeliverydriver/app/
         ├─ MainActivity.kt
         ├─ DriverApp.kt
         ├─ core/
         │  ├─ AppModels.kt
         │  ├─ ApiContracts.kt
         │  ├─ DriverRepository.kt
         │  ├─ DriverViewModel.kt
         │  └─ SupabaseConfig.kt
         └─ ui/
            └─ Theme.kt
```

## Architecture notes

This scaffold favors a performance-friendly architecture for V1:

- `DriverAppState` is immutable and held in a single `StateFlow`.
- `DriverViewModel` performs all state mutations in one place, which keeps Compose recomposition paths easy to reason about.
- `DriverRepository` is the app-facing data boundary.
- `AuthGateway` and `OrdersGateway` define backend integration contracts without hard-coding implementation details.
- Placeholder callback models (`CallbackEnvelope`, `AuthCallback`, `RegistrationCallback`, `OrdersSyncCallback`) are ready for JWT exchange, async syncing, or server callbacks later.
- Fake repository data keeps UI testable before backend contracts are finalized.

## Supabase setup

The app intentionally exposes only client-safe configuration:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_BASE_URL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

These are defined as `BuildConfig` fields in:

- `app/build.gradle.kts`

Replace:

```kotlin
buildConfigField("String", "SUPABASE_URL", "\"https://your-project.supabase.co\"")
buildConfigField("String", "SUPABASE_ANON_KEY", "\"replace-with-your-anon-key\"")
buildConfigField("String", "API_BASE_URL", "\"https://your-api.example.com/\"")
buildConfigField("String", "JWT_ISSUER", "\"membership-driver\"")
buildConfigField("String", "JWT_AUDIENCE", "\"membership-driver-api\"")
```

Important:

- Do not place the Supabase `service_role` key in the Android app.
- Keep privileged logic on a secure server or Edge Function.

## How to open and run

1. Open the project in Android Studio.
2. Let Gradle sync.
3. Replace the placeholder Supabase URL and anon key in `app/build.gradle.kts`.
4. Run the `app` configuration on an emulator or device.

## Demo behavior

- Demo login password: `demo123`
- Registration submission always routes to pending approval
- Uploads use the platform content picker as placeholders
- Order, earnings, issue, and proof-of-delivery data are currently fake in-memory data

## Recommended next backend steps

1. Replace `PlaceholderAuthGateway` with real auth and token refresh handling.
2. Replace `PlaceholderOrdersGateway` with assigned-order sync and status update APIs.
3. Persist JWT and session metadata securely.
4. Replace generic map intents with the production navigation provider you choose.
5. Add camera capture, offline caching, and background sync for delivery operations.
