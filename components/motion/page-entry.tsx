"use client";

import { m, useAnimationControls, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { usePathname } from "next/navigation";
import { useLayoutEffect, type ReactNode } from "react";

type PageEntryProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition"> & {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  scale?: number;
};

/** Route-entry motion for above-the-fold page content; below-fold content uses ScrollReveal. */
export function PageEntry({ children, delay = 0, distance = 20, duration = 0.8, scale = 1, ...props }: PageEntryProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();

  useLayoutEffect(() => {
    if (reduceMotion) {
      controls.set({ opacity: 1, y: 0, scale: 1 });
      return;
    }

    controls.set({ opacity: 0, y: distance, scale });
    void controls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
    });

    return () => controls.stop();
  }, [controls, delay, distance, duration, pathname, reduceMotion, scale]);

  return (
    <m.div
      initial={false}
      animate={controls}
      {...props}
    >
      {children}
    </m.div>
  );
}
