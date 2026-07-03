export const ENV_PLACEHOLDERS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "replace-with-your-anon-key",
  NEXT_PUBLIC_API_BASE_URL: "https://your-api.example.com",
  SUPABASE_SERVICE_ROLE_KEY: "replace-with-your-service-role-key",
  BACKOFFICE_SESSION_SECRET: "replace-with-a-long-random-session-secret",
  JWT_SHARED_SECRET: "replace-with-your-jwt-shared-secret"
} as const;

export type Metric = {
  label: string;
  value: string;
  change: string;
  tone: "default" | "positive" | "warning";
};

export type RiderApplication = {
  id: string;
  fullName: string;
  phone: string;
  zone: string;
  submittedAt: string;
  documentsComplete: boolean;
  vehicleType: string;
  status: "pending" | "approved" | "rejected";
};

export type Rider = {
  id: string;
  name: string;
  phone: string;
  zone: string;
  status: "online" | "offline" | "suspended";
  approval: "approved" | "pending" | "rejected";
  rating: number;
  completedOrders: number;
};

export type Order = {
  id: string;
  code: string;
  status: "new" | "assigned" | "picked_up" | "delivered" | "issue";
  customerName: string;
  storeName: string;
  riderName: string;
  amountMop: number;
  address: string;
  createdAt: string;
  etaMinutes: number;
  items: string[];
  timeline: { label: string; timestamp: string; note: string }[];
};

export type CallbackLog = {
  id: string;
  event: string;
  endpoint: string;
  status: "success" | "retrying" | "failed";
  responseCode: number;
  attempts: number;
  lastAttemptAt: string;
  summary: string;
};

export type SettingRow = {
  key: string;
  value: string;
  configured: boolean;
  description: string;
};

function isConfiguredValue(value: string | undefined, placeholder: string) {
  return Boolean(value && value.trim() && value !== placeholder);
}

export function getSettings(): SettingRow[] {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ENV_PLACEHOLDERS.NEXT_PUBLIC_API_BASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ENV_PLACEHOLDERS.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret =
    process.env.BACKOFFICE_SESSION_SECRET ??
    ENV_PLACEHOLDERS.BACKOFFICE_SESSION_SECRET;
  const jwtSharedSecret =
    process.env.JWT_SHARED_SECRET ?? ENV_PLACEHOLDERS.JWT_SHARED_SECRET;

  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      value: supabaseUrl,
      configured: isConfiguredValue(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL
      ),
      description: "Supabase project URL exposed to the backoffice frontend."
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: supabaseAnonKey,
      configured: isConfiguredValue(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      description: "前端可安全使用的 Supabase anon key。"
    },
    {
      key: "NEXT_PUBLIC_API_BASE_URL",
      value: apiBaseUrl,
      configured: isConfiguredValue(
        process.env.NEXT_PUBLIC_API_BASE_URL,
        ENV_PLACEHOLDERS.NEXT_PUBLIC_API_BASE_URL
      ),
      description: "主站 API 或 Edge Function 的基底網址。"
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      value: serviceRole ? "已設定" : "未設定",
      configured: isConfiguredValue(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        ENV_PLACEHOLDERS.SUPABASE_SERVICE_ROLE_KEY
      ),
      description: "僅供伺服器端使用的 Supabase 高權限金鑰。"
    },
    {
      key: "BACKOFFICE_SESSION_SECRET",
      value: sessionSecret ? "已設定" : "未設定",
      configured: isConfiguredValue(
        process.env.BACKOFFICE_SESSION_SECRET,
        ENV_PLACEHOLDERS.BACKOFFICE_SESSION_SECRET
      ),
      description: "用來簽署後台登入 cookie 的私密字串。"
    },
    {
      key: "JWT_SHARED_SECRET",
      value: jwtSharedSecret ? "已設定" : "未設定",
      configured: isConfiguredValue(
        process.env.JWT_SHARED_SECRET,
        ENV_PLACEHOLDERS.JWT_SHARED_SECRET
      ),
      description: "主站與回調重試功能共用的 JWT 簽章密鑰。"
    }
  ];
}

export function isSupabaseConfigured() {
  return getSettings()
    .filter((item) =>
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].includes(item.key)
    )
    .every((item) => item.configured);
}
