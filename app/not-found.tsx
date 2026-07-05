import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell auth-form-panel" style={{ padding: 24 }}>
      <div className="card login-card">
        <div className="card-header">
          <div>
            <div className="eyebrow">404</div>
            <h1 className="page-title">Page not found</h1>
            <p className="page-subtitle">
              The backoffice route you requested does not exist or is no longer
              available.
            </p>
          </div>
        </div>
        <Link className="btn btn-primary" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
