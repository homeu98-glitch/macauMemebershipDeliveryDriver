import { createServiceRoleSupabaseClient } from "./supabase";

const DRIVER_APP_CONFIG_KEY = "driver_app_download";

type DriverAppConfigValue = {
  apkUrl?: string;
  version?: string;
  releaseNotes?: string;
};

export type DriverAppDownloadConfig = {
  apkUrl: string;
  version: string;
  releaseNotes: string;
  updatedAt: string | null;
};

function normalize(value?: DriverAppConfigValue | null, updatedAt?: string | null): DriverAppDownloadConfig | null {
  const apkUrl = value?.apkUrl?.trim() || "";
  if (!apkUrl) return null;

  return {
    apkUrl,
    version: value?.version?.trim() || "最新版本",
    releaseNotes: value?.releaseNotes?.trim() || "請下載並安裝最新 APK。",
    updatedAt: updatedAt ?? null
  };
}

export async function getDriverAppDownloadConfig() {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("app_configs")
    .select("key,value,updated_at")
    .eq("key", DRIVER_APP_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalize((data?.value as DriverAppConfigValue | null) ?? null, data?.updated_at ?? null);
}

export async function saveDriverAppDownloadConfig(input: {
  apkUrl: string;
  version?: string;
  releaseNotes?: string;
}) {
  const apkUrl = input.apkUrl.trim();
  if (!apkUrl) {
    throw new Error("APK 連結不能為空。");
  }

  let parsed: URL;
  try {
    parsed = new URL(apkUrl);
  } catch {
    throw new Error("APK 連結格式無效。");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("APK 連結必須以 http:// 或 https:// 開頭。");
  }

  const supabase = createServiceRoleSupabaseClient();
  const value: DriverAppConfigValue = {
    apkUrl,
    version: input.version?.trim() || "最新版本",
    releaseNotes: input.releaseNotes?.trim() || "請下載並安裝最新 APK。"
  };

  const { data, error } = await supabase
    .from("app_configs")
    .upsert(
      {
        key: DRIVER_APP_CONFIG_KEY,
        value,
        updated_at: new Date().toISOString()
      },
      { onConflict: "key" }
    )
    .select("key,value,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return normalize((data.value as DriverAppConfigValue | null) ?? null, data.updated_at ?? null);
}
