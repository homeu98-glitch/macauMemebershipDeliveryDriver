import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";

function stableUrls(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  return {
    landingPageUrl: `${origin}/download/driver`,
    stableDownloadUrl: `${origin}/download/driver/latest`
  };
}

export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) {
    const { landingPageUrl, stableDownloadUrl } = stableUrls(request);
    return NextResponse.json(
      { success: false, message: "未登入。", landingPageUrl, stableDownloadUrl },
      { status: 401 }
    );
  }

  const { landingPageUrl, stableDownloadUrl } = stableUrls(request);

  try {
    const result = await list({ prefix: "driver-apk/", limit: 1000 });
    const blobs = result.blobs ?? [];

    if (!blobs.length) {
      return NextResponse.json({
        success: false,
        message: "尚未找到任何已上傳的 APK。",
        landingPageUrl,
        stableDownloadUrl
      });
    }

    // list() is lexicographical, so we encode timestamp in pathname; choose the max pathname.
    const latest = blobs.reduce((acc, item) => (acc.pathname > item.pathname ? acc : item));

    return NextResponse.json({
      success: true,
      landingPageUrl,
      stableDownloadUrl,
      blob: {
        url: latest.url,
        pathname: latest.pathname,
        size: latest.size,
        uploadedAt: latest.uploadedAt.toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Load latest APK failed",
        landingPageUrl,
        stableDownloadUrl
      },
      { status: 500 }
    );
  }
}
