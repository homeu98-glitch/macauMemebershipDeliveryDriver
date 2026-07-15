"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ImageItem = {
  url: string;
  label: string | null;
  mimeType: string | null;
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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointerRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

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

  function zoom(delta: number) {
    setScale((current) => {
      const next = clampScale(current + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(event: React.PointerEvent) {
    if (scale <= 1) return;
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const ref = pointerRef.current;
    if (!ref) return;
    const dx = event.clientX - ref.x;
    const dy = event.clientY - ref.y;
    setOffset({ x: ref.ox + dx, y: ref.oy + dy });
  }

  function onPointerUp(event: React.PointerEvent) {
    pointerRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {}
  }

  if (!current) {
    return (
      <div className="photo-modal-backdrop" onClick={onClose}>
        <div className="photo-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="photo-modal-header">
            <div className="photo-modal-title">圖片</div>
            <button className="photo-modal-close" onClick={onClose} type="button" aria-label="關閉">✕</button>
          </div>
          <div className="muted">沒有可顯示的圖片。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div className="photo-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="photo-modal-header">
          <div className="photo-modal-title">訂單圖片</div>
          <button className="photo-modal-close" onClick={onClose} type="button" aria-label="關閉">✕</button>
        </div>

        <div className="photo-modal-stage" onDoubleClick={reset}>
          <img
            alt={current.label ?? "order image"}
            className={scale > 1 ? "photo-modal-image zoomed" : "photo-modal-image"}
            src={current.url}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            draggable={false}
          />
        </div>

        <div className="photo-modal-footer">
          <div className="photo-modal-meta">
            <div className="photo-modal-counter">{index + 1} / {safeImages.length}</div>
            {current.label ? <div className="photo-modal-label">{current.label}</div> : <div className="photo-modal-label muted">無標籤</div>}
          </div>

          <div className="photo-modal-controls">
            <button className="photo-modal-btn" onClick={() => setIndex((c) => Math.max(0, c - 1))} disabled={index <= 0} type="button">上一張</button>
            <button className="photo-modal-btn" onClick={() => zoom(-0.5)} disabled={scale <= 1} type="button">縮小</button>
            <button className="photo-modal-btn" onClick={reset} disabled={scale === 1 && offset.x === 0 && offset.y === 0} type="button">重置</button>
            <button className="photo-modal-btn" onClick={() => zoom(0.5)} type="button">放大</button>
            <button className="photo-modal-btn" onClick={() => setIndex((c) => Math.min(safeImages.length - 1, c + 1))} disabled={index >= safeImages.length - 1} type="button">下一張</button>
          </div>

          <div className="photo-modal-hint muted">提示：雙擊圖片可重置；按 ESC 可關閉；放大後可拖曳。</div>
        </div>
      </div>
    </div>
  );
}
