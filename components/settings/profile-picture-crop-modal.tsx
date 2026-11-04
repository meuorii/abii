"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ImagePlus, Minus, Plus, RotateCcw } from "lucide-react";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { boundCrop, clamp, sourceCrop, wheelZoom, zoomAt, type CropState, type Point } from "./crop-geometry";
import { bindCropViewport } from "./crop-viewport";

const VIEW_SIZE = 320;
const MAX_FINAL_BYTES = 1024 * 1024;

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
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: CropState; midpoint: Point; distance: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [viewportSize, setViewportSize] = useState(VIEW_SIZE);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    setViewportNode(node);
  }, []);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropRef = useRef<CropState>({ zoom: 1, offset: { x: 0, y: 0 } });
  const wheelRef = useRef<(event: WheelEvent) => void>(() => {});

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const minDimension = Math.min(dimensions.width, dimensions.height);
  const baseScale = minDimension ? viewportSize / minDimension : 1;
  const renderedWidth = dimensions.width * baseScale;
  const renderedHeight = dimensions.height * baseScale;
  const maxX = Math.max(0, (renderedWidth * zoom - viewportSize) / 2);
  const maxY = Math.max(0, (renderedHeight * zoom - viewportSize) / 2);
  const boundedOffset = { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
  const transform = `translate(calc(-50% + ${boundedOffset.x}px), calc(-50% + ${boundedOffset.y}px)) scale(${zoom})`;

  const geometry = { width: dimensions.width, height: dimensions.height, viewport: viewportSize };
  useEffect(() => {
    const bounded = boundCrop(cropRef.current, { width: dimensions.width, height: dimensions.height, viewport: viewportSize });
    cropRef.current = bounded;
    setOffset(bounded.offset);
    pointers.current.clear(); gesture.current = null; setDragging(false);
  }, [dimensions.width, dimensions.height, viewportSize]);
  function commit(next: CropState) {
    const bounded = boundCrop(next, geometry);
    cropRef.current = bounded;
    setZoom(bounded.zoom); setOffset(bounded.offset);
  }
  function updateZoom(value: number) { commit(zoomAt(cropRef.current, value, { x: 0, y: 0 }, { x: 0, y: 0 }, geometry)); }
  function relative(point: Point) {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: point.x - rect.left - rect.width / 2, y: point.y - rect.top - rect.height / 2 };
  }
  function rebaseGesture() {
    const points = [...pointers.current.values()];
    if (!points.length) { gesture.current = null; setDragging(false); return; }
    const midpoint = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    gesture.current = { start: cropRef.current, midpoint: relative(midpoint), distance: points.length === 2 ? Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) : 0 };
    setDragging(true);
  }
  wheelRef.current = (event) => {
    if (busy || !dimensions.width || !imageRef.current?.naturalWidth) return;
    event.preventDefault();
    const anchor = relative({ x: event.clientX, y: event.clientY });
    commit(zoomAt(cropRef.current, wheelZoom(cropRef.current.zoom, event.deltaY, event.deltaMode, viewportSize), anchor, anchor, geometry));
    if (pointers.current.size) rebaseGesture();
  };

  useEffect(() => {
    if (!viewportNode) return;
    const handleWheel = (event: WheelEvent) => wheelRef.current(event);
    return bindCropViewport(viewportNode, handleWheel, setViewportSize);
  }, [viewportNode]);

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
    if (!dimensions.width || busy || pointers.current.size >= 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebaseGesture();
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current || busy) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()], start = gesture.current;
    const midpoint = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const distance = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0;
    commit(zoomAt(start.start, start.distance ? start.start.zoom * distance / start.distance : start.start.zoom, start.midpoint, relative(midpoint), geometry));
  }
  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    rebaseGesture();
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 24 : 8;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    commit({ ...cropRef.current, offset: { x: cropRef.current.offset.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: cropRef.current.offset.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) } });
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
    if (savingRef.current || !dimensions.width) return;
    savingRef.current = true; setBusy(true); setError("");
    try { await onSave(await blobToDataUrl(await exportCrop())); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this photo. Please try again."); }
    finally { savingRef.current = false; setBusy(false); }
  }

  const fitWidth = dimensions.width * baseScale;
  const fitHeight = dimensions.height * baseScale;
  const percentage = Math.round((zoom - 1) / 2 * 100);

  return <Modal open onClose={() => { if (!busy) onClose(); }} action="update" size="lg" title="Edit Profile Picture" description="Move and zoom your photo to get the perfect fit." busy={busy} footer={<><button type="button" disabled={busy} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy || !dimensions.width} onClick={() => void save()} className={modalPrimaryClass}><ModalButtonContent loading={busy} label="Save Photo" loadingLabel="Saving Photo…" /></button></>}>
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-start">
      <div className="min-w-0">
        <div ref={attachViewport} tabIndex={0} role="application" aria-label="Photo crop editor. Drag to reposition, pinch or scroll to zoom, or use arrow keys and the zoom controls." onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} className={`relative mx-auto aspect-square w-full max-w-[340px] touch-none select-none overflow-hidden rounded-2xl border border-[#F4DCE4] bg-[#FFF7F9] outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} src={objectUrl || undefined} alt="Selected photo to crop" draggable={false} onLoad={(event) => { setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); cropRef.current = { zoom: 1, offset: { x: 0, y: 0 } }; setZoom(1); setOffset({ x: 0, y: 0 }); setPreviewError(""); }} onError={() => { const message = "This image could not be decoded. Choose another JPG, PNG, or WebP file."; setError(message); setPreviewError(message); }} className="profile-crop-image pointer-events-none absolute left-1/2 top-1/2 max-w-none" style={{ width: fitWidth, height: fitHeight, transform }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[#18384D]/35" style={{ maskImage: "radial-gradient(circle at center, transparent 49.7%, black 50.2%)" }} />
            <div className="absolute inset-[1px] rounded-full border-2 border-white/95 shadow-[0_0_0_1px_rgba(24,56,77,.15)]" />
          </div>
          {!dimensions.width && <div className="absolute inset-0 grid place-items-center text-xs text-[#6E879A]"><ImagePlus className="mr-2 inline h-4 w-4" />Preparing photo…</div>}
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#557087]"><label htmlFor="profilePhotoZoom">Zoom</label><span>{zoom.toFixed(1)}×</span></div>
          <div className="flex items-center gap-3"><button type="button" aria-label="Zoom out" disabled={busy || zoom <= 1} onClick={() => updateZoom(zoom - 0.1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#F4DCE4] bg-white text-[#E9577D] disabled:opacity-40"><Minus className="h-4 w-4" /></button><input id="profilePhotoZoom" aria-label="Zoom" type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !dimensions.width} onChange={(event) => updateZoom(Number(event.target.value))} className="abii-volume-slider min-w-0 flex-1" style={{ "--volume-progress": `${percentage}%` } as React.CSSProperties} /><button type="button" aria-label="Zoom in" disabled={busy || zoom >= 3} onClick={() => updateZoom(zoom + 0.1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#F4DCE4] bg-white text-[#E9577D] disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>
          <p className="mt-2 text-[11px] text-[#8A7D84]">Scroll or pinch with two fingers to zoom. Drag to reposition, or use the arrow keys.</p>
        </div>
      </div>
      <section aria-labelledby="profile-preview-label" className="flex items-center gap-3 rounded-xl border border-[#F4DCE4] bg-[#FFF7F9] p-3 sm:flex-col sm:gap-2 sm:py-4">
        <div id="profile-preview-label" className="text-xs font-semibold text-[#18384D]">Profile Preview</div>
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-2 border-white bg-[#FFF0F4] shadow-[0_0_0_1px_#F4DCE4]">
          <canvas ref={previewCanvasRef} width={176} height={176} role="img" aria-label="Circular profile photo preview" className="h-full w-full rounded-full object-cover" />
          {!dimensions.width && !previewError && <span className="absolute inset-0 grid place-items-center px-1 text-center text-[10px] text-[#6E879A]">Loading preview…</span>}
          {previewError && <span role="alert" className="absolute inset-0 grid place-items-center bg-[#FFF7F9] px-2 text-center text-[10px] leading-4 text-[#A43E5C]">Preview unavailable</span>}
        </div>
        <button type="button" disabled={busy} onClick={() => { pointers.current.clear(); gesture.current = null; setDragging(false); commit({ zoom: 1, offset: { x: 0, y: 0 } }); setError(""); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#C65380] hover:bg-white disabled:opacity-50 sm:mt-1"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
      </section>
    </div>
    <p className="mt-3 text-[11px] text-[#6E879A]">Source: JPG, PNG, or WebP · up to 15 MB and 20 megapixels. Saved crop: square JPEG · up to 1 MB.</p>
    {(error || previewError) && <p role="alert" className="mt-3 rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-3.5 py-2.5 text-sm text-[#B84352]">{error || previewError}</p>}
  </Modal>;
}
