import { NextResponse } from "next/server";

import { getSessionUser } from "../../../lib/auth";
import { listDriverAnnouncements, createDriverAnnouncement } from "../../../lib/driver-announcements";

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const items = await listDriverAnnouncements(50);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load announcements failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      published?: boolean;
    };

    const item = await createDriverAnnouncement({
      title: body.title ?? "",
      content: body.content ?? "",
      published: body.published,
      createdBy: user.id
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Create announcement failed." },
      { status: 400 }
    );
  }
}
