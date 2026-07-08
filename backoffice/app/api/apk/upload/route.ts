import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
          throw new Error("BLOB_READ_WRITE_TOKEN 尚未設定。請先在 Vercel Storage 建立 Blob store。");
        }

        if (!pathname.startsWith("driver-apk/")) {
          throw new Error("Invalid upload path.");
        }

        return {
          allowedContentTypes: [
            "application/vnd.android.package-archive",
            "application/octet-stream"
          ],
          tokenPayload: JSON.stringify({
            userId: user.id,
            userName: user.name
          })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.info("[apk] upload completed", {
          pathname: blob.pathname,
          url: blob.url,
          /* uploadedAt */
        });
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
