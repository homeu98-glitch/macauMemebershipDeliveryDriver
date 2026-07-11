import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/mobile/orders/${params.orderId}/proof`, { headers: { "x-supabase-access-token": session.accessToken }, cache: "no-store" });
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request, { params }: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    const origin = new URL(request.url).origin;
    const formData = await request.formData();
    const response = await fetch(`${origin}/api/mobile/orders/${params.orderId}/proof`, { method: "POST", headers: { "x-supabase-access-token": session.accessToken }, body: formData, cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  });
}
