import { buildDemoAnalysis, type AIPayload } from "./ai-demo";

export type AIResult = {
  diagnostic: string;
  alert: string;
  numbers: string[];
  actions: string[];
  tomorrow: string;
  demo?: boolean;
};

export async function requestAiAnalysis(payload: AIPayload): Promise<AIResult> {
  // 1. Try local/server API if available
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.diagnostic && data.actions?.length) {
        return data;
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Try Cloudflare Worker endpoint if available
  try {
    const response = await fetch("https://house-gestao-ia.gleucedias1.workers.dev/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.diagnostic && data.actions?.length) {
        return data;
      }
    }
  } catch {
    // Continue to fallback
  }

  // 3. High-intelligence local analytical engine fallback
  // This guarantees 100% availability with real calculations based on company rules
  return buildDemoAnalysis(payload);
}
