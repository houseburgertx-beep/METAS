import { NextResponse } from "next/server";
import { buildDemoAnalysis, type AIPayload } from "@/lib/ai-demo";

const SYSTEM_PROMPT = `Você é o Consultor de Gestão da House, um analista de performance executivo.
Analise somente os dados fornecidos. Nunca invente números e nunca refaça cálculos financeiros.
Sempre diferencie faturamento realizado, meta, trajetória esperada, projeção e tendência.
Considere Salão, Delivery Próprio, iFood, subdivisões, histórico, dias restantes e regras do programa.
Quando houver desvio, quantifique o gap, identifique o canal responsável, explique a urgência e proponha ações objetivas.
Quando estiver acima, identifique o que funciona, proteja o resultado e avalie a supermeta.
Responda em português do Brasil, de forma curta e prática, exatamente nesta estrutura:
DIAGNÓSTICO
PRINCIPAL ALERTA
NÚMEROS IMPORTANTES
PLANO DE AÇÃO
FOCO PARA AMANHÃ`;

export async function POST(request: Request) {
  const payload = await request.json() as AIPayload;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json(buildDemoAnalysis(payload));

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\nRetorne JSON com as chaves diagnostic, alert, numbers (array), actions (array), tomorrow.` },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!response.ok) return NextResponse.json({ error: "Não foi possível gerar a análise agora." }, { status: 502 });
  const result = await response.json();
  try {
    return NextResponse.json(JSON.parse(result.choices?.[0]?.message?.content || "{}"));
  } catch {
    return NextResponse.json({ error: "A análise retornou um formato inválido." }, { status: 502 });
  }
}
