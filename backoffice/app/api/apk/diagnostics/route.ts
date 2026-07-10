import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { getDriverAppDownloadConfig } from "../../../../lib/app-release-config";
import { getActiveDriverAppRelease, listDriverAppReleases } from "../../../../lib/driver-app-release";

function extractFilename(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const part = url.pathname.split("/").filter(Boolean).pop();
    return part ? decodeURIComponent(part) : null;
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  const url = new URL(request.url);
  const origin = url.origin;
  const landingPageUrl = `${origin}/apkdownload`;
  const stableDownloadUrl = `${origin}/apkdownload/latest`;

  try {
    const [active, releases, config] = await Promise.all([
      getActiveDriverAppRelease().catch(() => null),
      listDriverAppReleases().catch(() => []),
      getDriverAppDownloadConfig().catch(() => null),
    ]);

    let publicVersion: string | null = null;
    let publicUsed: string | null = null;
    try {
      const res = await fetch(`${origin}/api/public/driver-app/latest?debug=2&t=${Date.now()}`, {
        cache: "no-store",
      });
      const json = await res.json() as any;
      if (json?.success) {
        publicVersion = typeof json.version === "string" ? json.version : null;
        publicUsed = json?.debug?.used ?? null;
      }
    } catch {
      // ignore
    }

    let latestRedirectUrl: string | null = null;
    let latestFilename: string | null = null;
    try {
      const redirectRes = await fetch(stableDownloadUrl, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
      });
      latestRedirectUrl = redirectRes.headers.get("location");
      latestFilename = extractFilename(latestRedirectUrl);
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      landingPageUrl,
      stableDownloadUrl,
      active,
      legacyConfig: config,
      publicVersion,
      publicUsed,
      latestRedirectUrl,
      latestFilename,
      releases,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load APK diagnostics failed." },
      { status: 500 }
    );
  }
}
