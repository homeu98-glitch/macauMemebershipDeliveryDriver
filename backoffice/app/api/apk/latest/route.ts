import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { getDriverAppDownloadConfig } from "../../../../lib/app-release-config";

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
    const config = await getDriverAppDownloadConfig();

    if (!config) {
      return NextResponse.json({
        success: false,
        message: "尚未設定 APK 連結。",
        landingPageUrl,
        stableDownloadUrl
      });
    }

    return NextResponse.json({
      success: true,
      landingPageUrl,
      stableDownloadUrl,
      config
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Load APK config failed.",
        landingPageUrl,
        stableDownloadUrl
      },
      { status: 500 }
    );
  }
}
