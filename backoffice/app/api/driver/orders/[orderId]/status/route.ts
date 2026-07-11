import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";

export async function POST(request: Request, { params }: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/mobile/orders/${params.orderId}/status`, { method: "POST", headers: { "Content-Type": "application/json", "x-supabase-access-token": session.accessToken }, body: await request.text(), cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  });
}
