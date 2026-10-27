import type { Section, SiteSpec } from "@/lib/spec";
import { Footer, MobileCallBar, Nav, SectionView, type Img, type Slots } from "./sections";
import { paletteSwatches, themeClassName, themeStyle } from "./theme";

// Every photo the spec references, in order of importance, without repeats.
function photoSlots(spec: SiteSpec): Slots {
  const seen = new Set<string>();
  const pool: Img[] = [];
  const add = (img?: Img) => {
    if (img && !seen.has(img.url)) {
      seen.add(img.url);
      pool.push(img);
    }
  };
  for (const s of spec.sections) {
    if (s.type === "hero" || s.type === "about" || s.type === "services") add(s.image);
  }
  for (const s of spec.sections) if (s.type === "gallery") s.images.forEach(add);

  const [hero, statement, cta, ...rest] = pool;
  // Gallery only gets photos not already used above; with few photos it is dropped.
  return { hero, statement, cta, gallery: rest.length >= 3 ? rest : [] };
}

export function SiteRenderer({ spec }: { spec: SiteSpec }) {
  const hero = spec.sections.find((s) => s.type === "hero");
  // One label for the one action (call) everywhere on the page.
  const ctaLabel = hero?.type === "hero" ? hero.ctaLabel : "Call now";
  const slots = photoSlots(spec);

  // Reviews are quoted verbatim; only the first letter is capitalised for display.
  const sections = spec.sections.map((s): Section =>
    s.type === "reviews"
      ? { ...s, items: s.items.map((r) => ({ ...r, text: r.text.charAt(0).toUpperCase() + r.text.slice(1) })) }
      : s,
  );

  return (
    <div
      style={themeStyle(spec.theme)}
      className={`${themeClassName(spec.theme)} min-h-screen bg-[var(--c-bg)] pb-20 font-[family-name:var(--f-body)] text-[var(--c-ink)] antialiased selection:bg-[var(--c-accent)] selection:text-[var(--c-on-accent)] md:pb-0`}
    >
      <div className="bg-[var(--c-ink)] px-4 py-2 text-center text-xs text-white/75">
        Free preview made for {spec.business.name.replace(/\.$/, "")}. Not a live website.
      </div>
      <Nav spec={spec} ctaLabel={ctaLabel} />
      <main>
        {sections.map((section, i) => (
          <SectionView
            key={`${section.type}-${i}`}
            section={section}
            spec={spec}
            ctaLabel={ctaLabel}
            slots={slots}
            swatches={paletteSwatches(spec.theme)}
          />
        ))}
      </main>
      <Footer business={spec.business} />
      <MobileCallBar spec={spec} ctaLabel={ctaLabel} />
    </div>
  );
}
