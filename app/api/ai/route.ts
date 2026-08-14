import { NextResponse } from "next/server";

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

type AIChannel = { label: string; realizado: number; meta: number };
type AIPayload = {
  gap?: number; salao?: AIChannel; delivery?: AIChannel; ifood?: AIChannel;
  faturamentoAtual?: number; metaEsperadaAteHoje?: number; projecao?: number; mediaNecessaria?: number;
};

function localAnalysis(data: AIPayload) {
  const gap = Number(data.gap || 0);
  const channels = [data.salao, data.delivery, data.ifood].filter(Boolean);
  const worst = [...channels].sort((a, b) => (a.realizado / a.meta) - (b.realizado / b.meta))[0];
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  return {
    diagnostic: gap >= 0
      ? `A unidade está ${money(gap)} acima da trajetória esperada e precisa proteger o ritmo até o fechamento.`
      : `A unidade está ${money(Math.abs(gap))} abaixo da trajetória esperada. A recuperação ainda depende de execução diária.` ,
    alert: `${worst?.label || "O canal de menor desempenho"} é o principal ponto de atenção, com ${Math.round((worst?.realizado / worst?.meta) * 100 || 0)}% da meta mensal.`,
    numbers: [
      `Realizado: ${money(data.faturamentoAtual || 0)}`,
      `Trajetória: ${money(data.metaEsperadaAteHoje || 0)}`,
      `Projeção: ${money(data.projecao || 0)}`,
      `Média necessária: ${money(data.mediaNecessaria || 0)}/dia`,
    ],
    actions: [
      `Concentrar a primeira ação comercial em ${worst?.label || "canal crítico"}.`,
      "Acompanhar o realizado no meio e no fim do expediente.",
      "Planejar sexta a domingo com metas por turno e responsável definido.",
    ],
    tomorrow: `Buscar no mínimo ${money(data.mediaNecessaria || 0)} e reduzir primeiro o desvio de ${worst?.label || "canal crítico"}.`,
    demo: true,
  };
}

export async function POST(request: Request) {
  const payload = await request.json() as AIPayload;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json(localAnalysis(payload));

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
