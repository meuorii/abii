/** Bind only to the mounted crop viewport and release everything when it changes. */
export function bindCropViewport(node: HTMLElement, onWheel: (event: WheelEvent) => void, onWidth: (width: number) => void) {
  node.addEventListener("wheel", onWheel, { passive: false });
  if (node.clientWidth > 0) onWidth(node.clientWidth);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(([entry]) => {
    if (entry.contentRect.width > 0) onWidth(entry.contentRect.width);
  });
  observer?.observe(node);
  return () => {
    node.removeEventListener("wheel", onWheel);
    observer?.disconnect();
  };
}
