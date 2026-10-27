const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// Returns the page HTML, or an empty string plus the reason it couldn't be read.
export async function fetchPage(url: string): Promise<{ html: string; error?: string }> {
  try {
    const href = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(href, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { html: "", error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { html: "", error: `not HTML (${type || "no content-type"})` };
    return { html: await res.text() };
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    return { html: "", error: cause ?? (err as Error).name };
  }
}

export async function fetchHtml(url: string) {
  return (await fetchPage(url)).html;
}

function decode(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, " ");
}

function stripTags(html: string) {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// A compact, model-friendly digest of a page: title, headings, nav labels, body text and colours.
export function digestPage(html: string, maxText = 2500) {
  const body = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const headings = [...body.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => `h${m[1]}: ${stripTags(m[2])}`)
    .filter((h) => h.length > 4)
    .slice(0, 25);
  const nav = [...(body.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? "").matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, 12);
  const colourCounts = new Map<string, number>();
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const c = `#${m[1].toLowerCase()}`;
    if (c !== "#ffffff" && c !== "#000000") colourCounts.set(c, (colourCounts.get(c) ?? 0) + 1);
  }
  const colours = [...colourCounts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  return { title, headings, nav, colours, text: stripTags(body).slice(0, maxText) };
}
