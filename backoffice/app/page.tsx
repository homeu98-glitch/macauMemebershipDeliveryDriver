import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth";

export default function HomePage() {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;

  redirect(session ? "/dashboard" : "/login");
}
