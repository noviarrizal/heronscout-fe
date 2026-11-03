import { setTimeout as sleep } from "node:timers/promises";

// Runs an Apify actor, waits for it and returns its run id and dataset items (null items if the run failed).
// maxUsd caps what the run may charge.
export async function runActor<T = unknown>(actor: string, input: object, maxUsd: number): Promise<{ runId: string; items: T[] | null }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is missing.");
  const apify = async (path: string, init?: RequestInit) => {
    const res = await fetch(`https://api.apify.com/v2${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers },
    });
    if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
    return res.json();
  };

  const { data: run } = await apify(`/acts/${actor}/runs?maxTotalChargeUsd=${maxUsd}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  let status = run.status as string;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    await sleep(15_000);
    status = (await apify(`/actor-runs/${run.id}`)).data.status;
  }
  if (status !== "SUCCEEDED") {
    console.log(`  Apify run ${run.id} ${status}.`);
    return { runId: run.id, items: null };
  }
  return { runId: run.id, items: await apify(`/datasets/${run.defaultDatasetId}/items?format=json&clean=true`) };
}
