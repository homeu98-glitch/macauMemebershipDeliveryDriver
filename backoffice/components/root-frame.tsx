"use client";

import { usePathname } from "next/navigation";

import type { SessionUser } from "@/lib/auth";
import { AppShell } from "@/components/backoffice";

export function RootFrame({
  children,
  user
}: {
  children: React.ReactNode;
  user: SessionUser | null;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
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
