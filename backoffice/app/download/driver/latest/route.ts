import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function hasBlobCredentials() {
  const hasRwToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const hasOidc = Boolean(process.env.VERCEL_OIDC_TOKEN?.trim() && process.env.BLOB_STORE_ID?.trim());
  return hasRwToken || hasOidc;
}

export async function GET() {
  // Avoid build-time failures when blob credentials are not configured yet.
  if (!hasBlobCredentials()) {
    return NextResponse.json(
      { message: "Vercel Blob is not configured yet." },
      { status: 503 }
    );
  }

  const result = await list({ prefix: "driver-apk/", limit: 1000 });
  const blobs = result.blobs ?? [];

  if (!blobs.length) {
    return NextResponse.json({ message: "No APK uploaded yet." }, { status: 404 });
  }

  // We encode timestamp into pathname to make lexicographical order == latest.
  const latest = blobs.reduce((acc, item) => (acc.pathname > item.pathname ? acc : item));

  return NextResponse.redirect(`${latest.url}?download=1`, 307);
}
