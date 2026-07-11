import crypto from "node:crypto";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { createAnonSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase";

export const DRIVER_SESSION_COOKIE_NAME = "driver_web_session";

export type DriverApprovalStatus = "pending_review" | "approved" | "rejected" | "suspended";
export type DriverAvailability = "online" | "offline";

export type DriverWebSession = {
  authUserId: string;
  driverId: string;
  fullName: string;
  phone: string;
  approvalStatus: DriverApprovalStatus;
  availability: DriverAvailability;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type SessionPayload = {
  data: DriverWebSession;
  signature: string;
};

function getSecret() {
  return process.env.BACKOFFICE_SESSION_SECRET ?? "driver-web-session-secret";
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function encodeSession(session: DriverWebSession) {
  const payload = JSON.stringify(session);
  const wrapper: SessionPayload = { data: session, signature: signPayload(payload) };
  return Buffer.from(JSON.stringify(wrapper), "utf-8").toString("base64url");
}

function decodeSession(raw: string): DriverWebSession | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as SessionPayload;
    if (parsed.signature !== signPayload(JSON.stringify(parsed.data))) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function normalizeLocalPhone(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("853") ? digits.slice(3) : digits;
}

export function isValidMacauMobile(phone: string) {
  return /^6\d{7}$/.test(normalizeLocalPhone(phone));
}

export function driverEmailFromPhone(phone: string) {
  return `853${normalizeLocalPhone(phone)}@driver.membership.local`;
}

export function driverPasswordFromPin(pin: string) {
  return `DriverPin#${pin}@2026`;
}

export async function getDriverProfileByAuthUserId(authUserId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("id,full_name,phone,approval_status,availability,accepted_terms_version,accepted_terms_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export function buildDriverSession(input: {
  authUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  profile: {
    id: string;
    full_name: string;
    phone: string;
    approval_status: string;
    availability: string;
  };
}): DriverWebSession {
  return {
    authUserId: input.authUserId,
    driverId: input.profile.id,
    fullName: input.profile.full_name,
    phone: input.profile.phone,
    approvalStatus: (input.profile.approval_status ?? "pending_review") as DriverApprovalStatus,
    availability: (input.profile.availability ?? "offline") as DriverAvailability,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: Date.now() + input.expiresInSeconds * 1000
  };
}

export function getDriverSession() {
  const raw = cookies().get(DRIVER_SESSION_COOKIE_NAME)?.value;
  return raw ? decodeSession(raw) : null;
}

export async function ensureActiveDriverSession() {
  const current = getDriverSession();
  if (!current) return { session: null as DriverWebSession | null, refreshed: false };
  if (current.expiresAt > Date.now() + 60_000) return { session: current, refreshed: false };
  if (!current.refreshToken) return { session: current, refreshed: false };

  const anon = createAnonSupabaseClient();
  const { data, error } = await anon.auth.refreshSession({ refresh_token: current.refreshToken });
  if (error || !data.session || !data.user) return { session: current, refreshed: false };

  const profile = await getDriverProfileByAuthUserId(data.user.id);
  if (!profile) return { session: current, refreshed: false };

  return {
    session: buildDriverSession({
      authUserId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresInSeconds: data.session.expires_in ?? 3600,
      profile
    }),
    refreshed: true
  };
}

export function applyDriverSessionCookie(response: NextResponse, session: DriverWebSession) {
  response.cookies.set(DRIVER_SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearDriverSessionCookie(response: NextResponse) {
  response.cookies.set(DRIVER_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}
