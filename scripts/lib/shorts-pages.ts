// Pages and in-page scripts for `pnpm shorts`: the hook card, a dated "before" site,
// the caption/scroll driver injected into the preview, and the closing card.
import type { Section, SiteSpec } from "../../src/lib/spec";

export type ShortCopy = {
  kicker: string;
  // Big line on the first card. Must stay true for the "before" page, so no invented numbers.
  hook: string;
  subject: string;
  before: string;
  outroTitle: string;
  outroCta: string;
  // Shown on the closing card and in the description: the businesses are fictional.
  note: string;
  hashtags: string[];
  labels: Partial<Record<Section["type"], string>>;
};

// Each caption says why the section matters to a customer (the viewer can already see what it is),
// so it stays true for any preview.
const defaultLabels: ShortCopy["labels"] = {
  hero: "Callers find the number without hunting",
  trust: "Proof they're good before anyone calls",
  services: "Nobody has to guess what they do",
  about: "People hire people they can picture",
  reviews: "Past customers do the selling",
  gallery: "Finished jobs say more than promises",
  areas: "Locals can see they're covered",
  cta: "Asking for a quote takes one tap",
};

// A fixture can override any line with a "short" object next to the spec.
export function shortCopy(spec: SiteSpec, override: Partial<ShortCopy> = {}): ShortCopy {
  const { category, city } = spec.business;
  const trade = `#${category.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]/g, "")}`;
  return {
    kicker: "Concept makeover",
    hook: "Looks fine on a laptop. Broken on phones.",
    subject: `${category}, ${city}`,
    before: "Tiny text, no call button, not built for phones",
    outroTitle: "Same business. New website.",
    outroCta: "Comment your trade + city for a free preview",
    note: "Concept for a fictional business",
    hashtags: ["#shorts", "#webdesign", "#smallbusiness", trade, "#beforeandafter"],
    ...override,
    labels: { ...defaultLabels, ...override.labels },
  };
}

// Title, description and hashtags to paste into YouTube Shorts / TikTok / Reels.
export function shortMeta(spec: SiteSpec, copy: ShortCopy) {
  const { category, city } = spec.business;
  const title = `${category} website makeover (concept), ${city}`;
  const credit = JSON.stringify(spec.sections).includes("images.pexels.com") ? " Photos from Pexels." : "";
  const description = [
    `${copy.hook} A concept makeover for a fictional ${category.toLowerCase()} in ${city}: the "before" is a typical older small-business site, the "after" is built for phones, with a call button up top and the Google rating on show.`,
    "",
    "Run a trade business? Comment your trade + city and I'll build you a free preview of a new site.",
    "",
    `${copy.note}.${credit}`,
    "",
    copy.hashtags.join(" "),
  ].join("\n");
  return `TITLE
${title}

DESCRIPTION
${description}

PINNED COMMENT
What's your trade and city? I'll pick a few and build free previews.
`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fonts =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@500;600&display=block" rel="stylesheet">';

const cardCss = `
  *{box-sizing:border-box;margin:0}
  html,body{height:100%}
  body{background:#f2f0ea;color:#151515;font-family:Figtree,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 34px}
  h1{font:800 46px/1.02 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-0.02em}
  .kicker{font-weight:600;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#6b6760;margin-bottom:22px}
  .rise{opacity:0;transform:translateY(22px)}
  .go .rise{animation:rise .7s cubic-bezier(.16,1,.3,1) forwards}
  .go .rise:nth-child(2){animation-delay:.12s}
  .go .rise:nth-child(3){animation-delay:.32s}
  .go .rise:nth-child(4){animation-delay:.5s}
  @keyframes rise{to{opacity:1;transform:none}}
  .creep{animation:creep 6s linear both}
  @keyframes creep{to{transform:scale(1.05)}}
`;

// Logs when a sound should play (an element with data-cue starts animating, or a caption appears);
// `pnpm shorts` reads window.__hsCues after recording and places the pops and chimes there.
const cueHelper = `window.__hsCue=(kind)=>(window.__hsCues||(window.__hsCues=[])).push({kind,t:performance.timeOrigin+performance.now()});`;

// Animations wait for the web fonts, so the first frames never show a fallback face.
const startWhenFontsReady = `<script>${cueHelper}
  addEventListener("animationstart",(e)=>e.target.dataset.cue&&e.animationName==="rise"&&__hsCue(e.target.dataset.cue));
  document.fonts.ready.then(()=>document.body.classList.add("go"))</script>`;

export function hookPage(copy: ShortCopy) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${cardCss}
    h1{font-size:42px}
    .subject{margin-top:26px;font-size:19px;font-weight:600;color:#4a4740}
    .split{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:22px;font-weight:600}
    .was{color:#8a857c;text-decoration:line-through;text-decoration-thickness:2px}
    .now{background:#151515;color:#f2f0ea;border-radius:999px;padding:8px 18px}
  </style></head><body>
    <div class="creep">
      <p class="kicker rise">${esc(copy.kicker)}</p>
      <h1 class="rise" data-cue="pop">${esc(copy.hook)}</h1>
      <div class="rise"><p class="subject">${esc(copy.subject)}</p><div class="split"><span class="was">Before</span><span>&rarr;</span><span class="now">After</span></div></div>
    </div>
    ${startWhenFontsReady}
  </body></html>`;
}

export function outroPage(copy: ShortCopy) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${cardCss}
    .cta{display:inline-block;margin-top:34px;background:#151515;color:#f2f0ea;border-radius:18px;padding:14px 20px;font-size:20px;line-height:1.3;font-weight:600}
    .note{position:fixed;left:34px;right:34px;bottom:40px;font-size:13px;color:#8a857c}
  </style></head><body>
    <div class="creep">
      <p class="kicker rise">${esc(copy.kicker)}</p>
      <h1 class="rise" data-cue="pop">${esc(copy.outroTitle)}</h1>
      <p class="rise" data-cue="chime"><span class="cta">${esc(copy.outroCta)}</span></p>
    </div>
    <p class="note">${esc(copy.note)}</p>
    ${startWhenFontsReady}
  </body></html>`;
}

// A plausible early-2010s small-business site built from the same (fictional) business.
// It is drawn 980px wide and zoomed down to phone width, the way a phone shows a site
// without a mobile layout, while the captions on top stay readable.
export function beforePage(spec: SiteSpec) {
  const b = spec.business;
  const hero = spec.sections.find((s) => s.type === "hero");
  const about = spec.sections.find((s) => s.type === "about");
  const services = spec.sections.find((s) => s.type === "services");
  const areas = spec.sections.find((s) => s.type === "areas");
  const name = esc(b.name.replace(/\.$/, ""));
  const intro = hero?.type === "hero" ? esc(hero.subheadline) : "";
  const aboutText = about?.type === "about" ? esc(about.body) : "";
  const serviceItems = services?.type === "services" ? services.items.map((s) => `<li>${esc(s.name)}</li>`).join("") : "";
  const areaText = areas?.type === "areas" ? esc(areas.areas.join(", ")) : esc(b.city);
  const phone = esc(b.phone ?? "");
  const reviews = spec.sections.find((s) => s.type === "reviews");
  const quotes =
    reviews?.type === "reviews"
      ? reviews.items.map((r) => `<p class="quote">"${esc(r.text)}"<br>- ${esc(r.author)}</p>`).join("")
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>
    body{margin:0;background:#b9c4d1}
    /* Clipped so the 980px site can't widen the phone viewport. */
    .frame{position:relative;width:100%;overflow:hidden}
    /* A slow push-in, so the page never sits still before it scrolls. */
    .old-box{position:absolute;top:0;left:0;transform-origin:50% 0;animation:creep 6s linear both}
    @keyframes creep{to{transform:scale(1.1)}}
    .old{width:980px;transform-origin:0 0;font-family:Verdana,Arial,sans-serif;font-size:12px;color:#333;background:#b9c4d1;padding:14px 0 40px}
    .old #wrap{width:900px;margin:0 auto;background:#fff;border:1px solid #8796a8}
    .old #head{background:linear-gradient(#3c6fbd,#1d3f7a);color:#fff;padding:22px 24px;font:bold 34px "Times New Roman",serif}
    .old #head small{display:block;font:italic 14px Georgia,serif;color:#d5e2f5;margin-top:4px}
    .old #nav{background:#e4e4e4;border-bottom:1px solid #b5b5b5;padding:7px 24px}
    .old #nav a{color:#0000cc;margin-right:16px}
    .old table{width:100%;border-collapse:collapse}
    .old td{vertical-align:top;padding:18px 24px}
    .old #side{width:190px;background:#f1f4f8;border-right:1px solid #d0d7e0}
    .old #side h3{font-size:12px;background:#1d3f7a;color:#fff;padding:4px 6px;margin:0 0 6px}
    .old #side p{margin:0 0 16px;line-height:1.5}
    .old h2{font:bold 20px Arial,sans-serif;color:#1d3f7a;margin:0 0 10px}
    .old p{line-height:1.6;text-align:justify}
    .old .photo{height:150px;background:repeating-linear-gradient(45deg,#d9dee5 0 10px,#e8ebef 10px 20px);border:1px solid #c4cad3;display:flex;align-items:center;justify-content:center;color:#8a93a0;margin:12px 0}
    .old .quote{font-style:italic;color:#555;border-left:3px solid #c9d3e0;padding-left:10px}
    .old .form td{padding:4px 6px;width:auto}
    .old .form input,.old .form textarea{width:320px;border:1px solid #999}
    .old #foot{border-top:1px solid #ccc;padding:10px 24px;font-size:10px;color:#777;text-align:center}
    .old .counter{font-family:"Courier New",monospace;background:#000;color:#3f3;padding:1px 4px}
  </style></head><body>
    <div class="frame" id="frame"><div class="old-box">
    <div class="old" id="old">
      <div id="wrap">
        <div id="head">${name}<small>Quality Work at Affordable Prices!!</small></div>
        <div id="nav"><a href="#">Home</a><a href="#">About Us</a><a href="#">Services</a><a href="#">Gallery</a><a href="#">Contact Us</a></div>
        <table><tr>
          <td id="side">
            <h3>Quick Links</h3><p>&raquo; <a href="#">Free Estimates</a><br>&raquo; <a href="#">Testimonials</a><br>&raquo; <a href="#">Links</a></p>
            <h3>Hours</h3><p>Mon - Fri: 8am - 5pm<br>Sat: By Appointment<br>Sun: Closed</p>
            <h3>Areas</h3><p>${areaText}</p>
          </td>
          <td>
            <h2>Welcome to ${name}!</h2>
            <p>${intro} ${aboutText}</p>
            <div class="photo">Image coming soon</div>
            <h2>Our Services</h2>
            <ul>${serviceItems}</ul>
            <p>Please <a href="#">click here</a> to contact us for more information about our services. We look forward to hearing from you!</p>
            <h2>What Our Customers Say</h2>
            ${quotes}
            <h2>Contact Us</h2>
            <table class="form"><tr><td>Name:</td><td><input></td></tr><tr><td>Email:</td><td><input></td></tr><tr><td>Message:</td><td><textarea rows="4"></textarea></td></tr><tr><td></td><td><button>Submit</button></td></tr></table>
          </td>
        </tr></table>
        <div id="foot">Copyright &copy; 2012 ${name}. All Rights Reserved. | Call us: ${phone} | Visitors: <span class="counter">004213</span></div>
      </div>
    </div>
    </div></div>
    <script>
      const old = document.getElementById("old");
      const fit = () => { const k = innerWidth / 980; old.style.transform = "scale(" + k + ")"; document.getElementById("frame").style.height = old.offsetHeight * k + "px"; };
      fit(); addEventListener("resize", fit);
    </script>
  </body></html>`;
}

// Injected before the page loads: hides preview-only chrome, draws the BEFORE/AFTER tag and
// captions, and scrolls the page from top to bottom within the segment.
export function driverScript(opts: {
  tag: string;
  durationMs: number;
  caption?: string;
  labels?: ShortCopy["labels"];
}) {
  return `(() => {
  const OPTS = ${JSON.stringify(opts)};
  // Short still moments at both ends: a picture that sits still reads as a freeze on Shorts.
  const START = 600, HOLD = 0;
  ${cueHelper}
  const css = \`
    nextjs-portal,[data-preview-banner]{display:none!important}
    html{scroll-behavior:auto!important}
    #hs-tag{position:fixed;top:14px;right:14px;z-index:2147483647;font:700 12px/1 Figtree,system-ui,sans-serif;letter-spacing:.14em;padding:8px 11px;border-radius:999px;background:#151515;color:#fff}
    #hs-tag.before{background:#fff;color:#151515;box-shadow:0 2px 10px rgba(0,0,0,.18)}
    #hs-cap{position:fixed;left:16px;right:16px;bottom:100px;z-index:2147483647;display:flex;justify-content:center;pointer-events:none}
    #hs-cap span{background:#151515;color:#fff;font:600 18px/1.3 Figtree,system-ui,sans-serif;padding:11px 18px;border-radius:16px;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.28);opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}
    #hs-cap span.on{opacity:1;transform:none}
  \`;
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    const tag = document.createElement("div"); tag.id = "hs-tag"; tag.textContent = OPTS.tag;
    if (OPTS.tag === "BEFORE") tag.className = "before";
    const cap = document.createElement("div"); cap.id = "hs-cap"; const text = document.createElement("span"); cap.append(text);
    document.body.append(tag, cap);

    let current = null;
    const show = (value) => {
      if (value === current) return;
      current = value;
      text.classList.remove("on");
      setTimeout(() => { if (current !== value) return; text.textContent = value; if (value) { text.classList.add("on"); __hsCue("pop"); } }, 200);
    };
    // The caption follows whichever section's top has passed the middle of the screen.
    const label = () => {
      if (OPTS.caption) return OPTS.caption;
      let type = "";
      for (const el of document.querySelectorAll("[data-section]")) {
        const box = el.firstElementChild;
        if (box && box.getBoundingClientRect().top <= innerHeight * 0.55) type = el.dataset.section;
      }
      return (OPTS.labels && OPTS.labels[type]) || "";
    };

    addEventListener("load", () => {
      setTimeout(() => show(label()), 500);
      setTimeout(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        const dur = Math.max(1000, OPTS.durationMs - START - HOLD);
        const t0 = performance.now();
        // Mostly eased, partly linear, so the last second still moves instead of crawling to a stop.
        const ease = (t) => 0.7 * (0.5 - Math.cos(Math.PI * t) / 2) + 0.3 * t;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          scrollTo(0, max * ease(p));
          show(label());
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, START);
    });
  });
})();`;
}
