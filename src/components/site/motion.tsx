"use client";

// Client-only motion leaves for the preview site. Everything here collapses to a static
// render under prefers-reduced-motion.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

// Sections rise in as they enter the viewport: tells the reader where the next block starts.
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// Hero lines arrive in reading order on first paint.
export function HeroStagger({ children, className = "" }: { children: ReactNode[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// Nav sits transparent on the hero, then turns solid once the page scrolls.
export function ScrollNav({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));
  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,box-shadow] duration-300 ${
        solid ? "bg-[var(--c-bg)]/95 shadow-[0_1px_0_color-mix(in_oklab,var(--c-ink)_10%,transparent)] backdrop-blur" : "bg-transparent"
      }`}
    >
      {children}
    </header>
  );
}

// Photo drifts slightly slower than the page for depth.
export function ParallaxImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y, scale: 1.14 }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease }}
        className="size-full object-cover"
      />
    </div>
  );
}

export type Swatch = { name: string; color: string; ink: string };

// Painter-specific hero visual: a fan of paint chips that opens on load and lifts on hover.
export function SwatchFan({ swatches }: { swatches: Swatch[] }) {
  const reduce = useReducedMotion();
  const mid = (swatches.length - 1) / 2;
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-visible [perspective:1400px]" aria-hidden>
      {swatches.map((s, i) => {
        const offset = i - mid;
        return (
          <motion.div
            key={s.name}
            className="absolute inset-x-[24%] top-[8%] bottom-[8%] origin-[50%_90%] rounded-[var(--r)] shadow-[0_30px_60px_-20px_color-mix(in_oklab,var(--c-ink)_45%,transparent)]"
            style={{ backgroundColor: s.color, zIndex: i }}
            initial={reduce ? false : { rotate: 0, x: 0, rotateY: 0, opacity: 0, y: 40 }}
            animate={{ rotate: offset * 8, x: `${offset * 9}%`, rotateY: offset * -6, opacity: 1, y: 0 }}
            whileHover={reduce ? undefined : { y: -18, rotateX: 6, transition: { type: "spring", stiffness: 260, damping: 22 } }}
            transition={{ duration: 1.1, delay: 0.25 + i * 0.07, ease }}
          >
            <div className="absolute inset-x-0 bottom-0 rounded-b-[var(--r)] bg-[var(--c-bg)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--c-ink)]">{s.name}</p>
              <p className="font-mono text-xs uppercase text-[var(--c-muted)]">{s.color}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Big figures count up once, so the eye lands on them.
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const match = value.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!match || !inView || reduce) return;
    const [, pre, num, post] = match;
    const decimals = num.includes(".") ? num.split(".")[1].length : 0;
    const target = Number(num);
    // Years like 1985 shouldn't count from zero; start near the target instead.
    const from = target > 1000 ? target - 40 : 0;
    const controls = animate(from, target, {
      duration: 1.4,
      ease,
      onUpdate: (v) => setShown(`${pre}${v.toFixed(decimals)}${post}`),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match is derived from value
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {shown}
    </span>
  );
}

type Quote = { author: string; text: string; rating: number };

// One review at a time, large, auto-advancing; pauses while hovered.
export function ReviewCarousel({ items, starColor }: { items: Quote[]; starColor: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (items.length < 2 || paused || reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [items.length, paused, reduce]);

  const item = items[index];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="min-h-[14rem] md:min-h-[12rem]">
        <AnimatePresence mode="wait">
          <motion.figure
            key={index}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease }}
          >
            <p aria-label={`${item.rating} out of 5 stars`} style={{ color: starColor }} className="text-lg tracking-[0.2em]">
              {"★".repeat(Math.round(item.rating))}
            </p>
            <blockquote className="mt-5 line-clamp-4 font-[family-name:var(--f-heading)] text-2xl leading-snug font-semibold tracking-tight text-balance md:text-4xl">
              &ldquo;{item.text}&rdquo;
            </blockquote>
            <figcaption className="mt-6 text-[var(--c-muted)]">{item.author}, Google review</figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="mt-8 flex gap-2">
          {items.map((it, i) => (
            <button
              key={it.author + i}
              type="button"
              aria-label={`Show review ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-10 bg-[var(--c-accent)]" : "w-4 bg-[var(--c-ink)]/20"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
