"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ImageItem = {
  url: string;
  label: string | null;
  mimeType: string | null;
};

type Point = { x: number; y: number };

type PinchRef = {
  startDistance: number;
  startScale: number;
  startMid: Point;
  startOffset: Point;
};

export function PhotoViewerModal({
  images,
  initialIndex = 0,
  onClose
}: {
  images: ImageItem[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const safeImages = useMemo(() => images.filter((item) => Boolean(item?.url)), [images]);
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, safeImages.length - 1)));
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragRef = useRef<{ start: Point; origin: Point } | null>(null);
  const pinchRef = useRef<PinchRef | null>(null);
  const touchesRef = useRef<Map<number, Point>>(new Map());

  useEffect(() => {
    setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, safeImages.length - 1)));
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [initialIndex, safeImages.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(safeImages.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, safeImages.length]);

  const current = safeImages[index];

  function clampScale(next: number) {
    return Math.min(4, Math.max(1, Number(next.toFixed(2))));
  }

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event: React.PointerEvent) {
    const point = { x: event.clientX, y: event.clientY };
    touchesRef.current.set(event.pointerId, point);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    const points = [...touchesRef.current.values()];
    if (points.length === 1 && scale > 1) {
      dragRef.current = { start: point, origin: offset };
    }

    if (points.length === 2) {
      dragRef.current = null;
      const [a, b] = points;
      pinchRef.current = {
        startDistance: distance(a, b),
        startScale: scale,
        startMid: midpoint(a, b),
        startOffset: offset
      };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!touchesRef.current.has(event.pointerId)) return;
    touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...touchesRef.current.values()];

    if (points.length === 2 && pinchRef.current) {
      const [a, b] = points;
      const currentDistance = distance(a, b);
      const currentMid = midpoint(a, b);
      setScale(clampScale((currentDistance / pinchRef.current.startDistance) * pinchRef.current.startScale));
      setOffset({
        x: pinchRef.current.startOffset.x + (currentMid.x - pinchRef.current.startMid.x),
        y: pinchRef.current.startOffset.y + (currentMid.y - pinchRef.current.startMid.y)
      });
      return;
    }

    if (points.length === 1 && dragRef.current) {
      const dx = event.clientX - dragRef.current.start.x;
      const dy = event.clientY - dragRef.current.start.y;
      setOffset({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    touchesRef.current.delete(event.pointerId);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {}

    const points = [...touchesRef.current.values()];
    if (points.length < 2) pinchRef.current = null;
    if (points.length === 0) {
      dragRef.current = null;
      if (scale <= 1) setOffset({ x: 0, y: 0 });
    }
  }

  if (!current) {
    return (
      <div className="photo-modal-backdrop" onClick={onClose}>
        <div className="photo-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="photo-modal-header">
            <button className="photo-modal-close" onClick={onClose} type="button" aria-label="關閉">✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div className="photo-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="photo-modal-header">
          <div className="photo-modal-title">{current.label ?? "訂單圖片"}</div>
          <button className="photo-modal-close" onClick={onClose} type="button" aria-label="關閉">✕</button>
        </div>

        <div className="photo-modal-stage">
          <img
            alt={current.label ?? "order image"}
            className={scale > 1 ? "photo-modal-image zoomed" : "photo-modal-image"}
            src={current.url}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            onDoubleClick={reset}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
