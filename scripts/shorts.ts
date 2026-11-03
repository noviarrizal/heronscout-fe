// Turn a demo preview into a ~30 second vertical before/after video for YouTube Shorts, TikTok and Reels.
// Usage: pnpm shorts <demo-slug> [--base http://localhost:3000] [--music track.mp3 | --silent] [--keep-frames]
// Needs the site running (pnpm dev or pnpm start), Edge or Chrome, and ffmpeg on PATH (or FFMPEG_PATH).
// Sound is generated (scripts/lib/shorts-audio.ts) unless --music replaces the bed or --silent drops it.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizeCopy, siteSpecSchema } from "../src/lib/spec";
import { launchBrowser, sleep, type Page } from "./lib/cdp";
import { ffmpeg } from "./lib/ffmpeg";
import { soundtrack, wav } from "./lib/shorts-audio";
import { beforePage, driverScript, hookPage, outroPage, shortCopy, shortMeta } from "./lib/shorts-pages";
import { checkShort } from "./lib/shorts-qa";

// A 432x768 phone viewport at 2.5x gives 1080x1920 frames.
const W = 432;
const H = 768;
const SCALE = 2.5;
const FPS = 30;
const SECONDS = { hook: 2.6, before: 5.2, after: 18, outro: 4.2 };
// Cross-fades between hook > before > after > outro.
const FADES: [number, string][] = [
  [0.3, "fade"],
  [0.25, "fadewhite"],
  [0.4, "fade"],
];

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const base = (flag("--base") ?? process.env.SHORTS_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const music = flag("--music");
const silent = args.includes("--silent");
const keepFrames = args.includes("--keep-frames");

// Real leads' previews carry their names and Google photos, so only fictional demos become videos.
// To feature a client who gave permission, copy their spec into a new demo-*.json first.
if (!slug || !/^demo-[a-z0-9-]+$/.test(slug)) {
  console.error("Usage: pnpm shorts <demo-slug>  (only fixtures/previews/demo-*.json, which are fictional businesses)");
  process.exit(1);
}
const fixture = path.join(process.cwd(), "fixtures", "previews", `${slug}.json`);
if (!existsSync(fixture)) {
  console.error(`No fixture at ${fixture}`);
  process.exit(1);
}
if (music && !existsSync(music)) {
  console.error(`Music file not found: ${music}`);
  process.exit(1);
}

const raw = JSON.parse(await readFile(fixture, "utf8"));
const spec = sanitizeCopy(siteSpecSchema.parse(raw));
const copy = shortCopy(spec, raw.short);

await ffmpeg(["-version"]).catch(() => {
  console.error("ffmpeg not found. Install it or set FFMPEG_PATH.");
  process.exit(1);
});

// Also warms up `next dev`, so the first compile doesn't land in the recording.
const afterUrl = `${base}/p/${slug}`;
const res = await fetch(afterUrl).catch(() => null);
if (!res?.ok) {
  console.error(`Could not open ${afterUrl} (${res ? res.status : "no response"}). Start the site first: pnpm dev`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "out", "shorts");
const work = path.join(outDir, slug);
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
const writePage = async (name: string, html: string) => {
  const file = path.join(work, `${name}.html`);
  await writeFile(file, html);
  return pathToFileURL(file).href;
};

const { page, close } = await launchBrowser();
let clips: Awaited<ReturnType<typeof record>>[] = [];
try {
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });

  console.log("Recording hook...");
  const hook = await record(page, "hook", await writePage("hook", hookPage(copy)), SECONDS.hook);
  console.log("Recording before...");
  const before = await record(
    page,
    "before",
    await writePage("before", beforePage(spec)),
    SECONDS.before,
    driverScript({ tag: "BEFORE", durationMs: SECONDS.before * 1000, caption: copy.before }),
  );
  console.log("Recording after...");
  const after = await record(
    page,
    "after",
    afterUrl,
    SECONDS.after,
    driverScript({ tag: "AFTER", durationMs: SECONDS.after * 1000, labels: copy.labels }),
  );
  console.log("Recording outro...");
  const outro = await record(page, "outro", await writePage("outro", outroPage(copy)), SECONDS.outro);
  clips = [hook, before, after, outro];
} finally {
  await close();
}

const durations = [SECONDS.hook, SECONDS.before, SECONDS.after, SECONDS.outro];
const filters: string[] = [];
// Where each clip starts in the final video: the next one begins as the cross-fade starts.
const starts = [0];
let length = durations[0];
let prev = "[0:v]";
FADES.forEach(([fade, kind], i) => {
  const label = `[v${i + 1}]`;
  starts.push(length - fade);
  filters.push(`${prev}[${i + 1}:v]xfade=transition=${kind}:duration=${fade}:offset=${(length - fade).toFixed(3)}${label}`);
  length += durations[i + 1] - fade;
  prev = label;
});
const inputs = clips.flatMap((c) => ["-i", c.clip]);
const audio: string[] = [];
const sound = silent ? null : await makeSound();
if (sound) {
  inputs.push("-i", sound);
  audio.push("-map", `${clips.length}:a`, "-c:a", "aac", "-b:a", "192k");
}

const output = path.join(outDir, `${slug}.mp4`);
console.log("Joining clips...");
await ffmpeg([
  "-y",
  ...inputs,
  "-filter_complex",
  filters.join(";"),
  "-map",
  prev,
  ...audio,
  "-t",
  length.toFixed(3),
  "-r",
  String(FPS),
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  output,
]);
await writeFile(path.join(outDir, `${slug}.txt`), shortMeta(spec, copy));
if (!keepFrames) await rm(work, { recursive: true, force: true });

// Frame-by-frame check; the contact sheet and report go to out/shorts/qa/ for a quick look.
const qaDir = path.join(outDir, "qa");
await mkdir(qaDir, { recursive: true });
const qa = await checkShort(output, {
  fps: FPS,
  planned: FADES.map(([fade], i) => [starts[i + 1], starts[i + 1] + fade]),
  sheet: path.join(qaDir, `${slug}.jpg`),
});
await writeFile(path.join(qaDir, `${slug}.txt`), qa.report);
console.log(`Done: ${output} + ${slug}.txt`);
console.log(`Length ${length.toFixed(1)}s, ${silent ? "silent" : music ? "your music + effects" : "generated music + effects"}`);
console.log(
  qa.problems.length
    ? `QA found problems (out/shorts/qa/${slug}.txt):\n- ${qa.problems.join("\n- ")}`
    : "QA: no problems found",
);

// Music (generated, or --music) plus effects at the moments the pages logged, mastered to -15 LUFS.
async function makeSound() {
  const cues = clips.flatMap((c, i) => c.cues.map((cue) => ({ ...cue, t: starts[i] + cue.t })));
  const sfx = path.join(work, "sound.wav");
  const plan = {
    length,
    drop: starts[2] + FADES[1][0] / 2,
    outro: starts[3],
    whooshes: FADES.map(([fade], i) => ({ t: starts[i + 1] + fade / 2, size: i === 1 ? 1 : 0.5 })),
    pops: cues.filter((c) => c.kind === "pop").map((c) => c.t),
    chimes: cues.filter((c) => c.kind === "chime").map((c) => c.t),
    music: !music,
  };
  await writeFile(sfx, wav(soundtrack(plan)));
  let mix = sfx;
  if (music) {
    mix = path.join(work, "mix.wav");
    const L = length.toFixed(3);
    const bed = `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${L},afade=t=in:d=0.4,afade=t=out:st=${(length - 1.5).toFixed(3)}:d=1.5,volume=0.7[m]`;
    await ffmpeg(["-y", "-i", music, "-i", sfx, "-filter_complex", `${bed};[m][1:a]amix=inputs=2:normalize=0[a]`, "-map", "[a]", "-t", L, mix]);
  }
  // Two passes: measure, then apply one fixed gain so the mix keeps its dynamics.
  const target = "I=-15:TP=-1:LRA=20";
  const { err } = await ffmpeg(["-i", mix, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], "info");
  const m = JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1));
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}`;
  const mastered = path.join(work, "master.wav");
  await ffmpeg(["-y", "-i", mix, "-af", `loudnorm=${target}:${measured}:offset=${m.target_offset}:linear=true`, "-ar", "48000", mastered]);
  return mastered;
}

// Screencast records real time, so motion on the page plays at its true speed. Frames arrive
// only when something changes; each is held until the next one, then resampled to a steady FPS.
async function record(page: Page, name: string, url: string, seconds: number, script?: string) {
  const dir = path.join(work, name);
  await mkdir(dir, { recursive: true });
  // Load the page once first, so fonts and photos come from cache when the recording starts.
  const warmed = page.once("Page.loadEventFired", 30_000).catch(() => {});
  await page.send("Page.navigate", { url });
  await warmed;
  await sleep(1500);
  await page.send("Page.navigate", { url: "about:blank" });
  await sleep(300);
  const added = script ? await page.send("Page.addScriptToEvaluateOnNewDocument", { source: script }) : null;

  const frames: { file: string; t: number }[] = [];
  const writes: Promise<void>[] = [];
  let t0 = 0;
  const off = page.on("Page.screencastFrame", (p) => {
    page.send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
    if (!t0) return;
    const file = path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    frames.push({ file, t: performance.now() / 1000 });
    writes.push(writeFile(file, Buffer.from(p.data, "base64")));
  });

  await page.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: W * SCALE,
    maxHeight: H * SCALE,
    everyNthFrame: 1,
  });
  const ready = page.once("Page.domContentEventFired");
  await page.send("Page.navigate", { url });
  await ready;
  t0 = performance.now() / 1000;
  const t0Epoch = performance.timeOrigin + performance.now();
  await sleep(seconds * 1000);
  // Sound cues the page logged (epoch ms), turned into seconds from the start of this clip.
  const logged = await page.send("Runtime.evaluate", { expression: "JSON.stringify(window.__hsCues || [])", returnByValue: true });
  const cues = (JSON.parse(logged.result.value) as { kind: string; t: number }[])
    .map((c) => ({ kind: c.kind, t: (c.t - t0Epoch) / 1000 }))
    .filter((c) => c.t >= 0 && c.t < seconds);
  await page.send("Page.stopScreencast");
  off();
  await Promise.all(writes);
  if (added) await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: added.identifier });
  // A page that never changes may send no screencast frame at all: fall back to one screenshot.
  if (!frames.length) {
    const shot = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    const file = path.join(dir, "00000.jpg");
    await writeFile(file, Buffer.from(shot.data, "base64"));
    frames.push({ file, t: t0 });
  }

  const end = t0 + seconds;
  const list = frames.map((f, i) => {
    const start = i === 0 ? t0 : f.t;
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    return `file '${path.basename(f.file)}'\nduration ${Math.max(0.001, next - start).toFixed(4)}`;
  });
  list.push(`file '${path.basename(frames[frames.length - 1].file)}'`);
  const listFile = path.join(dir, "frames.txt");
  await writeFile(listFile, list.join("\n"));

  const clip = path.join(work, `${name}.mp4`);
  await ffmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-vf",
    `fps=${FPS},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xf2f0ea,format=yuv420p`,
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "16",
    clip,
  ]);
  console.log(`  ${frames.length} frames, ${cues.length} sound cues`);
  return { clip, cues };
}
