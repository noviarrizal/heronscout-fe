/* eslint-disable @next/next/no-img-element -- lead photos come from arbitrary hosts */
import {
  ArrowUpRightIcon,
  BuildingsIcon,
  EnvelopeSimpleIcon,
  HouseIcon,
  HouseLineIcon,
  PaintBrushIcon,
  PaintRollerIcon,
  PhoneIcon,
  SprayBottleIcon,
  SquaresFourIcon,
  TreeIcon,
  WallIcon,
  WrenchIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Section, SiteSpec } from "@/lib/spec";
import { CountUp, HeroStagger, ParallaxImage, Reveal, ReviewCarousel, ScrollNav, SwatchFan, type Swatch } from "./motion";

type Spec = SiteSpec;
type Business = Spec["business"];
type Of<T extends Section["type"]> = Extract<Section, { type: T }>;
export type Img = { url: string; alt: string };

const wrap = "mx-auto w-full max-w-7xl px-5 md:px-10";
const display = "font-[family-name:var(--f-heading)] font-semibold tracking-[-0.025em] text-balance";
const muted = "text-[var(--c-muted)] leading-relaxed";
const button =
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[var(--r)] bg-[var(--c-accent)] px-6 py-3.5 font-semibold text-[var(--c-on-accent)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_var(--c-accent)] active:translate-y-0 active:scale-[0.98]";

// A weak review count reads as a weakness, not social proof.
const MIN_REVIEWS_TO_SHOW = 5;

const serviceIcon: Record<string, Icon> = {
  interior: PaintRollerIcon,
  exterior: HouseLineIcon,
  cabinets: SquaresFourIcon,
  wallpaper: WallIcon,
  repair: WrenchIcon,
  commercial: BuildingsIcon,
  deck: TreeIcon,
  roof: HouseIcon,
  spray: SprayBottleIcon,
  general: PaintBrushIcon,
};

function telHref(phone?: string) {
  return phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "#contact";
}

export function showRating(b: Business) {
  return !!b.rating && (b.reviewCount ?? 0) >= MIN_REVIEWS_TO_SHOW;
}

function CallButton({ label, business, className = "" }: { label: string; business: Business; className?: string }) {
  return (
    <a href={telHref(business.phone)} className={`${button} ${className}`}>
      <PhoneIcon weight="fill" className="size-4" />
      {label}
    </a>
  );
}

export function Nav({ spec, ctaLabel }: { spec: Spec; ctaLabel: string }) {
  const b = spec.business;
  return (
    <ScrollNav>
      <div className={`${wrap} flex h-16 items-center justify-between gap-4 md:h-20`}>
        <span className={`${display} truncate text-lg md:text-xl`}>{b.name}</span>
        <div className="flex items-center gap-6">
          {b.phone && (
            <a href={telHref(b.phone)} className="hidden text-sm font-semibold tabular-nums md:inline">
              {b.phone}
            </a>
          )}
          {/* Mobile gets the bottom call bar instead. */}
          <span className="hidden md:block">
            <CallButton label={ctaLabel} business={b} className="px-5 py-2.5 text-sm" />
          </span>
        </div>
      </div>
    </ScrollNav>
  );
}

// Trades get most leads from phones; keep the call one thumb away.
export function MobileCallBar({ spec, ctaLabel }: { spec: Spec; ctaLabel: string }) {
  if (!spec.business.phone) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-[var(--c-bg)]/95 p-3 backdrop-blur md:hidden">
      <CallButton label={ctaLabel} business={spec.business} className="w-full" />
    </div>
  );
}

function Hero({ s, spec, photo, swatches }: { s: Of<"hero">; spec: Spec; photo?: Img; swatches: Swatch[] }) {
  const b = spec.business;
  return (
    <section className="relative">
      <div className={`${wrap} grid min-h-[calc(100dvh-7rem)] items-center gap-12 pt-8 pb-16 md:grid-cols-12 md:gap-10 md:pt-6 md:pb-20`}>
        <HeroStagger className="md:col-span-7">
          {[
            s.eyebrow ? (
              <p key="e" className="mb-6 text-sm font-semibold text-[var(--c-accent)]">
                {s.eyebrow}
              </p>
            ) : null,
            <h1 key="h" className={`${display} text-5xl leading-[0.98] md:text-6xl lg:text-7xl`}>
              {s.headline}
            </h1>,
            <p key="p" className={`${muted} mt-7 max-w-lg text-lg md:text-xl`}>
              {s.subheadline}
            </p>,
            <div key="a" className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <CallButton label={s.ctaLabel} business={b} />
              {b.email && (
                <a href={`mailto:${b.email}`} className="group inline-flex items-center gap-2 font-semibold">
                  <EnvelopeSimpleIcon className="size-4" />
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                    Email instead
                  </span>
                </a>
              )}
            </div>,
          ].filter(Boolean)}
        </HeroStagger>
        <div className="md:col-span-5">
          {photo ? (
            <ParallaxImage src={photo.url} alt={photo.alt} className="aspect-[4/5] w-full rounded-[var(--r)]" />
          ) : (
            <SwatchFan swatches={swatches} />
          )}
        </div>
      </div>
    </section>
  );
}

// The about copy, set large: one confident paragraph reads as more premium than a block of text.
function Statement({ s, photo }: { s: Of<"about">; photo?: Img }) {
  const [first, ...rest] = s.body.split(/\n\n+/);
  return (
    <section className="py-20 md:py-32">
      <div className={`${wrap} grid gap-12 md:grid-cols-12 md:items-end`}>
        <Reveal className={photo ? "md:col-span-7" : "md:col-span-10"}>
          <h2 className="text-sm font-semibold text-[var(--c-muted)]">{s.title}</h2>
          <p className={`${display} mt-6 text-3xl leading-[1.15] font-medium md:text-[2.75rem]`}>{first}</p>
          {rest.map((p) => (
            <p key={p} className={`${muted} mt-6 max-w-2xl text-lg`}>
              {p}
            </p>
          ))}
        </Reveal>
        {photo && (
          <Reveal delay={0.15} className="md:col-span-5">
            <ParallaxImage src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full rounded-[var(--r)]" />
          </Reveal>
        )}
      </div>
    </section>
  );
}

function Trust({ s, business }: { s: Of<"trust">; business: Business }) {
  // Never advertise a thin review count, whatever the model wrote.
  const items = s.items.filter((i) => showRating(business) || !/review|rating|★/i.test(`${i.label} ${i.value}`));
  if (items.length < 2) return null;
  return (
    <section className={wrap}>
      <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 border-y border-[var(--c-ink)]/12 py-12 md:py-14 ${items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        {items.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.08} className="flex flex-col-reverse gap-2">
            <dt className="text-sm text-[var(--c-muted)]">{item.label}</dt>
            <dd className={`${display} text-4xl md:text-6xl`}>
              <CountUp value={item.value} />
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

function Services({ s }: { s: Of<"services"> }) {
  return (
    <section className="py-20 md:py-32">
      <div className={`${wrap} grid gap-12 md:grid-cols-12`}>
        <Reveal className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <h2 className={`${display} text-4xl md:text-5xl`}>{s.title}</h2>
            {s.intro && <p className={`${muted} mt-5 max-w-sm`}>{s.intro}</p>}
          </div>
        </Reveal>
        <div role="list" className="md:col-span-8">
          {s.items.map((item, i) => {
            const IconComponent = serviceIcon[item.icon ?? "general"] ?? PaintBrushIcon;
            return (
              <Reveal key={item.name} delay={i * 0.05}>
                <div role="listitem" className="group grid grid-cols-[auto_1fr_auto] items-start gap-5 border-t border-[var(--c-ink)]/12 py-8 transition-colors duration-300 last:border-b md:gap-8 md:py-10">
                  <span className="grid size-12 place-items-center rounded-[var(--r)] bg-[var(--c-surface)] text-[var(--c-ink)] transition-colors duration-300 group-hover:bg-[var(--c-accent)] group-hover:text-[var(--c-on-accent)]">
                    <IconComponent weight="duotone" className="size-6" />
                  </span>
                  <div>
                    <h3 className={`${display} text-2xl md:text-3xl`}>{item.name}</h3>
                    <p className={`${muted} mt-2 max-w-xl`}>{item.description}</p>
                  </div>
                  <ArrowUpRightIcon className="mt-2 size-6 text-[var(--c-muted)] transition duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[var(--c-accent)]" />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Gallery({ s, images }: { s: Of<"gallery">; images: Img[] }) {
  if (images.length < 3) return null;
  const shown = images.slice(0, 5);
  return (
    <section className="py-20 md:py-28">
      <div className={wrap}>
        <Reveal>
          <h2 className={`${display} text-4xl md:text-5xl`}>{s.title}</h2>
        </Reveal>
        <div className={`mt-12 grid grid-cols-2 gap-4 md:auto-rows-[240px] ${shown.length >= 5 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {shown.map((img, i) => (
            <Reveal key={img.url} delay={i * 0.06} className={i === 0 ? "col-span-2 md:row-span-2" : ""}>
              <div className="group size-full overflow-hidden rounded-[var(--r)]">
                <img
                  src={img.url}
                  alt={img.alt}
                  className="aspect-square size-full object-cover transition duration-700 group-hover:scale-105 md:aspect-auto"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews({ s, business }: { s: Of<"reviews">; business: Business }) {
  return (
    <section className="bg-[var(--c-surface)] py-20 md:py-32">
      <div className={`${wrap} grid gap-12 md:grid-cols-12`}>
        <Reveal className="md:col-span-4">
          <h2 className={`${display} text-4xl md:text-5xl`}>{s.title}</h2>
          {showRating(business) && (
            <p className="mt-6 flex items-baseline gap-3">
              <span className={`${display} text-6xl`}>{business.rating!.toFixed(1)}</span>
              <span className="text-[var(--c-muted)]">from {business.reviewCount} Google reviews</span>
            </p>
          )}
        </Reveal>
        <Reveal delay={0.1} className="md:col-span-8">
          <ReviewCarousel items={s.items} starColor="var(--c-accent)" />
        </Reveal>
      </div>
    </section>
  );
}

function Areas({ s }: { s: Of<"areas"> }) {
  // Duplicated once so the marquee loops seamlessly.
  const run = [...s.areas, ...s.areas];
  return (
    <section className="overflow-hidden bg-[var(--c-deep)] py-10 text-white md:py-14" aria-label={s.title}>
      <h2 className="sr-only">{s.title}</h2>
      <div className="marquee-track flex w-max items-center gap-10">
        {[...run, ...run].map((a, i) => (
          <span key={`${a}-${i}`} className={`${display} flex items-center gap-10 text-3xl whitespace-nowrap md:text-5xl`}>
            {a}
            <span aria-hidden className="size-3 rotate-45 bg-[var(--c-accent)]" />
          </span>
        ))}
      </div>
    </section>
  );
}

function Cta({ s, business, ctaLabel, photo }: { s: Of<"cta">; business: Business; ctaLabel: string; photo?: Img }) {
  return (
    <section id="contact" className="p-3 md:p-5">
      <div className="relative isolate overflow-hidden rounded-[var(--r)] bg-[var(--c-deep)] text-white">
        {photo && (
          <>
            <img src={photo.url} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-35" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--c-deep)] via-[var(--c-deep)]/80 to-transparent" />
          </>
        )}
        <div className={`${wrap} grid gap-12 py-20 md:grid-cols-12 md:items-end md:py-32`}>
          <Reveal className="md:col-span-7">
            <h2 className={`${display} text-4xl leading-[1.02] md:text-7xl`}>{s.headline}</h2>
            <p className="mt-6 max-w-lg text-lg text-white/75">{s.body}</p>
          </Reveal>
          <Reveal delay={0.12} className="flex flex-col gap-5 md:col-span-5 md:items-end">
            {business.phone && (
              <a href={telHref(business.phone)} className={`${display} text-3xl tabular-nums md:text-5xl`}>
                {business.phone}
              </a>
            )}
            <CallButton label={ctaLabel} business={business} />
            {business.email && (
              <a href={`mailto:${business.email}`} className="inline-flex items-center gap-2 text-white/75 hover:text-white">
                <EnvelopeSimpleIcon className="size-4" />
                {business.email}
              </a>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Footer({ business }: { business: Business }) {
  return (
    <footer className="py-10 text-sm text-[var(--c-muted)]">
      <div className={`${wrap} flex flex-col justify-between gap-2 sm:flex-row`}>
        <p className="font-semibold text-[var(--c-ink)]">{business.name}</p>
        <p>
          {business.category}, {business.city}
        </p>
      </div>
    </footer>
  );
}

export type Slots = { hero?: Img; statement?: Img; cta?: Img; gallery: Img[] };

export function SectionView({
  section,
  spec,
  ctaLabel,
  slots,
  swatches,
}: {
  section: Section;
  spec: Spec;
  ctaLabel: string;
  slots: Slots;
  swatches: Swatch[];
}) {
  switch (section.type) {
    case "hero":
      return <Hero s={section} spec={spec} photo={slots.hero} swatches={swatches} />;
    case "trust":
      return <Trust s={section} business={spec.business} />;
    case "services":
      return <Services s={section} />;
    case "about":
      return <Statement s={section} photo={slots.statement} />;
    case "reviews":
      return <Reviews s={section} business={spec.business} />;
    case "gallery":
      return <Gallery s={section} images={slots.gallery} />;
    case "areas":
      return <Areas s={section} />;
    case "cta":
      return <Cta s={section} business={spec.business} ctaLabel={ctaLabel} photo={slots.cta} />;
  }
}
