"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m, useReducedMotion } from "motion/react";
import { Heart, Star } from "lucide-react";

type ConfettiShape = "paper" | "strip" | "circle" | "star" | "heart";
type Particle = {
  index: number;
  shape: ConfettiShape;
  color: string;
  width: number;
  height: number;
  left: number;
  top: number;
  drift: number;
  lift: number;
  fall: number;
  rotation: number;
  delay: number;
};

const colors = [
  "#FF6F96", "#FF6F96", "#FF6F96", "#E9577D", "#E9577D",
  "#FF9FBA", "#F5A6BD", "#B9A2F4", "#80D8B2", "#F4D477",
];

function randomFor(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function particleCount(viewportWidth: number) {
  if (viewportWidth < 640) return 48;
  if (viewportWidth < 1024) return 72;
  return 100;
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? "left" : "right";
    const shapeRoll = randomFor(index, 1);
    const shape: ConfettiShape = shapeRoll < 0.55 ? "paper"
      : shapeRoll < 0.75 ? "strip"
        : shapeRoll < 0.9 ? "circle"
          : shapeRoll < 0.95 ? "star" : "heart";
    const size = 6 + Math.round(randomFor(index, 2) * 6);
    const isAccent = shape === "star" || shape === "heart";
    const outward = randomFor(index, 3) < 0.2;
    const headsToCenter = (side === "left") !== outward;
    const direction = headsToCenter ? (side === "left" ? 1 : -1) : (side === "left" ? -1 : 1);

    return {
      index,
      shape,
      color: colors[Math.floor(randomFor(index, 4) * colors.length)],
      width: isAccent ? 14 : shape === "circle" ? size : shape === "strip" ? 5 + randomFor(index, 5) * 2 : size,
      height: isAccent ? 14 : shape === "circle" ? size : shape === "strip" ? 10 + randomFor(index, 6) * 7 : 7 + randomFor(index, 7) * 7,
      left: side === "left" ? 3 + randomFor(index, 8) * 17 : 80 + randomFor(index, 8) * 17,
      top: 48 + randomFor(index, 9) * 39,
      drift: direction * (8 + randomFor(index, 10) * 38),
      lift: 16 + randomFor(index, 11) * 38,
      fall: 34 + randomFor(index, 12) * 78,
      rotation: shape === "circle" ? (randomFor(index, 13) - 0.5) * 30 : (randomFor(index, 13) - 0.5) * 240,
      delay: 0.1 + randomFor(index, 14) * 0.15,
    };
  });
}

/** Full-viewport decorative bursts, mounted only for a newly completed session. */
export function QuizCompletionConfetti({ active }: { active: boolean }) {
  const reduceMotion = Boolean(useReducedMotion());
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || reduceMotionRef.current) return;

    setParticles(createParticles(particleCount(window.innerWidth)));
    setVisible(true);
    const timeout = window.setTimeout(() => {
      setVisible(false);
      setParticles([]);
    }, 3_300);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active || !visible || reduceMotion || particles.length === 0) return null;

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[40] overflow-hidden">
      {particles.map((particle) => (
        <m.span
          key={particle.index}
          className="pointer-events-none absolute block"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: particle.width,
            height: particle.height,
            borderRadius: particle.shape === "circle" ? "50%" : particle.shape === "paper" ? "2px" : undefined,
            backgroundColor: particle.shape === "star" || particle.shape === "heart" ? undefined : particle.color,
            color: particle.color,
          }}
          initial={{ opacity: 0, x: "0vw", y: "0vh", rotate: 0, scale: 0.68 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: ["0vw", `${particle.drift * 0.18}vw`, `${particle.drift * 0.62}vw`, `${particle.drift}vw`],
            y: ["0vh", `-${particle.lift}vh`, `${particle.fall * 0.36}vh`, `${particle.fall}vh`],
            rotate: [0, particle.rotation * 0.2, particle.rotation * 0.62, particle.rotation],
            scale: [0.68, 1, 1, 0.96],
          }}
          transition={{
            duration: 2.85,
            delay: particle.delay,
            times: [0, 0.18, 0.66, 1],
            ease: "easeInOut",
          }}
        >
          {particle.shape === "star" && <Star className="h-full w-full" fill="currentColor" strokeWidth={1.5} />}
          {particle.shape === "heart" && <Heart className="h-full w-full" fill="currentColor" strokeWidth={1.5} />}
        </m.span>
      ))}
    </div>,
    document.body,
  );
}
