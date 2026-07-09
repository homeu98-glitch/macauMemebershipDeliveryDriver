import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../../../lib/auth";
import { setActiveDriverAppRelease } from "../../../../../../lib/driver-app-release";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const active = await setActiveDriverAppRelease(params.id);
    return NextResponse.json({ success: true, active });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Activate release failed." },
      { status: 500 }
    );
  }
}
