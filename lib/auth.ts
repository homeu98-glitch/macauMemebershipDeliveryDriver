import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "backoffice_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function getSessionSecret() {
  return process.env.BACKOFFICE_SESSION_SECRET ?? "replace-me-session-secret";
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionValue(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function readSessionValue(rawValue?: string | null): SessionUser | null {
  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export function getSessionUser() {
  return readSessionValue(cookies().get(SESSION_COOKIE_NAME)?.value);
}
