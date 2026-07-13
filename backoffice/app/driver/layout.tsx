import type { Metadata, Viewport } from "next";

import { DriverShell } from "@/components/driver-web/driver-shell";

export const metadata: Metadata = {
  title: "澳門會員車手",
  description: "Driver Web App for Macau Membership Delivery",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "澳門會員車手"
  }
};

export const viewport: Viewport = {
  themeColor: "#f59e0b"
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
