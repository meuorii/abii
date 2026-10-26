"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ImagePlus, Minus, Plus, RotateCcw } from "lucide-react";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";

const VIEW_SIZE = 320;
const MAX_FINAL_BYTES = 1024 * 1024;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function sourceCrop(width: number, height: number, zoom: number, offsetX: number, offsetY: number, viewportSize: number) {
  const shortSide = Math.min(width, height);
  const fitScale = viewportSize / shortSide;
  const size = shortSide / zoom;
  return {
    x: clamp((width - size) / 2 - offsetX / (fitScale * zoom), 0, width - size),
    y: clamp((height - size) / 2 - offsetY / (fitScale * zoom), 0, height - size),
    size,
  };
}

function drawSourceCrop(image: HTMLImageElement, context: CanvasRenderingContext2D, crop: { x: number; y: number; size: number }, outputSize: number) {
  context.clearRect(0, 0, outputSize, outputSize);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The edited photo could not be prepared."));
    reader.onerror = () => reject(new Error("The edited photo could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

export function ProfilePictureCropModal({ file, onClose, onSave }: { file: File; onClose: () => void; onSave: (image: string) => Promise<void> }) {
  const [objectUrl, setObjectUrl] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [viewportSize, setViewportSize] = useState(VIEW_SIZE);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(zoom);
  const updateZoomRef = useRef<(value: number) => void>(() => {});

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setViewportSize(entry.contentRect.width || VIEW_SIZE));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const minDimension = Math.min(dimensions.width, dimensions.height);
  const baseScale = minDimension ? viewportSize / minDimension : 1;
  const renderedWidth = dimensions.width * baseScale;
  const renderedHeight = dimensions.height * baseScale;
  const maxX = Math.max(0, (renderedWidth * zoom - viewportSize) / 2);
  const maxY = Math.max(0, (renderedHeight * zoom - viewportSize) / 2);
  const boundedOffset = { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
  const transform = `translate(calc(-50% + ${boundedOffset.x}px), calc(-50% + ${boundedOffset.y}px)) scale(${zoom})`;

  function updateZoom(value: number) {
    const nextZoom = clamp(value, 1, 3);
    zoomRef.current = nextZoom;
    const nextMaxX = Math.max(0, (renderedWidth * nextZoom - viewportSize) / 2);
    const nextMaxY = Math.max(0, (renderedHeight * nextZoom - viewportSize) / 2);
    setZoom(nextZoom);
    setOffset((current) => ({ x: clamp(current.x, -nextMaxX, nextMaxX), y: clamp(current.y, -nextMaxY, nextMaxY) }));
  }
  updateZoomRef.current = updateZoom;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (!imageRef.current?.naturalWidth) return;
      event.preventDefault();
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * viewportSize
          : event.deltaY;
      const normalizedSteps = clamp(delta / 100, -3, 3);
      if (!normalizedSteps) return;
      updateZoomRef.current(zoomRef.current * Math.pow(1.12, -normalizedSteps));
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [viewportSize]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = previewCanvasRef.current;
    if (!objectUrl || !image || !canvas || !image.naturalWidth || !dimensions.width) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        const crop = sourceCrop(dimensions.width, dimensions.height, zoom, boundedOffset.x, boundedOffset.y, viewportSize);
        drawSourceCrop(image, context, crop, canvas.width);
        setPreviewError("");
      } catch (cause) {
        if (process.env.NODE_ENV !== "production") console.error("Profile photo live preview could not be rendered.", cause);
        setPreviewError("The photo preview could not be rendered. Try resetting the crop or choosing the image again.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dimensions, zoom, boundedOffset.x, boundedOffset.y, viewportSize, objectUrl]);
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dimensions.width || busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: boundedOffset.x, offsetY: boundedOffset.y };
    setDragging(true);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({ x: clamp(drag.offsetX + event.clientX - drag.startX, -maxX, maxX), y: clamp(drag.offsetY + event.clientY - drag.startY, -maxY, maxY) });
  }
  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 24 : 8;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setOffset((current) => ({
      x: clamp(current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), -maxX, maxX),
      y: clamp(current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0), -maxY, maxY),
    }));
  }

  function exportCrop(): Promise<Blob> {
    const image = imageRef.current;
    if (!image || !image.naturalWidth || !image.naturalHeight) return Promise.reject(new Error("The selected image is not ready yet."));
    const crop = sourceCrop(dimensions.width, dimensions.height, zoom, boundedOffset.x, boundedOffset.y, viewportSize);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return Promise.reject(new Error("Your browser could not prepare the edited photo."));
    canvas.width = 512;
    canvas.height = 512;
    drawSourceCrop(image, context, crop, 512);
    const encode = (quality: number, size = 512) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)).then((blob) => {
      if (!blob || size === 512) return blob;
      const smaller = document.createElement("canvas"); smaller.width = size; smaller.height = size;
      const smallerContext = smaller.getContext("2d");
      if (!smallerContext) return null;
      smallerContext.drawImage(canvas, 0, 0, size, size);
      return new Promise<Blob | null>((resolve) => smaller.toBlob(resolve, "image/jpeg", quality));
    });
    return (async () => {
      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
        const blob = await encode(quality);
        if (blob && blob.size <= MAX_FINAL_BYTES) return blob;
      }
      for (const quality of [0.8, 0.65, 0.5]) {
        const blob = await encode(quality, 384);
        if (blob && blob.size <= MAX_FINAL_BYTES) return blob;
      }
      throw new Error("This photo could not be compressed below 1 MB. Try a simpler crop or another image.");
    })();
  }

  async function save() {
    if (busy || !dimensions.width) return;
    setBusy(true); setError("");
    try { await onSave(await blobToDataUrl(await exportCrop())); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this photo. Please try again."); }
    finally { setBusy(false); }
  }

  const fitWidth = dimensions.width * baseScale;
  const fitHeight = dimensions.height * baseScale;
  const percentage = Math.round((zoom - 1) / 2 * 100);

  return <Modal open onClose={() => { if (!busy) onClose(); }} action="update" size="lg" title="Edit Profile Picture" description="Move and zoom your photo to get the perfect fit." busy={busy} footer={<><button type="button" disabled={busy} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy || !dimensions.width} onClick={() => void save()} className={modalPrimaryClass}>{busy ? "Saving Photo…" : "Save Photo"}</button></>}>
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-start">
      <div className="min-w-0">
        <div ref={viewportRef} tabIndex={0} role="application" aria-label="Photo crop editor. Drag to reposition. Use arrow keys to adjust." onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} className={`relative mx-auto aspect-square w-full max-w-[340px] touch-none select-none overflow-hidden rounded-2xl border border-[#F4DCE4] bg-[#FFF7F9] outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} src={objectUrl || undefined} alt="Selected photo to crop" draggable={false} onLoad={(event) => { setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setOffset({ x: 0, y: 0 }); setPreviewError(""); }} onError={() => { const message = "This image could not be decoded. Choose another JPG, PNG, or WebP file."; setError(message); setPreviewError(message); }} className={`profile-crop-image pointer-events-none absolute left-1/2 top-1/2 max-w-none ${dragging ? "" : "profile-crop-image-rest"}`} style={{ width: fitWidth, height: fitHeight, transform }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[#18384D]/35" style={{ maskImage: "radial-gradient(circle at center, transparent 49.7%, black 50.2%)" }} />
            <div className="absolute inset-[1px] rounded-full border-2 border-white/95 shadow-[0_0_0_1px_rgba(24,56,77,.15)]" />
          </div>
          {!dimensions.width && <div className="absolute inset-0 grid place-items-center text-xs text-[#6E879A]"><ImagePlus className="mr-2 inline h-4 w-4" />Preparing photo…</div>}
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#557087]"><label htmlFor="profilePhotoZoom">Zoom</label><span>{zoom.toFixed(1)}×</span></div>
          <div className="flex items-center gap-3"><button type="button" aria-label="Zoom out" disabled={busy || zoom <= 1} onClick={() => updateZoom(zoom - 0.1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#F4DCE4] bg-white text-[#E9577D] disabled:opacity-40"><Minus className="h-4 w-4" /></button><input id="profilePhotoZoom" aria-label="Zoom" type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !dimensions.width} onChange={(event) => updateZoom(Number(event.target.value))} className="abii-volume-slider min-w-0 flex-1" style={{ "--volume-progress": `${percentage}%` } as React.CSSProperties} /><button type="button" aria-label="Zoom in" disabled={busy || zoom >= 3} onClick={() => updateZoom(zoom + 0.1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#F4DCE4] bg-white text-[#E9577D] disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>
          <p className="mt-2 text-[11px] text-[#8A7D84]">Drag the image or focus the crop area and use arrow keys.</p>
        </div>
      </div>
      <section aria-labelledby="profile-preview-label" className="flex items-center gap-3 rounded-xl border border-[#F4DCE4] bg-[#FFF7F9] p-3 sm:flex-col sm:gap-2 sm:py-4">
        <div id="profile-preview-label" className="text-xs font-semibold text-[#18384D]">Profile Preview</div>
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-2 border-white bg-[#FFF0F4] shadow-[0_0_0_1px_#F4DCE4]">
          <canvas ref={previewCanvasRef} width={176} height={176} role="img" aria-label="Circular profile photo preview" className="h-full w-full rounded-full object-cover" />
          {!dimensions.width && !previewError && <span className="absolute inset-0 grid place-items-center px-1 text-center text-[10px] text-[#6E879A]">Loading preview…</span>}
          {previewError && <span role="alert" className="absolute inset-0 grid place-items-center bg-[#FFF7F9] px-2 text-center text-[10px] leading-4 text-[#A43E5C]">Preview unavailable</span>}
        </div>
        <button type="button" disabled={busy} onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setError(""); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#C65380] hover:bg-white disabled:opacity-50 sm:mt-1"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
      </section>
    </div>
    <p className="mt-3 text-[11px] text-[#6E879A]">Source: JPG, PNG, or WebP · up to 15 MB and 20 megapixels. Saved crop: square JPEG · up to 1 MB.</p>
    {(error || previewError) && <p role="alert" className="mt-3 rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-3.5 py-2.5 text-sm text-[#B84352]">{error || previewError}</p>}
  </Modal>;
}
