/* eslint-disable @typescript-eslint/no-explicit-any -- CDP messages are untyped JSON; callers read the few fields they need. */
// Minimal Chrome DevTools Protocol client: launches headless Edge/Chrome and talks to one page.
// Enough for screen recording without pulling in Playwright.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const browsers = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

type Listener = (params: any) => void;

export type Page = {
  send<T = any>(method: string, params?: object): Promise<T>;
  on(method: string, fn: Listener): () => void;
  once(method: string, timeoutMs?: number): Promise<any>;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser(): Promise<{ page: Page; close: () => Promise<void> }> {
  const exe = browsers.find((p) => p && existsSync(p));
  if (!exe) throw new Error("No Edge or Chrome found. Set BROWSER_PATH to the browser executable.");

  // Throwaway profile, so the user's own browser and its sign-ins are never touched.
  const profile = await mkdtemp(path.join(os.tmpdir(), "heronscout-shorts-"));
  const proc = spawn(
    exe,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const port = await debugPort(profile);
  const targets: { type: string; webSocketDebuggerUrl: string }[] = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("Browser started without a page.");
  const { page, ws } = await connect(target.webSocketDebuggerUrl);

  return {
    page,
    close: async () => {
      ws.close();
      proc.kill();
      await sleep(500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// The browser writes its chosen port to DevToolsActivePort in the profile folder.
async function debugPort(profile: string) {
  const file = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 150; i++) {
    const text = await readFile(file, "utf8").catch(() => "");
    const port = Number(text.split("\n")[0]);
    if (port) return port;
    await sleep(100);
  }
  throw new Error("Browser did not open a debugging port within 15 seconds.");
}

async function connect(url: string) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("Could not connect to the browser."));
  });

  let nextId = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; method: string }>();
  const listeners = new Map<string, Set<Listener>>();

  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p?.resolve(msg.result);
    } else {
      listeners.get(msg.method)?.forEach((fn) => fn(msg.params));
    }
  };

  const page: Page = {
    send(method, params = {}) {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method)!.add(fn);
      return () => listeners.get(method)!.delete(fn);
    },
    once(method, timeoutMs = 60_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          off();
          reject(new Error(`Timed out waiting for ${method}.`));
        }, timeoutMs);
        const off = page.on(method, (params) => {
          clearTimeout(timer);
          off();
          resolve(params);
        });
      });
    },
  };
  return { page, ws };
}
