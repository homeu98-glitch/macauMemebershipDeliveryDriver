type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const firebaseAdminApp = require("firebase-admin/app") as {
  cert: (serviceAccount: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }) => unknown;
  getApps: () => unknown[];
  initializeApp: (options: { credential: unknown }) => unknown;
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

export function getFirebaseAdminApp() {
  const existing = firebaseAdminApp.getApps()[0];
  if (existing) {
    return existing;
  }

  const serviceAccount = parseServiceAccount();
  return firebaseAdminApp.initializeApp({
    credential: firebaseAdminApp.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}
