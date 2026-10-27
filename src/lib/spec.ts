import { z } from "zod";

// The site spec is what the AI produces after researching a lead and its
// competitors. The AI only picks from curated palettes, type pairs and layout
// variants; code renders them, so it can't produce off-brand colours or broken HTML.

export const paletteIds = ["forest", "cobalt", "slate-rust", "olive-brick", "navy-sun", "mono-emerald"] as const;
export const typeIds = ["grotesk", "clean", "sturdy", "modern", "heritage"] as const;

export const themeSchema = z.object({
  palette: z.enum(paletteIds),
  type: z.enum(typeIds),
  radius: z.enum(["none", "sm", "lg"]),
});

const image = z.object({ url: z.url(), alt: z.string() });

const heroSection = z.object({
  type: z.literal("hero"),
  // "banner" needs an image; without one it renders as "split".
  variant: z.enum(["split", "banner"]),
  eyebrow: z.string().optional(),
  headline: z.string(),
  subheadline: z.string(),
  ctaLabel: z.string(),
  image: image.optional(),
});

const trustSection = z.object({
  type: z.literal("trust"),
  items: z.array(z.object({ value: z.string(), label: z.string() })).min(2).max(4),
});

export const serviceIcons = ["interior", "exterior", "cabinets", "wallpaper", "repair", "commercial", "deck", "roof", "spray", "general"] as const;

const servicesSection = z.object({
  type: z.literal("services"),
  // "photo" needs an image; without one it renders as "columns".
  variant: z.enum(["bento", "columns", "photo"]),
  title: z.string(),
  intro: z.string().optional(),
  items: z
    .array(z.object({ name: z.string(), description: z.string(), icon: z.enum(serviceIcons).optional() }))
    .min(2)
    .max(6),
  image: image.optional(),
});

const aboutSection = z.object({
  type: z.literal("about"),
  variant: z.enum(["plain", "withImage"]),
  title: z.string(),
  body: z.string(),
  image: image.optional(),
});

const reviewsSection = z.object({
  type: z.literal("reviews"),
  variant: z.enum(["spotlight", "wall"]),
  title: z.string(),
  items: z
    .array(z.object({ author: z.string(), text: z.string(), rating: z.number().min(1).max(5) }))
    .min(1)
    .max(6),
});

const gallerySection = z.object({
  type: z.literal("gallery"),
  variant: z.enum(["mosaic", "strip"]),
  title: z.string(),
  images: z.array(image).min(3).max(8),
});

const areasSection = z.object({
  type: z.literal("areas"),
  title: z.string(),
  areas: z.array(z.string()).min(1).max(16),
});

const ctaSection = z.object({
  type: z.literal("cta"),
  headline: z.string(),
  body: z.string(),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSection,
  trustSection,
  servicesSection,
  aboutSection,
  reviewsSection,
  gallerySection,
  areasSection,
  ctaSection,
]);

export const siteSpecSchema = z.object({
  business: z.object({
    name: z.string(),
    category: z.string(),
    city: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
  }),
  theme: themeSchema,
  sections: z.array(sectionSchema).min(3),
});

// Em/en dashes and dot-separated eyebrows are the most recognisable AI-copy tells; rewrite them everywhere.
export function sanitizeCopy<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\s*[—–]\s*/g, (m) => (m.trim() === m ? "-" : ", "))
      .replace(/\s+·\s+/g, ", ") as T;
  }
  if (Array.isArray(value)) return value.map(sanitizeCopy) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, k === "url" ? v : sanitizeCopy(v)]),
    ) as T;
  }
  return value;
}

export type SiteSpec = z.infer<typeof siteSpecSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Theme = z.infer<typeof themeSchema>;
