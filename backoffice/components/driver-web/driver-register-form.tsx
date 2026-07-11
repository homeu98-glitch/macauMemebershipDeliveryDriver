"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="driver-auth-card card stack gap-4">
      <div className="stack gap-2">
        <h1 className="driver-screen-title">車手註冊</h1>
        <p className="muted">填寫基本資料並上傳三張文件，送出後等待後台審核。</p>
      </div>
      <form className="stack gap-4" onSubmit={onSubmit}>
        <label className="driver-field"><span>姓名</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="請輸入真實姓名" /></label>
        <label className="driver-field"><span>電話號碼</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 66668888" /></label>
        <label className="driver-field"><span>PIN</span><input type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="4 位數字" /></label>
        <label className="driver-field"><span>自拍照</span><input accept="image/*" capture="user" type="file" onChange={(event) => setSelfie(event.target.files?.[0] ?? null)} /></label>
        <label className="driver-field"><span>澳門身份證</span><input accept="image/*" capture="environment" type="file" onChange={(event) => setMacauId(event.target.files?.[0] ?? null)} /></label>
        <label className="driver-field"><span>駕駛執照</span><input accept="image/*" capture="environment" type="file" onChange={(event) => setDrivingLicence(event.target.files?.[0] ?? null)} /></label>
        {message ? <div className="error">{message}</div> : null}
        <button className="btn-primary" disabled={submitting} type="submit">{submitting ? "提交中..." : "提交審核"}</button>
      </form>
    </div>
  );
}
