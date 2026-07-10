import { getDriverAppDownloadConfig } from "../../lib/app-release-config";
import { createServiceRoleSupabaseClient } from "../../lib/supabase";

export const metadata = {
  title: "澳門會員車手 下載",
  description: "Download the latest driver app APK."
};

export const dynamic = "force-dynamic";

async function getActiveDriverAppReleaseDirect() {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_app_releases")
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0] as any;
  return {
    version: String(row.version),
    releaseNotes: String(row.release_notes ?? ""),
    apkUrl: String(row.apk_url),
  };
}

export default async function ApkDownloadPage() {
  const legacyConfig = await getDriverAppDownloadConfig().catch(() => null);
  const active = legacyConfig ? null : await getActiveDriverAppReleaseDirect().catch(() => null);
  const current = legacyConfig
    ? {
        version: legacyConfig.version,
        releaseNotes: legacyConfig.releaseNotes,
      }
    : active
      ? {
          version: active.version,
          releaseNotes: active.releaseNotes,
        }
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <section
        className="card"
        style={{
          width: "min(680px, 100%)",
          padding: "32px"
        }}
      >
        <div className="eyebrow">澳門會員配送系統</div>
        <h1 className="page-title">澳門會員車手</h1>
        <p className="page-subtitle">請按下面按鈕下載最新 APK 並安裝到 Android 手機。</p>

        {current ? (
          <>
            <div className="hint" style={{ marginTop: 20 }}>
              <strong>版本：</strong> {current.version}
              <br />
              <strong>更新說明：</strong> {current.releaseNotes || "-"}
            </div>

            <div className="btn-row" style={{ marginTop: 24 }}>
              <a className="btn btn-primary" href="/apkdownload/latest">下載 APK</a>
            </div>
          </>
        ) : (
          <div className="error" style={{ marginTop: 20 }}>APK 尚未設定，請稍後再試。</div>
        )}

        <div className="hint" style={{ marginTop: 18 }}>
          如果 Android 提示禁止安裝，請在瀏覽器或檔案管理器中允許安裝未知來源應用程式。
        </div>
      </section>
    </main>
  );
}
