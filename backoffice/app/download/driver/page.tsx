import Link from "next/link";

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
          Tap the button below to download the latest Android APK for delivery riders.
        </p>

        <div className="btn-row" style={{ marginTop: 24 }}>
          <a className="btn btn-primary" href="/download/driver/latest">
            Download APK
          </a>
        </div>

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
