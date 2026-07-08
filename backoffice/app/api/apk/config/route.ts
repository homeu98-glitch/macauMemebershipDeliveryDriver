import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { getDriverAppDownloadConfig, saveDriverAppDownloadConfig } from "../../../../lib/app-release-config";

function stableUrls(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  return {
    landingPageUrl: `${origin}/apkdownload`,
    stableDownloadUrl: `${origin}/apkdownload/latest`
  };
}

export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "未登入。" }, { status: 401 });
  }

  try {
    const config = await getDriverAppDownloadConfig();
    return NextResponse.json({
      success: true,
      config,
      ...stableUrls(request)
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load APK config failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "未登入。" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      apkUrl?: string;
      version?: string;
      releaseNotes?: string;
    };

    const config = await saveDriverAppDownloadConfig({
      apkUrl: body.apkUrl ?? "",
      version: body.version,
      releaseNotes: body.releaseNotes
    });

    return NextResponse.json({
      success: true,
      config,
      ...stableUrls(request)
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Save APK config failed." },
      { status: 400 }
    );
  }
}
