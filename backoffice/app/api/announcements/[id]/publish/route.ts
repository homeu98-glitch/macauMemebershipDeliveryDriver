import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../../lib/auth";
import { setAnnouncementPublished } from "../../../../../lib/driver-announcements";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const body = (await request.json()) as { published?: boolean };
    const item = await setAnnouncementPublished(params.id, Boolean(body.published));
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Update failed." },
      { status: 500 }
    );
  }
}
