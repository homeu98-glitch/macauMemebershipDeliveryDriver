import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { backfillStoredDistricts, listMacauDistrictNames } from "../../../../lib/districts";

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  return NextResponse.json({
    success: true,
    districtCount: listMacauDistrictNames().length,
    districts: listMacauDistrictNames()
  });
}

export async function POST() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const result = await backfillStoredDistricts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Backfill districts failed." },
      { status: 500 }
    );
  }
}
