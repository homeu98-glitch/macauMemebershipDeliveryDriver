import { NextResponse } from "next/server";

export function apiSuccess(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      success: true,
      ...payload
    },
    { status }
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ?? {})
      }
    },
    { status }
  );
}
