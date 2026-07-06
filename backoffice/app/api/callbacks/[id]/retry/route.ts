import { NextResponse } from "next/server";
import crypto from "crypto";

import { getSessionUser } from "../../../../../lib/auth";
import { createSiteBApiToken, getConfiguredWebhookSecret } from "../../../../../lib/siteb-api-auth";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

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
    .select("id,order_id,endpoint,request_body")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !logRow) {
    return NextResponse.json({ message: "找不到回調紀錄。" }, { status: 404 });
  }

  const endpoint = logRow.endpoint.startsWith("http")
    ? logRow.endpoint
    : `${apiBaseUrl.replace(/\/$/, "")}/${logRow.endpoint.replace(/^\//, "")}`;

  let callbackSecret = "";
  if (logRow.order_id) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("source_payload")
      .eq("id", logRow.order_id)
      .maybeSingle();
    const callbackMeta =
      orderRow?.source_payload && typeof orderRow.source_payload === "object"
        ? (orderRow.source_payload as Record<string, any>).callback
        : null;
    callbackSecret =
      callbackMeta && typeof callbackMeta === "object" && typeof callbackMeta.secret === "string"
        ? callbackMeta.secret.trim()
        : "";
  }
  callbackSecret = callbackSecret || getConfiguredWebhookSecret();

  try {
    const rawBody = JSON.stringify(logRow.request_body ?? {});
    const timestamp = new Date().toISOString();
    const signature = callbackSecret
      ? crypto.createHmac("sha256", callbackSecret).update(`${timestamp}.${rawBody}`).digest("hex")
      : "";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${createSiteBApiToken("backoffice-callback-retry", "siteb-api").accessToken}`,
        ...(signature
          ? {
              "X-SiteB-Timestamp": timestamp,
              "X-SiteB-Signature": signature
            }
          : {})
      },
      body: rawBody
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
