"use client";

import { m, useAnimationControls, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { useScrollRoot } from "./scroll-root-context";

type ObserverPool = { observer: IntersectionObserver; callbacks: Map<Element, () => void> };
const observerPools = new Map<Element | null, Map<string, ObserverPool>>();

function removePoolIfCurrent(root: Element | null, pools: Map<string, ObserverPool>, configKey: string, pool: ObserverPool) {
  if (observerPools.get(root) !== pools || pools.get(configKey) !== pool) return;
  pools.delete(configKey);
  if (pools.size === 0 && observerPools.get(root) === pools) observerPools.delete(root);
}

function observeOnce(element: Element, root: Element | null, threshold: number, rootMargin: string, onVisible: () => void) {
  let pools = observerPools.get(root);
  if (!pools) {
    pools = new Map();
    observerPools.set(root, pools);
  }
  const configKey = `${threshold}|${rootMargin}`;
  let pool = pools.get(configKey);
  if (!pool) {
    const callbacks = new Map<Element, () => void>();
    const poolReference: { pool?: ObserverPool } = {};
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < threshold) continue;
        const callback = callbacks.get(entry.target);
        if (!callback) continue;
        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
        callback();
      }
      if (callbacks.size === 0) {
        observer.disconnect();
        const registeredPool = poolReference.pool;
        if (registeredPool) removePoolIfCurrent(root, pools, configKey, registeredPool);
      }
    }, { root, threshold, rootMargin });
    pool = { observer, callbacks };
    poolReference.pool = pool;
    pools.set(configKey, pool);
  }

  const currentPool = pool;
  currentPool.callbacks.set(element, onVisible);
  try {
    currentPool.observer.observe(element);
  } catch (error) {
    currentPool.callbacks.delete(element);
    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect();
      removePoolIfCurrent(root, pools, configKey, currentPool);
    }
    throw error;
  }
  return () => {
    currentPool.callbacks.delete(element);
    currentPool.observer.unobserve(element);
    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect();
      removePoolIfCurrent(root, pools!, configKey, currentPool);
    }
  };
}

function resolveMargin(value: string, reference: number) {
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * reference;
  return Number.parseFloat(value) || 0;
}

function getEffectiveRootBounds(rootBounds: DOMRect, rootMargin: string) {
  const parts = rootMargin.trim().split(/\s+/);
  const [topValue, rightValue, bottomValue, leftValue] = parts.length === 1
    ? [parts[0], parts[0], parts[0], parts[0]]
    : parts.length === 2
      ? [parts[0], parts[1], parts[0], parts[1]]
      : parts.length === 3
        ? [parts[0], parts[1], parts[2], parts[1]]
        : parts;
  const width = rootBounds.right - rootBounds.left;
  const height = rootBounds.bottom - rootBounds.top;
  return {
    top: rootBounds.top - resolveMargin(topValue ?? "0px", width),
    right: rootBounds.right + resolveMargin(rightValue ?? "0px", width),
    bottom: rootBounds.bottom + resolveMargin(bottomValue ?? "0px", width),
    left: rootBounds.left - resolveMargin(leftValue ?? "0px", width),
    height,
  };
}

const revealEase = [0.22, 1, 0.36, 1] as const;
const scrollRootMargin = "0px 0px -10% 0px";

function useReveal(ref: React.RefObject<HTMLElement | null>, amount: number, distance: number, duration: number, delay: number, rootMargin = scrollRootMargin) {
  const rootRef = useScrollRoot();
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();

  useLayoutEffect(() => {
    const element = ref.current;
    const showImmediately = () => {
      controls.set({ opacity: 1, y: 0 });
    };
    if (!element || reduceMotion || typeof IntersectionObserver === "undefined") {
      showImmediately();
      return;
    }

    const root = rootRef?.current ?? null;
    const rootBounds = root?.getBoundingClientRect() ?? {
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      left: 0,
    };
    const viewport = getEffectiveRootBounds(rootBounds as DOMRect, rootMargin);
    const bounds = element.getBoundingClientRect();
    const viewportHeight = viewport.height;
    const effectiveThreshold = bounds.height > viewportHeight * 0.85 ? Math.min(amount, 0.08) : amount;
    const visibleHeight = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
    const visibleWidth = Math.max(0, Math.min(bounds.right, viewport.right) - Math.max(bounds.left, viewport.left));
    const visibleRatio = visibleHeight * visibleWidth / Math.max(1, bounds.height * bounds.width);
    const initiallyVisible = visibleRatio >= effectiveThreshold;
    const hidden = { opacity: 0, y: distance };
    const revealed = {
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: revealEase },
    };

    if (initiallyVisible) {
      // Motion controls make the hidden start explicit after hydration, so the
      // server-rendered fallback remains visible and the entrance still plays.
      controls.set(hidden);
      void controls.start(revealed);
      return;
    }

    controls.set(hidden);
    try {
      return observeOnce(element, root, effectiveThreshold, rootMargin, () => {
        void controls.start(revealed);
      });
    } catch {
      // Observation can fail in constrained/older browsers. Never leave content hidden.
      const pools = observerPools.get(root);
      if (pools && pools.size === 0 && observerPools.get(root) === pools) observerPools.delete(root);
      showImmediately();
    }
  }, [amount, controls, delay, distance, duration, reduceMotion, ref, rootMargin, rootRef]);

  return controls;
}

type RevealPreset = "text" | "button" | "card" | "image";
const revealPresets: Record<RevealPreset, { distance: number; duration: number }> = {
  text: { distance: 18, duration: 0.78 },
  button: { distance: 14, duration: 0.72 },
  card: { distance: 18, duration: 0.84 },
  image: { distance: 18, duration: 0.88 },
};

type RevealProps = HTMLMotionProps<"div"> & { children: ReactNode; amount?: number; delay?: number; className?: string; preset?: RevealPreset; rootMargin?: string };

export function ScrollReveal({ children, amount = 0.12, delay = 0, className = "", preset = "text", rootMargin, style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useReveal(ref, amount, revealPresets[preset].distance, revealPresets[preset].duration, delay, rootMargin);
  const classes = ["abii-motion-reveal", className].filter(Boolean).join(" ");
  return <m.div ref={ref} {...props} className={classes} style={style} initial={false} animate={controls}>
    {children}
  </m.div>;
}

type StaggerState = { stagger: number };
const StaggerContext = createContext<StaggerState>({ stagger: 0.12 });

export function StaggerContainer({ children, stagger = 0.12, className = "", as = "div" }: {
  children: ReactNode;
  amount?: number;
  stagger?: number;
  className?: string;
  as?: "div" | "ol" | "ul";
}) {
  const Container = as === "ol" ? m.ol : as === "ul" ? m.ul : m.div;
  return <StaggerContext.Provider value={{ stagger }}>
    <Container className={className} initial={false} animate={{ opacity: 1 }}>
      {children}
    </Container>
  </StaggerContext.Provider>;
}

export function StaggerItem({ children, className = "", index = 0, as = "div", style }: {
  children: ReactNode;
  className?: string;
  index?: number;
  as?: "div" | "li";
  style?: React.CSSProperties;
}) {
  const context = useContext(StaggerContext);
  const ref = useRef<HTMLElement>(null);
  const delay = Math.min(index % 3, 2) * context.stagger;
  const controls = useReveal(ref, 0.12, 16, 0.82, delay);
  const Item = as === "li" ? m.li : m.div;
  // Keep delays short and bounded. Every item observes its own viewport entry,
  // so a large grid does not launch animations for offscreen cards at once.
  const classes = ["min-w-0", className].filter(Boolean).join(" ");
  return <Item ref={ref as never} className={classes} style={style} initial={false} animate={controls}>
    {children}
  </Item>;
}

export function AnimatedCard({ children, className = "", ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return <m.div {...props} className={className} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.16, ease: "easeOut" }}>{children}</m.div>;
}
