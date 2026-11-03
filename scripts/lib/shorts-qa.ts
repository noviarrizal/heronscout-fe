// Checks a finished short frame by frame (black, white, frozen and jumpy frames), measures its loudness
// and saves a contact sheet at 2 frames a second. Adapted from short_qa.py in
// github.com/mromidev/claude-animated-shorts (MIT).
import { ffmpeg } from "./ffmpeg";

const W = 90;
const H = 160;
const FROZEN_FRAMES = 12;

export async function checkShort(file: string, opts: { fps: number; planned: [number, number][]; sheet: string }) {
  const problems: string[] = [];
  const notes: string[] = [];
  const sec = (frame: number) => `${(frame / opts.fps).toFixed(2)}s`;

  const { out } = await ffmpeg(["-i", file, "-vf", `scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"]);
  const size = W * H;
  const n = Math.floor(out.length / size);
  const mean: number[] = [];
  const diff: number[] = [];
  for (let f = 0; f < n; f++) {
    let sum = 0;
    let change = 0;
    for (let i = f * size; i < (f + 1) * size; i++) {
      sum += out[i];
      if (f > 0) change += Math.abs(out[i] - out[i - size]);
    }
    mean.push(sum / size);
    if (f > 0) diff.push(change / size);
  }
  // Cross-fades and the white flash are meant to change fast.
  const planned = new Set<number>();
  for (const [a, b] of opts.planned)
    for (let f = Math.floor(a * opts.fps) - 2; f <= Math.ceil(b * opts.fps) + 4; f++) planned.add(f);

  const black = mean.flatMap((m, f) => (m < 10 ? [f] : []));
  const white = mean.flatMap((m, f) => (m > 250 && !planned.has(f) ? [f] : []));
  if (black.length) problems.push(`black frames at ${black.slice(0, 8).map(sec).join(", ")}`);
  if (white.length) problems.push(`white frames at ${white.slice(0, 8).map(sec).join(", ")}`);

  const frozen: string[] = [];
  let run = 0;
  diff.forEach((d, i) => {
    run = d < 0.05 ? run + 1 : 0;
    if (run === FROZEN_FRAMES) frozen.push(sec(i + 1 - run));
  });
  if (frozen.length) problems.push(`picture holds still for ${FROZEN_FRAMES}+ frames from ${frozen.join(", ")}`);

  const jumps = diff.flatMap((d, i) => {
    const local = diff.slice(Math.max(0, i - 8), i + 9).sort((a, b) => a - b);
    const median = local[Math.floor(local.length / 2)];
    // The floor lets a caption fading in pass; a photo or block popping in changes far more.
    return d > 3 * median + 4 && !planned.has(i + 1) ? [i + 1] : [];
  });
  if (jumps.length) problems.push(`sudden jumps (e.g. a photo popping in) at ${jumps.slice(0, 8).map(sec).join(", ")}`);
  notes.push(`${n} frames, ${sec(n)}`);

  const loud = await ffmpeg(["-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], "info").catch(
    () => null,
  );
  if (loud) {
    const summary = loud.err.slice(loud.err.lastIndexOf("Summary:"));
    const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
    const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]);
    notes.push(`loudness ${lufs} LUFS, true peak ${peak} dBFS`);
    if (!(lufs > -17 && lufs < -13)) problems.push(`loudness ${lufs} LUFS (aim for about -15)`);
    if (peak > -0.5) problems.push(`true peak ${peak} dBFS may clip`);
  } else notes.push("no audio track");

  await ffmpeg(["-y", "-i", file, "-vf", "fps=2,scale=108:192,tile=10x6", "-frames:v", "1", "-update", "1", opts.sheet]);
  const report = [...notes, ...(problems.length ? problems.map((p) => `PROBLEM: ${p}`) : ["no problems found"])];
  return { problems, report: report.join("\n") + "\n" };
}
