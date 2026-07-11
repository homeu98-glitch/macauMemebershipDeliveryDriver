"use client";

import { useEffect, useState } from "react";

type LeaderboardPayload = { top: Array<{ rank: number; name: string; completedCount: number }>; me: { rank: number | null; name: string; completedCount: number }; };

export function DriverLeaderboardClient() {
  const [data, setData] = useState<LeaderboardPayload | null>(null);

  useEffect(() => {
    fetch("/api/driver/leaderboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setData(payload as LeaderboardPayload))
      .catch(() => undefined);
  }, []);

  if (!data) return <div className="android-card">載入排行榜中...</div>;

  return (
    <div className="stack gap-4">
      <section className="android-summary-hero stack gap-3">
        <div className="driver-brand-chip">排行榜</div>
        <div className="driver-hero-heading">本週排名</div>
        <div className="driver-hero-note">我的名次：{data.me.rank ?? '-'} · 完成 {data.me.completedCount} 單</div>
      </section>
      <section className="stack gap-3">
        {data.top.length === 0 ? <div className="android-card muted">本週暫無排行資料。</div> : data.top.map((item) => (
          <article className="android-card driver-inline-between" key={`${item.rank}-${item.name}`}>
            <div><strong>#{item.rank}</strong> {item.name}</div>
            <div className="driver-amount">{item.completedCount} 單</div>
          </article>
        ))}
      </section>
    </div>
  );
}
