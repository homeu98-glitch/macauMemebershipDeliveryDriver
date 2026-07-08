import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await list({ prefix: "driver-apk/", limit: 1000 });
  const blobs = result.blobs ?? [];

  if (!blobs.length) {
    return NextResponse.json(
      { message: "No APK uploaded yet." },
      { status: 404 }
    );
  }

  const latest = blobs.reduce((acc, item) => (acc.pathname > item.pathname ? acc : item));
  return NextResponse.redirect(`${latest.url}?download=1`, 307);
}
