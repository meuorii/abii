"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useScrollRoot } from "./scroll-root-context";

type ObserverPool = { observer: IntersectionObserver; callbacks: Map<Element, () => void> };
const observerPools = new Map<Element | null, Map<number, ObserverPool>>();

function removePoolIfCurrent(root: Element | null, thresholds: Map<number, ObserverPool>, threshold: number, pool: ObserverPool) {
  if (observerPools.get(root) !== thresholds || thresholds.get(threshold) !== pool) return;
  thresholds.delete(threshold);
  if (thresholds.size === 0 && observerPools.get(root) === thresholds) observerPools.delete(root);
}

function observeOnce(element: Element, root: Element | null, threshold: number, onVisible: () => void) {
  let thresholds = observerPools.get(root);
  if (!thresholds) {
    thresholds = new Map();
    observerPools.set(root, thresholds);
  }
  let pool = thresholds.get(threshold);
  if (!pool) {
    const callbacks = new Map<Element, () => void>();
    const poolReference: { pool?: ObserverPool } = {};
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = callbacks.get(entry.target);
        if (!callback) continue;
        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
        callback();
      }
      if (callbacks.size === 0) {
        observer.disconnect();
        const registeredPool = poolReference.pool;
        if (registeredPool) removePoolIfCurrent(root, thresholds, threshold, registeredPool);
      }
    }, { root, threshold });
    pool = { observer, callbacks };
    poolReference.pool = pool;
    thresholds.set(threshold, pool);
  }

  const currentPool = pool;
  currentPool.callbacks.set(element, onVisible);
  try {
    currentPool.observer.observe(element);
  } catch (error) {
    currentPool.callbacks.delete(element);
    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect();
      removePoolIfCurrent(root, thresholds, threshold, currentPool);
    }
    throw error;
  }
  return () => {
    currentPool.callbacks.delete(element);
    currentPool.observer.unobserve(element);
    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect();
      removePoolIfCurrent(root, thresholds!, threshold, currentPool);
    }
  };
}

function useReveal(ref: React.RefObject<HTMLElement | null>, amount: number, disabled = false) {
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
    const viewport = root?.getBoundingClientRect() ?? {
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      left: 0,
    };
    const bounds = element.getBoundingClientRect();
    const initiallyVisible = bounds.bottom > viewport.top && bounds.top < viewport.bottom &&
      bounds.right > viewport.left && bounds.left < viewport.right;

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
      return observeOnce(element, root, {
        // Tall sections should reveal as soon as any useful portion enters view.
        threshold: bounds.height > viewport.bottom - viewport.top ? Math.min(amount, 0.01) : amount,
      }.threshold, () => {
        setSkipTransition(false);
        setVisible(true);
      });
    } catch {
      // Observation can fail in constrained/older browsers. Never leave content hidden.
      const thresholds = observerPools.get(root);
      if (thresholds && thresholds.size === 0 && observerPools.get(root) === thresholds) observerPools.delete(root);
      setVisible(true);
      setAnimateOnMount(false);
      setSkipTransition(true);
    }
  }, [amount, disabled, reduceMotion, ref, rootRef]);

  return { visible, animateOnMount, skipTransition };
}

type RevealPreset = "text" | "button" | "card" | "image";
const revealPresets: Record<RevealPreset, { distance: number; duration: number }> = {
  text: { distance: 16, duration: 0.48 },
  button: { distance: 10, duration: 0.4 },
  card: { distance: 18, duration: 0.5 },
  image: { distance: 20, duration: 0.62 },
};

type RevealProps = HTMLMotionProps<"div"> & { children: ReactNode; amount?: number; delay?: number; className?: string; preset?: RevealPreset };

export function ScrollReveal({ children, amount = 0.12, delay = 0, className = "", preset = "text", style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { visible, animateOnMount, skipTransition } = useReveal(ref, amount);
  const { distance, duration } = revealPresets[preset];
  const classes = ["abii-motion-reveal", className, animateOnMount ? "abii-scroll-enter" : ""].filter(Boolean).join(" ");
  return <m.div ref={ref} {...props} className={classes} style={animateOnMount ? { ...style, animationDelay: `${delay}s` } : style} initial={false}
    animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
    transition={animateOnMount || skipTransition ? { duration: 0 } : { duration, delay: visible ? delay : 0, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </m.div>;
}

type StaggerState = { stagger: number; visible?: boolean; animateOnMount?: boolean; skipTransition?: boolean };
const StaggerContext = createContext<StaggerState>({ stagger: 0.06 });

export function StaggerContainer({ children, stagger = 0.06, className = "", as = "div" }: {
  children: ReactNode;
  amount?: number;
  stagger?: number;
  className?: string;
  as?: "div" | "ol" | "ul";
}) {
  const Container = as === "ol" ? m.ol : as === "ul" ? m.ul : m.div;
  const ref = useRef<HTMLElement>(null);
  const { visible, animateOnMount, skipTransition } = useReveal(ref, 0.08);
  return <StaggerContext.Provider value={{ stagger, visible, animateOnMount, skipTransition }}>
    <Container ref={ref as never} className={`abii-motion-reveal ${className}`} initial={false} animate={{ opacity: 1 }}>
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
  const reduceMotion = useReducedMotion();
  const usesContainer = context.visible !== undefined;
  const individualReveal = useReveal(ref, 0.04, usesContainer);
  const visible = usesContainer ? context.visible! : individualReveal.visible;
  const animateOnMount = usesContainer ? context.animateOnMount! : individualReveal.animateOnMount;
  const skipTransition = usesContainer ? context.skipTransition! : individualReveal.skipTransition;
  const Item = as === "li" ? m.li : m.div;
  // Keep delays short and bounded. Every item observes its own viewport entry,
  // so a large grid does not launch animations for offscreen cards at once.
  const delay = Math.min(index % 4, 3) * context.stagger;
  const classes = ["abii-motion-reveal", "min-w-0", className, animateOnMount ? "abii-card-enter" : ""].filter(Boolean).join(" ");
  return <Item ref={ref as never} className={classes}
    style={animateOnMount && !reduceMotion ? { animationDelay: `${delay}s` } : undefined}
    initial={false}
    animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
    transition={animateOnMount || skipTransition ? { duration: 0 } : { duration: 0.5, delay: visible ? delay : 0, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </Item>;
}

export function AnimatedCard({ children, className = "", ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return <m.div {...props} className={className} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.16, ease: "easeOut" }}>{children}</m.div>;
}
