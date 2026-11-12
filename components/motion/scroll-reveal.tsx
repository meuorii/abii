"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

function useReveal(ref: React.RefObject<HTMLElement | null>, amount: number, disabled = false, rootMargin = "0px 0px -12% 0px") {
  const rootRef = useScrollRoot();
  const reduceMotion = useReducedMotion();
  // Start visible for server rendering. The layout effect hides offscreen content
  // before paint, while reduced-motion and observer-fallback paths stay visible.
  const [visible, setVisible] = useState(true);
  const [animateOnMount, setAnimateOnMount] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (disabled || !element || reduceMotion || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      setAnimateOnMount(false);
      setSkipTransition(true);
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

    if (initiallyVisible) {
      setVisible(true);
      setAnimateOnMount(true);
      setSkipTransition(false);
      return;
    }

    setVisible(false);
    setAnimateOnMount(false);
    // Hide below-the-fold server-rendered content before paint without an
    // unintended fade-out. The actual reveal below uses the normal transition.
    setSkipTransition(true);
    try {
      return observeOnce(element, root, effectiveThreshold, rootMargin, () => {
        setSkipTransition(false);
        setVisible(true);
      });
    } catch {
      // Observation can fail in constrained/older browsers. Never leave content hidden.
      const pools = observerPools.get(root);
      if (pools && pools.size === 0 && observerPools.get(root) === pools) observerPools.delete(root);
      setVisible(true);
      setAnimateOnMount(false);
      setSkipTransition(true);
    }
  }, [amount, disabled, reduceMotion, ref, rootMargin, rootRef]);

  return { visible, animateOnMount, skipTransition };
}

type RevealPreset = "text" | "button" | "card" | "image";
const revealPresets: Record<RevealPreset, { distance: number; duration: number }> = {
  text: { distance: 23, duration: 0.78 },
  button: { distance: 14, duration: 0.68 },
  card: { distance: 24, duration: 0.84 },
  image: { distance: 26, duration: 0.96 },
};

type RevealProps = HTMLMotionProps<"div"> & { children: ReactNode; amount?: number; delay?: number; className?: string; preset?: RevealPreset; rootMargin?: string };

export function ScrollReveal({ children, amount = 0.12, delay = 0, className = "", preset = "text", rootMargin, style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { visible, animateOnMount, skipTransition } = useReveal(ref, amount, false, rootMargin);
  const { distance, duration } = revealPresets[preset];
  const classes = ["abii-motion-reveal", className].filter(Boolean).join(" ");
  return <m.div ref={ref} {...props} className={classes} style={animateOnMount ? { ...style, animationDelay: `${delay}s` } : style} initial={false}
    animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
    transition={animateOnMount || skipTransition ? { duration: 0 } : { duration, delay: visible ? delay : 0, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </m.div>;
}

type StaggerState = { stagger: number };
const StaggerContext = createContext<StaggerState>({ stagger: 0.14 });

export function StaggerContainer({ children, stagger = 0.14, className = "", as = "div" }: {
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

export function StaggerItem({ children, className = "", index = 0, as = "div" }: {
  children: ReactNode;
  className?: string;
  index?: number;
  as?: "div" | "li";
}) {
  const context = useContext(StaggerContext);
  const ref = useRef<HTMLElement>(null);
  const { visible, animateOnMount, skipTransition } = useReveal(ref, 0.18);
  const Item = as === "li" ? m.li : m.div;
  // Keep delays short and bounded. Every item observes its own viewport entry,
  // so a large grid does not launch animations for offscreen cards at once.
  const delay = Math.min(index % 3, 2) * context.stagger;
  const classes = ["min-w-0", className].filter(Boolean).join(" ");
  return <Item ref={ref as never} className={classes}
    initial={false}
    animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
    transition={animateOnMount || skipTransition ? { duration: 0 } : { duration: 0.84, delay: visible ? delay : 0, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </Item>;
}

export function AnimatedCard({ children, className = "", ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return <m.div {...props} className={className} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.16, ease: "easeOut" }}>{children}</m.div>;
}
