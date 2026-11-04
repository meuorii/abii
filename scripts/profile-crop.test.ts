import assert from "node:assert/strict";
import { test } from "node:test";
import { boundCrop, sourceCrop, wheelZoom, zoomAt } from "../components/settings/crop-geometry";
import { bindCropViewport } from "../components/settings/crop-viewport";

test("mounted viewport receives wheel and resize callbacks, cleans up and binds again", () => {
  const original = globalThis.ResizeObserver;
  let resize: ResizeObserverCallback | undefined;
  let observed = false, disconnected = false;
  class TestObserver {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() { observed = true; }
    unobserve() {}
    disconnect() { disconnected = true; }
  }
  globalThis.ResizeObserver = TestObserver as unknown as typeof ResizeObserver;
  try {
    const node = new EventTarget() as unknown as HTMLElement;
    Object.defineProperty(node, "clientWidth", { value: 278 });
    const widths: number[] = [];
    let wheels = 0;
    const handleWheel = (event: WheelEvent) => { wheels++; event.preventDefault(); };
    const unbind = bindCropViewport(node, handleWheel, width => widths.push(width));
    assert.equal(observed, true);
    assert.deepEqual(widths, [278]);
    resize?.([{ contentRect: { width: 260 } } as ResizeObserverEntry], {} as ResizeObserver);
    assert.deepEqual(widths, [278, 260]);
    const event = new Event("wheel", { cancelable: true });
    node.dispatchEvent(event);
    assert.equal(wheels, 1);
    assert.equal(event.defaultPrevented, true);
    unbind();
    assert.equal(disconnected, true);
    node.dispatchEvent(new Event("wheel"));
    assert.equal(wheels, 1);
    const unbindAgain = bindCropViewport(node, handleWheel, () => {});
    node.dispatchEvent(new Event("wheel"));
    assert.equal(wheels, 2);
    unbindAgain();
  } finally { globalThis.ResizeObserver = original; }
});

test("wheel deltas zoom in and out within limits", () => {
  assert.ok(wheelZoom(2, -100, 0, 320) > 2);
  assert.ok(wheelZoom(2, 100, 0, 320) < 2);
  assert.equal(wheelZoom(1, 100, 0, 320), 1);
  assert.equal(wheelZoom(3, -100, 0, 320), 3);
  assert.equal(wheelZoom(2, 1, 1, 320), wheelZoom(2, 16, 0, 320));
});

test("anchored zoom and moving pinch midpoint preserve the selected image point", () => {
  const size = { width: 800, height: 800, viewport: 320 };
  const start = { zoom: 2, offset: { x: 0, y: 0 } };
  const from = { x: 30, y: -25 }, to = { x: 45, y: -15 };
  const next = zoomAt(start, 2.5, from, to, size);
  assert.equal((from.x - start.offset.x) / start.zoom, (to.x - next.offset.x) / next.zoom);
  assert.equal((from.y - start.offset.y) / start.zoom, (to.y - next.offset.y) / next.zoom);
  assert.deepEqual(zoomAt(start, start.zoom, from, from, size), start);
});

test("zoom and offsets remain bounded for square, portrait and landscape crops", () => {
  for (const [width, height] of [[800, 800], [600, 1200], [1200, 600]]) {
    const geometry = { width, height, viewport: 320 };
    assert.equal(boundCrop({ zoom: 0.1, offset: { x: 0, y: 0 } }, geometry).zoom, 1);
    const state = boundCrop({ zoom: 9, offset: { x: 100000, y: -100000 } }, geometry);
    assert.equal(state.zoom, 3);
    const crop = sourceCrop(width, height, state.zoom, state.offset.x, state.offset.y, 320);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.size <= width && crop.y + crop.size <= height);
    assert.equal(sourceCrop(width, height, 1, 0, 0, 320).size, Math.min(width, height));
  }
});
