import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();
const groqKey = defineSecret("GROQ_API_KEY");

const systemPrompt = `Você é o Consultor de Gestão da House. Analise somente os dados calculados enviados.
Nunca invente dados e nunca refaça cálculos financeiros. Diferencie realizado, meta, trajetória, projeção e tendência.
Priorize ações objetivas para Salão, Delivery Próprio e iFood. Responda em português do Brasil em JSON com:
diagnostic, alert, numbers (array), actions (array com três ações) e tomorrow.`;

export const analyzePerformance = onRequest(
  { cors: true, secrets: [groqKey], maxInstances: 3, timeoutSeconds: 30 },
  async (request, response) => {
    if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido" });
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return response.status(401).json({ error: "Autenticação necessária" });
    try {
      await getAuth().verifyIdToken(token);
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey.value()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(request.body) },
          ],
        }),
      });
      if (!groqResponse.ok) return response.status(502).json({ error: "Falha temporária na análise" });
      const result = await groqResponse.json();
      return response.json(JSON.parse(result.choices?.[0]?.message?.content || "{}"));
    } catch (error) {
      console.error("analyzePerformance", error);
      return response.status(401).json({ error: "Sessão inválida ou análise indisponível" });
    }
  },
);
