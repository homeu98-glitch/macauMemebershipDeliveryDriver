import { createServiceRoleSupabaseClient } from "./supabase";


function normalizeCreatedBy(value?: string | null) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export type DriverAppRelease = {
  id: string;
  version: string;
  apkUrl: string;
  releaseNotes: string;
  createdAt: string;
  isActive: boolean;
};

function mapRow(row: any): DriverAppRelease {
  return {
    id: row.id,
    version: row.version,
    apkUrl: row.apk_url,
    releaseNotes: row.release_notes ?? "",
    createdAt: row.created_at,
    isActive: Boolean(row.is_active)
  };
}

export async function listDriverAppReleases(): Promise<DriverAppRelease[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_app_releases")
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getActiveDriverAppRelease(): Promise<DriverAppRelease | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_app_releases")
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? mapRow(data[0]) : null;
}

export async function createDriverAppRelease(input: {
  version: string;
  apkUrl: string;
  releaseNotes?: string;
  createdBy?: string | null;
}) {
  const version = input.version.trim();
  const apkUrl = input.apkUrl.trim();
  if (!version) throw new Error("version 不能為空。");
  if (!apkUrl) throw new Error("apkUrl 不能為空。");

  // validate URL
  try {
    const parsed = new URL(apkUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
  } catch {
    throw new Error("apkUrl 格式無效。");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_app_releases")
    .insert({
      version,
      apk_url: apkUrl,
      release_notes: input.releaseNotes?.trim() ?? "",
      created_by: normalizeCreatedBy(input.createdBy),
      is_active: false
    })
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function setActiveDriverAppRelease(releaseId: string) {
  const supabase = createServiceRoleSupabaseClient();

  // deactivate all
  const { error: clearError } = await supabase
    .from("driver_app_releases")
    .update({ is_active: false })
    .eq("is_active", true);
  if (clearError) throw clearError;

  const { data, error } = await supabase
    .from("driver_app_releases")
    .update({ is_active: true })
    .eq("id", releaseId)
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteDriverAppRelease(releaseId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("driver_app_releases")
    .delete()
    .eq("id", releaseId);
  if (error) throw error;
  return { success: true };
}
