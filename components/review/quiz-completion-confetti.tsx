"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Heart, Star } from "lucide-react";

const colors = ["#FF6F96", "#FFC9D8", "#FF9FBA", "#A8E6CF", "#C9B8FF", "#FFE6A7", "#FFF7F9"];

function randomFor(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const particles = Array.from({ length: 44 }, (_, index) => {
  const side = index % 2 === 0 ? "left" : "right";
  const seed = randomFor(index, 1);
  const decorative = index % 13 === 0 ? "star" : index % 17 === 0 ? "heart" : null;
  const width = 4 + Math.round(randomFor(index, 2) * 4);
  const height = 5 + Math.round(randomFor(index, 3) * 7);

  return {
    index,
    side,
    decorative,
    color: colors[Math.floor(randomFor(index, 4) * colors.length)],
    width: decorative ? 10 : width,
    height: decorative ? 10 : height,
    left: side === "left" ? 5 + seed * 25 : 70 + seed * 25,
    top: 5 + randomFor(index, 5) * 23,
    drift: (side === "left" ? -1 : 1) * (22 + randomFor(index, 6) * 115),
    lift: 12 + randomFor(index, 7) * 38,
    fall: 95 + randomFor(index, 8) * 220,
    rotation: (randomFor(index, 9) - 0.5) * 250,
    delay: 0.2 + randomFor(index, 10) * 0.16,
  };
});

/** A finite, decorative burst shown only for a newly completed session. */
export function QuizCompletionConfetti({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setVisible(false), 2_400);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active || !visible || reduceMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {particles.map((particle) => {
        const iconClass = "h-full w-full";
        return (
          <m.span
            key={particle.index}
            className={`absolute block ${particle.index >= 36 ? "max-[1023px]:hidden" : ""} ${particle.index >= 24 ? "max-[639px]:hidden" : ""}`}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: particle.width,
              height: particle.height,
              borderRadius: particle.decorative ? undefined : particle.index % 3 === 0 ? "50%" : "2px",
              backgroundColor: particle.decorative ? undefined : particle.color,
              color: particle.color,
            }}
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.72 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, particle.drift * 0.2, particle.drift * 0.58, particle.drift],
              y: [0, -particle.lift, particle.fall * 0.44, particle.fall],
              rotate: [0, particle.rotation * 0.22, particle.rotation * 0.64, particle.rotation],
              scale: [0.72, 1, 1, 0.96],
            }}
            transition={{
              duration: 1.9,
              delay: particle.delay,
              times: [0, 0.16, 0.72, 1],
              ease: "easeInOut",
            }}
          >
            {particle.decorative === "star" && <Star className={iconClass} fill="currentColor" strokeWidth={1.5} />}
            {particle.decorative === "heart" && <Heart className={iconClass} fill="currentColor" strokeWidth={1.5} />}
          </m.span>
        );
      })}
    </div>
  );
}
