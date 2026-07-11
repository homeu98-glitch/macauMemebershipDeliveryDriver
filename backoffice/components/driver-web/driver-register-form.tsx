"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function prettyFileName(file: File | null) {
  if (!file) return "尚未選擇";
  if (file.name.length <= 18) return file.name;
  return `${file.name.slice(0, 8)}...${file.name.slice(-8)}`;
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

  const uploadCount = useMemo(() => [selfie, macauId, drivingLicence].filter(Boolean).length, [selfie, macauId, drivingLicence]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selfie || !macauId || !drivingLicence) {
      setMessage("請上傳自拍照、澳門身份證與駕駛執照。");
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
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(payload.message ?? "提交註冊失敗。");
        return;
      }
      router.replace("/driver/pending");
    } catch {
      setMessage("提交註冊失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="driver-auth-card android-card stack gap-5">
      <div className="driver-brand-chip">車手註冊</div>
      <div className="stack gap-2">
        <h1 className="driver-screen-title">建立騎手帳號</h1>
        <p className="muted">填寫基本資料並上傳三張文件，送出後等待後台審核。審核通過後即可直接在網頁接單。</p>
      </div>

      <div className="android-soft-panel stack gap-1">
        <div className="driver-soft-label">上傳進度</div>
        <div className="driver-upload-progress">已完成 {uploadCount} / 3</div>
      </div>

      <form className="stack gap-4" onSubmit={onSubmit}>
        <label className="driver-field modern-field">
          <span>姓名</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="請輸入真實姓名" />
        </label>
        <label className="driver-field modern-field">
          <span>電話號碼</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 66668888" />
        </label>
        <label className="driver-field modern-field">
          <span>PIN</span>
          <input type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="請輸入 4 位數字" />
        </label>

        <div className="driver-upload-grid">
          <label className={selfie ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input accept="image/*" capture="user" type="file" onChange={(event) => setSelfie(event.target.files?.[0] ?? null)} hidden />
            <div className="driver-upload-title">自拍照</div>
            <div className="driver-upload-copy">請保持正面清晰可見</div>
            <div className="driver-upload-file">{prettyFileName(selfie)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>

          <label className={macauId ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input accept="image/*" capture="environment" type="file" onChange={(event) => setMacauId(event.target.files?.[0] ?? null)} hidden />
            <div className="driver-upload-title">澳門身份證</div>
            <div className="driver-upload-copy">請上傳完整正面照片</div>
            <div className="driver-upload-file">{prettyFileName(macauId)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>

          <label className={drivingLicence ? "driver-upload-card uploaded" : "driver-upload-card"}>
            <input accept="image/*" capture="environment" type="file" onChange={(event) => setDrivingLicence(event.target.files?.[0] ?? null)} hidden />
            <div className="driver-upload-title">駕駛執照</div>
            <div className="driver-upload-copy">請上傳有效的駕駛執照</div>
            <div className="driver-upload-file">{prettyFileName(drivingLicence)}</div>
            <span className="driver-upload-button">選擇圖片</span>
          </label>
        </div>

        {message ? <div className="error">{message}</div> : null}

        <button className="android-primary-btn" disabled={submitting} type="submit">
          {submitting ? "提交中..." : "提交審核"}
        </button>
      </form>
    </div>
  );
}
