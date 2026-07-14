"use client";

import macauDistrictGeoJson from "@/lib/data/macau-districts.geojson.json";

type DistrictFeature = {
  properties?: { nameCht?: string };
  geometry?: {
    type?: "Polygon" | "MultiPolygon";
    coordinates?: any;
  };
};

type Props = {
  counts: Record<string, number>;
  ridersByDistrict: Record<string, Array<{ id: string; name: string; lastCapturedAt: string }>>;
  unknown: number;
  unknownRiders: Array<{ id: string; name: string }>;
  totalOnline: number;
  recentMinutes: number;
  lastUpdatedAt: string | null;
};

type Point = { x: number; y: number };

type Shape = {
  name: string;
  path: string;
  labelPos: Point;
};

function flattenCoords(feature: DistrictFeature): Array<[number, number]> {
  const coords = feature.geometry?.coordinates;
  if (!coords) return [];
  if (feature.geometry?.type === "Polygon") return (coords?.[0] ?? []) as Array<[number, number]>;
  if (feature.geometry?.type === "MultiPolygon") return (coords?.[0]?.[0] ?? []) as Array<[number, number]>;
  return [];
}

function computeBBox(features: DistrictFeature[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of features) {
    const coords = flattenCoords(f);
    for (const [lng, lat] of coords) {
      if (lng < minX) minX = lng;
      if (lat < minY) minY = lat;
      if (lng > maxX) maxX = lng;
      if (lat > maxY) maxY = lat;
    }
  }
  return { minX, minY, maxX, maxY };
}

function project(lng: number, lat: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }, width: number, height: number) {
  const x = ((lng - bbox.minX) / (bbox.maxX - bbox.minX || 1)) * width;
  const y = (1 - (lat - bbox.minY) / (bbox.maxY - bbox.minY || 1)) * height;
  return { x, y };
}

function polygonToPath(ring: Array<[number, number]>, bbox: { minX: number; minY: number; maxX: number; maxY: number }, width: number, height: number) {
  if (!ring.length) return "";
  const [firstLng, firstLat] = ring[0];
  const first = project(firstLng, firstLat, bbox, width, height);
  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  for (let i = 1; i < ring.length; i += 1) {
    const [lng, lat] = ring[i];
    const p = project(lng, lat, bbox, width, height);
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  d += " Z";
  return d;
}

function buildShapes(width: number, height: number): Shape[] {
  const features = ((macauDistrictGeoJson as unknown as { features?: DistrictFeature[] }).features ?? []).filter(
    (f) => f?.properties?.nameCht && f?.geometry?.coordinates
  );
  const bbox = computeBBox(features);
  const shapes: Shape[] = [];

  for (const feature of features) {
    const name = feature.properties?.nameCht?.trim() ?? "";
    if (!name) continue;
    const type = feature.geometry?.type;
    const coords = feature.geometry?.coordinates;
    let path = "";
    let outerRing: Array<[number, number]> = [];

    if (type === "Polygon") {
      outerRing = (coords?.[0] ?? []) as Array<[number, number]>;
      path = polygonToPath(outerRing, bbox, width, height);
      const holes = (coords ?? []).slice(1) as Array<Array<[number, number]>>;
      for (const hole of holes) path += " " + polygonToPath(hole, bbox, width, height);
    } else if (type === "MultiPolygon") {
      const polys = coords as Array<any>;
      for (const poly of polys ?? []) {
        const ring = (poly?.[0] ?? []) as Array<[number, number]>;
        if (!outerRing.length) outerRing = ring;
        path += (path ? " " : "") + polygonToPath(ring, bbox, width, height);
        const holes = (poly ?? []).slice(1) as Array<Array<[number, number]>>;
        for (const hole of holes) path += " " + polygonToPath(hole, bbox, width, height);
      }
    }

    if (!path) continue;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of outerRing) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    const center = project((minLng + maxLng) / 2, (minLat + maxLat) / 2, bbox, width, height);
    shapes.push({ name, path, labelPos: center });
  }

  return shapes;
}

function tone(count: number) {
  if (count >= 6) return { fill: "#d4f4dd", stroke: "#1b7f3b" };
  if (count >= 3) return { fill: "#fff1c2", stroke: "#b26a00" };
  if (count >= 1) return { fill: "#e3ecff", stroke: "#2d5bd1" };
  return { fill: "#f1f1f1", stroke: "#bdbdbd" };
}

export function RiderDistrictMap(props: Props) {
  const width = 820;
  const height = 980;
  const shapes = buildShapes(width, height);
  const districtCards = Object.entries(props.ridersByDistrict)
    .map(([name, riders]) => ({ name, riders, count: props.counts[name] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"));

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">上線車手地區分佈</h2>
            <p className="muted">以最近 {props.recentMinutes} 分鐘內的最新定位統計。總上線：{props.totalOnline}，未能定位：{props.unknown}。</p>
            <p className="muted">最後更新時間：{props.lastUpdatedAt ?? "未有可用定位"}</p>
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 560, maxWidth: 980, height: "auto" }}>
            <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
            {shapes.map((shape) => {
              const count = props.counts[shape.name] ?? 0;
              const style = tone(count);
              return <path key={shape.name} d={shape.path} fill={style.fill} stroke={style.stroke} strokeWidth={1.2} fillRule="evenodd" />;
            })}
            {shapes.map((shape) => {
              const count = props.counts[shape.name] ?? 0;
              const { x, y } = shape.labelPos;
              return (
                <g key={`${shape.name}-label`}>
                  <circle cx={x} cy={y} r={16} fill="#111827" opacity={0.78} />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#ffffff">{count}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          註：如果車手沒有上報定位或定位不在澳門範圍內，會計入「未能定位」。
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">各區車手名單</h3>
            <p className="muted">列出每個區目前有哪些上線車手。</p>
          </div>
        </div>

        <div className="grid two-column">
          {districtCards.map((district) => (
            <section className="card" key={district.name} style={{ padding: 16 }}>
              <div className="driver-inline-between">
                <strong>{district.name}</strong>
                <span className="pill">{district.count} 人</span>
              </div>
              <div className="list" style={{ marginTop: 12 }}>
                {district.riders.length ? district.riders.map((rider) => (
                  <div className="list-item" key={rider.id}>
                    <div>
                      <strong>{rider.name}</strong>
                      <div className="muted">最後定位：{rider.lastCapturedAt}</div>
                    </div>
                  </div>
                )) : <div className="muted">目前此區沒有上線車手。</div>}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">未能定位車手</h3>
            <p className="muted">這些車手目前是上線狀態，但未有可用定位。</p>
          </div>
        </div>
        <div className="inline-pills">
          {props.unknownRiders.length ? props.unknownRiders.map((rider) => (
            <span className="pill" key={rider.id}>{rider.name}</span>
          )) : <span className="muted">全部上線車手都有定位。</span>}
        </div>
      </section>
    </div>
  );
}
