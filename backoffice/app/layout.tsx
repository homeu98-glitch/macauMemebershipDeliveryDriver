import type { Metadata } from "next";

import { RootFrame } from "../components/root-frame";
import { getSessionUser } from "../lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Membership Delivery Driver Backoffice",
  description:
    "Operations backoffice for rider approvals, orders, callbacks, and settings.",
  icons: {
    icon: "/icons/driver-app-logo-v3-192.png",
    apple: "/icons/driver-app-logo-v3-192.png",
    shortcut: "/icons/driver-app-logo-v3-192.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootFrame user={getSessionUser()}>{children}</RootFrame>
      </body>
    </html>
  );
}
