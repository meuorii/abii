export type Point = { x: number; y: number };
export type CropState = { zoom: number; offset: Point };
export type CropSize = { width: number; height: number; viewport: number };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function wheelZoom(zoom: number, deltaY: number, deltaMode: number, viewport: number) {
  const delta = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewport : deltaY;
  return clamp(zoom * Math.exp(-clamp(delta, -300, 300) * 0.0011), 1, 3);
}

export function boundCrop(state: CropState, size: CropSize): CropState {
  const zoom = clamp(state.zoom, 1, 3);
  const shortSide = Math.min(size.width, size.height);
  if (!shortSide || !size.viewport) return { zoom, offset: { x: 0, y: 0 } };
  const scale = size.viewport / shortSide;
  const maxX = Math.max(0, (size.width * scale * zoom - size.viewport) / 2);
  const maxY = Math.max(0, (size.height * scale * zoom - size.viewport) / 2);
  return { zoom, offset: { x: clamp(state.offset.x, -maxX, maxX), y: clamp(state.offset.y, -maxY, maxY) } };
}

/** Positions are relative to the viewport center. */
export function zoomAt(start: CropState, nextZoom: number, from: Point, to: Point, size: CropSize): CropState {
  const zoom = clamp(nextZoom, 1, 3);
  const ratio = zoom / start.zoom;
  return boundCrop({ zoom, offset: { x: to.x - (from.x - start.offset.x) * ratio, y: to.y - (from.y - start.offset.y) * ratio } }, size);
}

export function sourceCrop(width: number, height: number, zoom: number, offsetX: number, offsetY: number, viewportSize: number) {
  const shortSide = Math.min(width, height);
  const fitScale = viewportSize / shortSide;
  const size = shortSide / zoom;
  return { x: clamp((width - size) / 2 - offsetX / (fitScale * zoom), 0, width - size), y: clamp((height - size) / 2 - offsetY / (fitScale * zoom), 0, height - size), size };
}
