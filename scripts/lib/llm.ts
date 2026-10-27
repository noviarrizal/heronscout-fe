import "dotenv/config";

// DeepSeek by default; any OpenAI-compatible chat API works.
const baseUrl = process.env.LLM_BASE_URL?.replace(/\/?$/, "/");
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatJson(messages: ChatMessage[]): Promise<{ raw: string; json: unknown }> {
  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set in .env");
  }
  const res = await fetch(`${baseUrl}chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.8 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  // Some models wrap JSON in a code fence even in JSON mode.
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
  return { raw, json: JSON.parse(cleaned) };
}
