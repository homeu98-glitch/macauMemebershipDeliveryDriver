import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../../lib/auth";
import { deleteDriverAppRelease } from "../../../../../lib/driver-app-release";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const result = await deleteDriverAppRelease(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Delete release failed." },
      { status: 500 }
    );
  }
}
