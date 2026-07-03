import { createClient } from "@supabase/supabase-js";

import { ENV_PLACEHOLDERS } from "@/lib/data";

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL
  );
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function hasServiceRoleKey() {
  return getServiceRoleKey().trim().length > 0;
}

export function hasSessionSecretConfigured() {
  const value = process.env.BACKOFFICE_SESSION_SECRET ?? "";
  return value.trim().length > 0 && value !== "replace-me-session-secret";
}

export function createAnonSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false }
  });
}

export function createServiceRoleSupabaseClient() {
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 尚未設定。");
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function isSupabaseConfigured() {
  return !getSupabaseUrl().includes("your-project.supabase.co") &&
    !getSupabaseAnonKey().includes("replace-with-your-anon-key");
}
