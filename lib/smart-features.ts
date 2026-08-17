import { formatMoney, formatPercent, formatDateBR } from "./format";
import type { CmvCosts, CmvEntry, FreelancerEntry, PerformanceMetrics, SalesEntry, UnitConfig } from "./types";

export type CmvBonusImpact = {
  isBlocked: boolean;
  percentage: number;
  targetPercent: number;
  marginReais: number;
  excessReais: number;
  potentialBonus: number;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger";
  actionAdvice: string;
};

export function calculateCmvBonusImpact(
  cmvPercent: number,
  revenue: number,
  totalCost: number,
  targetPercent: number = 35.0,
  potentialBonus: number = 2000
): CmvBonusImpact {
  if (revenue <= 0) {
    return {
      isBlocked: false,
      percentage: 0,
      targetPercent,
      marginReais: 0,
      excessReais: 0,
      potentialBonus,
      statusLabel: "Aguardando faturamento",
      statusTone: "warning",
      actionAdvice: "Lance as vendas para calcular a margem de bônus.",
    };
  }

  const maxAllowedCost = (revenue * targetPercent) / 100;
  const isBlocked = cmvPercent > targetPercent;
  const marginReais = Math.max(maxAllowedCost - totalCost, 0);
  const excessReais = Math.max(totalCost - maxAllowedCost, 0);

  if (!isBlocked) {
    const isClose = targetPercent - cmvPercent <= 1.5;
    return {
      isBlocked: false,
      percentage: cmvPercent,
      targetPercent,
      marginReais,
      excessReais: 0,
      potentialBonus,
      statusLabel: isClose ? "Margem apertada" : "Bônus Liberado",
      statusTone: isClose ? "warning" : "success",
      actionAdvice: isClose
        ? `Você tem ${formatMoney(marginReais)} de folga em compras antes de arriscar a bonificação.`
        : `CMV saudável! Margem de segurança de ${formatMoney(marginReais)} em compras preservada.`,
    };
  } else {
    return {
      isBlocked: true,
      percentage: cmvPercent,
      targetPercent,
      marginReais: 0,
      excessReais,
      potentialBonus,
      statusLabel: "Bônus Bloqueado",
      statusTone: "danger",
      actionAdvice: `Economize ${formatMoney(excessReais)} em insumos para voltar a ≤ ${formatPercent(targetPercent)} e desbloquear ${formatMoney(potentialBonus)} de bônus.`,
    };
  }
}

export type CostAnomaly = {
  key: keyof CmvCosts;
  label: string;
  share: number;
  historicalShare: number;
  differencePoints: number;
  isAnomaly: boolean;
  message: string;
};

const STANDARD_COST_BENCHMARKS: Record<keyof CmvCosts, { label: string; expectedShare: number }> = {
  rawMaterials: { label: "Matéria-prima", expectedShare: 58 },
  productionCenter: { label: "Central de produção", expectedShare: 12 },
  beverages: { label: "Bebidas", expectedShare: 18 },
  packaging: { label: "Embalagens", expectedShare: 12 },
};

export function detectCostAnomalies(
  currentCosts: CmvCosts,
  history: CmvEntry[]
): CostAnomaly[] {
  const totalCost = (currentCosts.rawMaterials || 0) + (currentCosts.productionCenter || 0) + (currentCosts.beverages || 0) + (currentCosts.packaging || 0);
  if (totalCost <= 0) return [];

  // Calculate historical average share
  const historicalTotals: Record<keyof CmvCosts, number> = { rawMaterials: 0, productionCenter: 0, beverages: 0, packaging: 0 };
  let historicalGrandTotal = 0;

  history.slice(0, 4).forEach((rec) => {
    historicalTotals.rawMaterials += rec.rawMaterials || 0;
    historicalTotals.productionCenter += rec.productionCenter || 0;
    historicalTotals.beverages += rec.beverages || 0;
    historicalTotals.packaging += rec.packaging || 0;
    historicalGrandTotal += (rec.rawMaterials || 0) + (rec.productionCenter || 0) + (rec.beverages || 0) + (rec.packaging || 0);
  });

  const keys: Array<keyof CmvCosts> = ["rawMaterials", "productionCenter", "beverages", "packaging"];

  return keys.map((key) => {
    const value = currentCosts[key] || 0;
    const share = (value / totalCost) * 100;
    const bench = STANDARD_COST_BENCHMARKS[key];
    const historicalShare = historicalGrandTotal > 0
      ? (historicalTotals[key] / historicalGrandTotal) * 100
      : bench.expectedShare;

    const differencePoints = share - historicalShare;
    const isAnomaly = differencePoints >= 8.0 && value > 0;

    let message = `Representa ${formatPercent(share)} dos custos totais.`;
    if (isAnomaly) {
      message = `⚠️ Subiu +${formatPercent(differencePoints)} p.p. vs média histórica. Conferir compras ou duplicidade.`;
    }

    return {
      key,
      label: bench.label,
      share,
      historicalShare,
      differencePoints,
      isAnomaly,
      message,
    };
  });
}

export function generateCmvWhatsAppText({
  unitName,
  periodStart,
  periodEnd,
  revenue,
  costs,
  cmvPercent,
  targetPercent = 35.0,
}: {
  unitName: string;
  periodStart: string;
  periodEnd: string;
  revenue: number;
  costs: CmvCosts;
  cmvPercent: number;
  targetPercent?: number;
}): string {
  const totalCost = (costs.rawMaterials || 0) + (costs.productionCenter || 0) + (costs.beverages || 0) + (costs.packaging || 0);
  const isHealthy = cmvPercent <= targetPercent;

  return `🍔 *${unitName.toUpperCase()} — FECHAMENTO DE CMV*
📅 *Período:* ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}

💰 *Faturamento Takeat:* ${formatMoney(revenue)}
📦 *CMV da Semana:* ${formatPercent(cmvPercent)} (Meta: ≤ ${formatPercent(targetPercent)}) ${isHealthy ? "✅" : "⚠️"}
💵 *Custo Total:* ${formatMoney(totalCost)}

*Detalhamento de Custos:*
• 🥩 Matéria-prima: ${formatMoney(costs.rawMaterials || 0)} (${revenue > 0 ? formatPercent(((costs.rawMaterials || 0) / revenue) * 100) : "—"})
• 🏭 Central de Produção: ${formatMoney(costs.productionCenter || 0)} (${revenue > 0 ? formatPercent(((costs.productionCenter || 0) / revenue) * 100) : "—"})
• 🍷 Bebidas: ${formatMoney(costs.beverages || 0)} (${revenue > 0 ? formatPercent(((costs.beverages || 0) / revenue) * 100) : "—"})
• 📦 Embalagens: ${formatMoney(costs.packaging || 0)} (${revenue > 0 ? formatPercent(((costs.packaging || 0) / revenue) * 100) : "—"})

🎯 *Status de Bonificação:* ${isHealthy ? "Liberado para a equipe 🚀" : "Bloqueado pelo limite de CMV ❌"}
_Gerado automaticamente pelo HOUSE GESTÃO_`;
}

export function generateDashboardWhatsAppText({
  unitName,
  metrics,
  bonusConquered,
  freelancerTotal,
  cmvPercent,
}: {
  unitName: string;
  metrics: PerformanceMetrics;
  bonusConquered: number;
  freelancerTotal: number;
  cmvPercent?: number;
}): string {
  const [salao, delivery, ifood] = metrics.channels;
  return `📊 *${unitName.toUpperCase()} — RESUMO DE PERFORMANCE*
📅 *Data:* ${new Date().toLocaleDateString("pt-BR")}

💰 *Realizado no Mês:* ${formatMoney(metrics.total)} (${formatPercent(metrics.percentage)} da meta)
🎯 *Meta Mensal:* ${formatMoney(metrics.expected)} esperado até hoje
📈 *Trajetória:* ${metrics.gap >= 0 ? `+${formatMoney(metrics.gap)} acima do ritmo 🚀` : `${formatMoney(metrics.gap)} abaixo do ritmo ⚠️`}
🔮 *Projeção:* ${formatMoney(metrics.projection)}

*Canais de Venda:*
• 🍽️ ${salao.label}: ${formatMoney(salao.realized)} (${formatPercent(salao.percentage)})
• 🛵 ${delivery.label}: ${formatMoney(delivery.realized)} (${formatPercent(delivery.percentage)})
• 🛍️ ${ifood.label}: ${formatMoney(ifood.realized)} (${formatPercent(ifood.percentage)})

*Controles Operacionais:*
• 💰 Bônus Atual: ${formatMoney(bonusConquered)}
• 👥 Freelancers Gastos: ${formatMoney(freelancerTotal)} / Limite R$ 1.500
${cmvPercent !== undefined ? `• 📦 CMV Atual: ${formatPercent(cmvPercent)} (Meta ≤ 35%)` : ""}

_HOUSE GESTÃO — Central de Metas_`;
}
