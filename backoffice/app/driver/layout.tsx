import type { Metadata } from "next";

import { DriverShell } from "@/components/driver-web/driver-shell";

export const metadata: Metadata = {
  title: "會員配送車手工作台",
  description: "Driver Web App for Macau Membership Delivery",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "車手工作台"
  }
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
