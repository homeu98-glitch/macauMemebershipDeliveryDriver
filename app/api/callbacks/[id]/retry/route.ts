import crypto from "crypto";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function createJwt() {
  const secret = process.env.JWT_SHARED_SECRET;
  if (!secret) {
    throw new Error("JWT_SHARED_SECRET 尚未設定。");
  }

  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: "membership-delivery-backoffice",
      aud: "membership-delivery-api",
      iat: now,
      exp: now + 300
    })
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "未登入。" }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl || apiBaseUrl.includes("your-api.example.com")) {
    return NextResponse.json(
      { message: "NEXT_PUBLIC_API_BASE_URL 尚未設定。" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: logRow, error } = await supabase
    .from("callback_logs")
    .select("id,endpoint,request_body")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !logRow) {
    return NextResponse.json({ message: "找不到回調紀錄。" }, { status: 404 });
  }

  const endpoint = logRow.endpoint.startsWith("http")
    ? logRow.endpoint
    : `${apiBaseUrl.replace(/\/$/, "")}/${logRow.endpoint.replace(/^\//, "")}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${createJwt()}`
      },
      body: JSON.stringify(logRow.request_body ?? {})
    });

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = { message: await response.text() };
    }

    await supabase
      .from("callback_logs")
      .update({
        http_status: response.status,
        response_body: responseBody,
        sent_at: new Date().toISOString()
      })
      .eq("id", params.id);

    return NextResponse.json({ success: response.ok, status: response.status });
  } catch (fetchError) {
    await supabase
      .from("callback_logs")
      .update({
        http_status: 500,
        response_body: {
          message: fetchError instanceof Error ? fetchError.message : "回調失敗"
        },
        sent_at: new Date().toISOString()
      })
      .eq("id", params.id);

    return NextResponse.json(
      {
        message: fetchError instanceof Error ? fetchError.message : "回調失敗"
      },
      { status: 500 }
    );
  }
}
