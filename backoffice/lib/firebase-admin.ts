import { cert, getApps, initializeApp, App } from "firebase-admin/app";

type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function parseServiceAccount(): ServiceAccountShape {
  const inlineJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  const filePath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim();

  if (inlineJson) {
    return JSON.parse(inlineJson) as ServiceAccountShape;
  }

  if (filePath) {
    const { readFileSync } = require("fs") as typeof import("fs");
    return JSON.parse(readFileSync(filePath, "utf8")) as ServiceAccountShape;
  }

  throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is required.");
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const serviceAccount = parseServiceAccount();
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}
