import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import {
  createDriverAppRelease,
  listDriverAppReleases
} from "../../../../lib/driver-app-release";

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const releases = await listDriverAppReleases();
    return NextResponse.json({ success: true, releases });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load releases failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      version?: string;
      apkUrl?: string;
      releaseNotes?: string;
    };

    const created = await createDriverAppRelease({
      version: body.version ?? "",
      apkUrl: body.apkUrl ?? "",
      releaseNotes: body.releaseNotes,
      createdBy: user.id
    });

    return NextResponse.json({ success: true, release: created });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Create release failed." },
      { status: 400 }
    );
  }
}
