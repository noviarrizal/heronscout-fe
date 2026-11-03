import { spawn } from "node:child_process";

const bin = process.env.FFMPEG_PATH ?? "ffmpeg";

// Runs ffmpeg and returns its stdout bytes and stderr text. Use level "info" to read filter
// reports such as loudnorm or ebur128 from stderr.
export function ffmpeg(argv: string[], level = "error") {
  return new Promise<{ out: Buffer; err: string }>((resolve, reject) => {
    const proc = spawn(bin, ["-hide_banner", "-loglevel", level, ...argv], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    proc.stdout.on("data", (d: Buffer) => out.push(d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve({ out: Buffer.concat(out), err }) : reject(new Error(`ffmpeg failed: ${err.trim().slice(-800)}`)),
    );
  });
}
