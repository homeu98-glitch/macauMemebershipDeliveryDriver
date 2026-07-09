"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  published: boolean;
};

type ListResponse =
  | { success: true; items: Announcement[] }
  | { success: false; message: string };

type CreateResponse =
  | { success: true; item: Announcement }
  | { success: false; message: string };

type ToggleResponse =
  | { success: true; item: Announcement }
  | { success: false; message: string };

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function AnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [items, setItems] = useState<Announcement[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/announcements");
      const json = (await res.json()) as ListResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "載入失敗。"
      );
      const payload = json as ListResponse;
      if (!payload.success) throw new Error(payload.message);
      setItems(payload.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, published })
      });
      const json = (await res.json()) as CreateResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "新增失敗。"
      );
      const payload = json as CreateResponse;
      if (!payload.success) throw new Error(payload.message);
      setTitle("");
      setContent("");
      setPublished(true);
      setMessage("已發布公告。")
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "新增失敗。"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(id: string, next: boolean) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/announcements/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next })
      });
      const json = (await res.json()) as ToggleResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "更新失敗。"
      );
      const payload = json as ToggleResponse;
      if (!payload.success) throw new Error(payload.message);
      setMessage(next ? "已上架公告。" : "已下架公告。")
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗。"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("確定刪除此公告？")) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message || "刪除失敗。"
      );
      setMessage("已刪除公告。")
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗。"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">公告發布</h2>
            <p className="muted">發布後會在車手 App 的「我的」頁面顯示。</p>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="hint">{message}</div> : null}

        <form className="list" onSubmit={onCreate}>
          <div className="field">
            <label>標題</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>內容</label>
            <input value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          <div className="list-item">
            <div>
              <strong>立即上架</strong>
              <div className="muted">若關閉，公告會先存為未發布。</div>
            </div>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={saving}>發布</button>
            <button className="btn btn-secondary" type="button" onClick={() => load()} disabled={loading || saving}>重新讀取</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">公告列表</h2>
            <p className="muted">可下架或刪除。</p>
          </div>
        </div>

        {loading ? <div className="muted">載入中…</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>狀態</th>
                <th>標題</th>
                <th>內容</th>
                <th>時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.published ? "已發布" : "未發布"}</td>
                    <td><span className="code">{a.title}</span></td>
                    <td>{a.content}</td>
                    <td>{formatDate(a.createdAt)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => togglePublish(a.id, !a.published)}>
                          {a.published ? "下架" : "上架"}
                        </button>
                        <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => deleteItem(a.id)}>
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="muted">暫無公告。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
