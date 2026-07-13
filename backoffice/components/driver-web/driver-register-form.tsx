"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_COMPRESSED_BYTES = 200 * 1024; // 200KB
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024; // 12MB（避免極大檔案導致瀏覽器壓縮崩潰）

function formatKb(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function blobToFile(blob: Blob, fileName: string) {
  const safeName = fileName.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], safeName, { type: "image/jpeg" });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("toBlob_failed"));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressImageToMaxBytes(file: File, maxBytes: number) {
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error(`圖片太大（${formatKb(file.size)}），請改用較小的照片再試。`);
  }

  // 如果本身已經夠細，就不處理
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("讀取圖片失敗，請改用另一張照片再試。");

  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const maxDimension = 1600;
  let scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));

  // 先試一個比較穩定的 quality，再逐步降低 / 縮圖
  let quality = 0.82;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, quality).catch(() => null);
    if (!blob) break;

    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;

    if (blob.size <= maxBytes) {
      bitmap.close?.();
      return blobToFile(blob, file.name);
    }

    // 先降 quality，降到某個下限後再縮小尺寸
    if (quality > 0.45) {
      quality = Math.max(0.45, quality - 0.08);
    } else {
      scale = Math.max(0.3, scale * 0.85);
      quality = 0.72;
    }
  }

  bitmap.close?.();

  if (bestBlob) {
    const out = blobToFile(bestBlob, file.name);
    if (out.size > maxBytes) {
      throw new Error(`圖片壓縮後仍然過大（${formatKb(out.size)}），請改用較細的照片再試。`);
    }
    return out;
  }

  throw new Error("圖片壓縮失敗，請稍後再試。");
}

function prettyFileName(file: File | null) {
  if (!file) return "尚未選擇";
  const suffix = ` (${formatKb(file.size)})`;
  if (file.name.length <= 18) return file.name + suffix;
  return `${file.name.slice(0, 8)}...${file.name.slice(-8)}${suffix}`;
}

export function DriverRegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [macauId, setMacauId] = useState<File | null>(null);
  const [drivingLicence, setDrivingLicence] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState<{ selfie: boolean; macauId: boolean; drivingLicence: boolean }>({
    selfie: false,
    macauId: false,
    drivingLicence: false
  });

  const isBusy = submitting || compressing.selfie || compressing.macauId || compressing.drivingLicence;

  async function handleSelectFile(
    file: File | null | undefined,
    type: "selfie" | "macauId" | "drivingLicence",
    label: string,
    setter: (next: File | null) => void
  ) {
    if (!file) {
      setter(null);
      return;
    }
    setMessage(null);
    setCompressing((prev) => ({ ...prev, [type]: true }));
    try {
      const compressed = await compressImageToMaxBytes(file, MAX_COMPRESSED_BYTES);
      setter(compressed);
    } catch (error) {
      setter(null);
      setMessage(error instanceof Error ? error.message : `${label} 圖片處理失敗，請稍後再試。`);
    } finally {
      setCompressing((prev) => ({ ...prev, [type]: false }));
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selfie || !macauId || !drivingLicence) {
      setMessage("請上傳自拍照、澳門身份證與駕駛執照。");
      return;
    }
    if (compressing.selfie || compressing.macauId || compressing.drivingLicence) {
      setMessage("圖片正在壓縮中，請稍候。");
      return;
    }
    if (selfie.size > MAX_COMPRESSED_BYTES || macauId.size > MAX_COMPRESSED_BYTES || drivingLicence.size > MAX_COMPRESSED_BYTES) {
      setMessage("圖片壓縮後仍然過大，請改用較細的照片再試。");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("phone", phone);
      formData.append("pin", pin);
      formData.append("selfie", selfie);
      formData.append("macau_id", macauId);
      formData.append("driving_licence", drivingLicence);

      const response = await fetch("/api/driver/register", { method: "POST", body: formData });

      let payload: any = {};
      try {
        payload = await response.json();
      } catch {
        try {
          const raw = await response.text();
          payload = { message: raw };
        } catch {
          payload = {};
        }
      }

      if (!response.ok) {
        const serverMessage = String(payload?.message ?? "").trim();
        setMessage(serverMessage || `提交註冊失敗（${response.status}），請稍後再試。`);
        return;
      }
      router.replace("/driver/pending");
    } catch {
      setMessage("提交註冊失敗，可能是網路不穩。請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="driver-auth-card android-card stack gap-5">
      <div className="driver-brand-chip">騎手註冊</div>
      <h1 className="driver-screen-title">騎手註冊</h1>

      <form className="stack gap-4" onSubmit={onSubmit}>
        <label className="driver-field modern-field"><span>姓名</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="請輸入真實姓名" /></label>
        <label className="driver-field modern-field"><span>電話號碼</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 66668888" /></label>
        <label className="driver-field modern-field"><span>密碼（4 位數字）</span><input type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="請輸入 4 位數字" /></label>

        <div className="driver-upload-grid">
          <label className={selfie ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input
              accept="image/*"
              capture="user"
              type="file"
              onChange={(event) => void handleSelectFile(event.target.files?.[0] ?? null, "selfie", "自拍照", setSelfie)}
              hidden
            />
            <div className="driver-upload-title">上傳自拍照</div>
            <div className="driver-upload-copy">用於身份比對，請上傳清晰正面照片。</div>
            <div className="driver-upload-file">{compressing.selfie ? "壓縮中..." : prettyFileName(selfie)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>
          <label className={macauId ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input
              accept="image/*"
              capture="environment"
              type="file"
              onChange={(event) => void handleSelectFile(event.target.files?.[0] ?? null, "macauId", "澳門身份證", setMacauId)}
              hidden
            />
            <div className="driver-upload-title">上傳澳門身份證</div>
            <div className="driver-upload-copy">請上傳可清楚辨識資料的證件圖片。</div>
            <div className="driver-upload-file">{compressing.macauId ? "壓縮中..." : prettyFileName(macauId)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>
          <label className={drivingLicence ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input
              accept="image/*"
              capture="environment"
              type="file"
              onChange={(event) => void handleSelectFile(event.target.files?.[0] ?? null, "drivingLicence", "駕駛執照", setDrivingLicence)}
              hidden
            />
            <div className="driver-upload-title">上傳駕駛執照</div>
            <div className="driver-upload-copy">請上傳有效駕駛執照圖片。</div>
            <div className="driver-upload-file">{compressing.drivingLicence ? "壓縮中..." : prettyFileName(drivingLicence)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>
        </div>

        <div className="muted" style={{ fontSize: 12 }}>
          圖片會自動壓縮到每張最多 200KB。
        </div>

        {message ? <div className="error">{message}</div> : null}
        <button className="android-primary-btn" disabled={isBusy} type="submit">{isBusy ? "提交中..." : "提交審核"}</button>
      </form>
    </div>
  );
}
