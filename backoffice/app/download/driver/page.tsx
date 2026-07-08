import Link from "next/link";

const apkVersion = process.env.DRIVER_APK_VERSION?.trim() || "Latest";
const releaseNotes = process.env.DRIVER_APK_RELEASE_NOTES?.trim() || "Install this build if you are a delivery rider.";
const configured = Boolean(process.env.DRIVER_APK_DOWNLOAD_URL?.trim());

export const metadata = {
  title: "Driver App Download",
  description: "Download the latest driver app APK."
};

export default function DriverDownloadPage() {
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
        <div className="eyebrow">Macau Membership Delivery</div>
        <h1 className="page-title">Driver app download</h1>
        <p className="page-subtitle">
          Use this page to download and install the latest Android APK for delivery riders.
        </p>

        <div className="hint" style={{ marginTop: 20 }}>
          <strong>Version:</strong> {apkVersion}
          <br />
          <strong>Notes:</strong> {releaseNotes}
        </div>

        {configured ? (
          <div className="btn-row" style={{ marginTop: 24 }}>
            <a className="btn btn-primary" href="/download/driver/latest">
              Download APK
            </a>
          </div>
        ) : (
          <div className="error" style={{ marginTop: 24 }}>
            DRIVER_APK_DOWNLOAD_URL is not configured yet. Set it in Vercel project environment variables.
          </div>
        )}

        <div className="hint" style={{ marginTop: 18 }}>
          If Android blocks installation, open the downloaded file and allow installation from this browser or file manager.
        </div>

        <p className="muted" style={{ marginTop: 18 }}>
          Need operations access instead? Return to <Link href="/login">backoffice login</Link>.
        </p>
      </section>
    </main>
  );
}
