import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";

export async function GET() {
  return withDriverSession(async () =>
    NextResponse.json({
      supported: true,
      vapidPublicKeyConfigured: Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim()),
      publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() || null
    })
  );
}
