"use client";

import { usePathname } from "next/navigation";

import type { SessionUser } from "../lib/auth";
import { AppShell } from "./backoffice";

export function RootFrame({
  children,
  user
}: {
  children: React.ReactNode;
  user: SessionUser | null;
}) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname.startsWith("/download") || pathname.startsWith("/apkdownload")) {
    return <>{children}</>;
  }

  return (
    <AppShell
      user={
        user ?? {
          id: "anonymous",
          name: "未登入",
          email: "未登入",
          role: "guest"
        }
      }
    >
      {children}
    </AppShell>
  );
}
