import crypto from "crypto";

const API_ISSUER = "membership-delivery-siteb";
const DEFAULT_AUDIENCE = "siteb-api";

type SiteBTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
};

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function getSharedSecret() {
  const secret = process.env.JWT_SHARED_SECRET ?? "";
  if (!secret.trim()) {
    throw new Error("JWT_SHARED_SECRET 尚未設定。");
  }
  return secret;
}

export function createSiteBApiToken(clientId: string, audience = DEFAULT_AUDIENCE) {
  const secret = getSharedSecret();
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload: SiteBTokenClaims = {
    iss: API_ISSUER,
    aud: audience,
    sub: clientId,
    iat: now,
    exp: now + 3600
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${encodedPayload}`)
    .digest("base64url");
  return {
    accessToken: `${header}.${encodedPayload}.${signature}`,
    tokenType: "Bearer",
    expiresIn: 3600
  };
}

export function readBearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) {
    return null;
  }
  return value.slice("Bearer ".length).trim();
}

export function verifySiteBApiToken(token: string, audience = DEFAULT_AUDIENCE) {
  const secret = getSharedSecret();
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (expected !== signature) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SiteBTokenClaims;
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.iss !== API_ISSUER ||
      claims.aud !== audience ||
      claims.exp <= now
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function requireSiteBApiAuth(request: Request, audience = DEFAULT_AUDIENCE) {
  const token = readBearerToken(request);
  if (!token) return null;
  return verifySiteBApiToken(token, audience);
}
