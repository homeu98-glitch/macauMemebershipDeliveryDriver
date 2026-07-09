import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { deleteAnnouncement } from "../../../../lib/driver-announcements";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const result = await deleteAnnouncement(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Delete failed." },
      { status: 500 }
    );
  }
}
