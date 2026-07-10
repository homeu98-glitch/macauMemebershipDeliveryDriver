'use client';

import { useEffect, useState } from 'react';

export function LegalSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ disclaimer: '', serviceTerms: '', version: '1' });

  useEffect(() => {
    let active = true;
    fetch('/api/settings/legal')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setForm({
          disclaimer: data.disclaimer ?? '',
          serviceTerms: data.serviceTerms ?? '',
          version: data.version ?? '1'
        });
      })
      .catch(() => {
        if (!active) return;
        setMessage('載入條款設定失敗。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('save_failed');
      setMessage('已儲存條款與免責內容。');
    } catch {
      setMessage('儲存失敗，請稍後重試。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">服務條款與免責內容</h2>
        <p className="text-sm text-slate-500">這裡的內容會同步提供給車手 App：首頁 / 我的頁面的免責條款，以及登入後必讀的服務條款與隱私政策。</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">載入中…</p>
      ) : (
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>免責條款</span>
            <textarea
              className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              value={form.disclaimer}
              onChange={(e) => setForm((prev) => ({ ...prev, disclaimer: e.target.value }))}
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-700">
            <span>服務條款與隱私政策</span>
            <textarea
              className="min-h-[260px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              value={form.serviceTerms}
              onChange={(e) => setForm((prev) => ({ ...prev, serviceTerms: e.target.value }))}
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-700 max-w-xs">
            <span>條款版本</span>
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              value={form.version}
              onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
            />
          </label>

          <div className="flex items-center gap-3">
            <button className="btn-primary" type="button" disabled={saving} onClick={handleSave}>
              {saving ? '儲存中…' : '儲存內容'}
            </button>
            {message ? <span className="text-sm text-slate-500">{message}</span> : null}
          </div>
        </div>
      )}
    </section>
  );
}
