import { getDriverAppDownloadConfig } from "../../lib/app-release-config";

export const metadata = {
  title: "澳門會員車手 下載",
  description: "Download the latest driver app APK."
};

export const dynamic = "force-dynamic";

export default async function ApkDownloadPage() {
  const current = await getDriverAppDownloadConfig().catch(() => null);

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
              <a className="btn btn-primary" href={current.apkUrl} target="_blank" rel="noreferrer">下載 APK</a>
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
