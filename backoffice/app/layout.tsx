import type { Metadata } from "next";

import { RootFrame } from "../components/root-frame";
import { getSessionUser } from "../lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Membership Delivery Driver Backoffice",
  description:
    "Operations backoffice for rider approvals, orders, callbacks, and settings."
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
