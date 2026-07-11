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

  if (!data) return <div className="card">載入排行榜中...</div>;

  return (
    <div className="stack gap-4">
      <section className="card stack gap-2">
        <h1 className="driver-screen-title">本週排行榜</h1>
        <div className="muted">我的名次：{data.me.rank ?? '-'} · 完成 {data.me.completedCount} 單</div>
      </section>
      <section className="stack gap-3">
        {data.top.length === 0 ? <div className="card muted">本週暫無排行資料。</div> : data.top.map((item) => (
          <article className="card driver-inline-between" key={`${item.rank}-${item.name}`}>
            <div><strong>#{item.rank}</strong> {item.name}</div>
            <div>{item.completedCount} 單</div>
          </article>
        ))}
      </section>
    </div>
  );
}
