"use client";

import { useEffect } from "react";

// Tells /api/view that someone opened this preview, then how long they stayed and how far they
// scrolled when they leave the tab. Opening any preview once with ?me marks this browser as yours,
// so your own checks are never counted.
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (new URLSearchParams(location.search).has("me")) localStorage.setItem("hs-me", "1");
    if (localStorage.getItem("hs-me")) return;

    const id = crypto.randomUUID();
    const start = Date.now();
    let depth = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      depth = Math.max(depth, max > 0 ? Math.round((scrollY / max) * 100) : 100);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const send = () =>
      navigator.sendBeacon("/api/view", JSON.stringify({ id, slug, seconds: (Date.now() - start) / 1000, depth }));
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };

    measure();
    send();
    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      cancelAnimationFrame(frame);
    };
  }, [slug]);
  return null;
}
