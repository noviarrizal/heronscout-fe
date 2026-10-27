import type { Section } from "../../src/lib/spec";

export type Review = { author: string; text: string; rating: number };

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The model is told the rules; this enforces them. Anything it made up is dropped, not trusted.
export function enforceFacts(sections: Section[], images: string[], reviews: Review[]): Section[] {
  const allowed = new Set(images);
  const realReviews = reviews.map((r) => normalise(r.text));
  const keepImage = <T extends { image?: { url: string } }>(s: T): T =>
    s.image && !allowed.has(s.image.url) ? { ...s, image: undefined } : s;

  return sections.flatMap((s): Section[] => {
    switch (s.type) {
      case "hero":
      case "about":
        return [keepImage(s)];
      case "gallery": {
        const kept = s.images.filter((img) => allowed.has(img.url));
        return kept.length >= 3 ? [{ ...s, images: kept }] : [];
      }
      case "reviews": {
        const kept = s.items.filter((item) => {
          const text = normalise(item.text);
          return text.length > 10 && realReviews.some((real) => real.includes(text));
        });
        return kept.length ? [{ ...s, items: kept }] : [];
      }
      default:
        return [s];
    }
  });
}
