export type AIChannel = { label: string; realizado: number; meta: number };
export type AIPayload = {
  gap?: number;
  salao?: AIChannel;
  delivery?: AIChannel;
  ifood?: AIChannel;
  faturamentoAtual?: number;
  metaEsperadaAteHoje?: number;
  projecao?: number;
  mediaNecessaria?: number;
  unidade?: string;
  periodo?: string;
  faturamentoTakeat?: number;
  cmvPercentual?: number;
  metaCmvPercentual?: number;
  desvioPontosPercentuais?: number;
  custoTotal?: number;
  custos?: {
    rawMaterials?: number;
    productionCenter?: number;
    beverages?: number;
    packaging?: number;
  };
};

export function buildDemoAnalysis(data: AIPayload) {
  if (data.cmvPercentual !== undefined) {
    const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
    const labels: Record<string, string> = { rawMaterials: "matéria-prima", productionCenter: "central de produção", beverages: "bebidas", packaging: "embalagens" };
    const ranked = Object.entries(data.custos || {}).sort(([, a], [, b]) => Number(b) - Number(a));
    const largest = ranked[0] || ["rawMaterials", 0];
    const within = (data.cmvPercentual || 0) <= (data.metaCmvPercentual || 35);
    return {
      diagnostic: within
        ? `O CMV da semana está em ${Number(data.cmvPercentual).toFixed(1).replace(".", ",")}% e permanece dentro da meta definida.`
        : `O CMV da semana está em ${Number(data.cmvPercentual).toFixed(1).replace(".", ",")}% e ultrapassa a meta em ${Math.abs(data.desvioPontosPercentuais || 0).toFixed(1).replace(".", ",")} p.p.`,
      alert: `${labels[largest[0]] || largest[0]} é o maior grupo de custo lançado, com ${money(Number(largest[1]))}.`,
      numbers: [
        `Faturamento Takeat: ${money(data.faturamentoTakeat || 0)}`,
        `Custo total: ${money(data.custoTotal || 0)}`,
        `CMV: ${Number(data.cmvPercentual || 0).toFixed(1).replace(".", ",")}%`,
        `Meta: ${Number(data.metaCmvPercentual || 0).toFixed(1).replace(".", ",")}%`,
      ],
      actions: [
        `Auditar as compras de ${labels[largest[0]] || largest[0]} desta semana e conferir notas, perdas e transferências.`,
        "Comparar consumo real com fichas técnicas e registrar os três maiores desvios até a próxima conferência.",
        "Definir responsável e valor-alvo de redução para o maior grupo de custo antes do próximo fechamento.",
      ],
      tomorrow: `validar o gasto de ${labels[largest[0]] || largest[0]} e corrigir divergências antes de novas compras.`,
      demo: true,
    };
  }
  const gap = Number(data.gap || 0);
  const channels = [data.salao, data.delivery, data.ifood].filter((item): item is AIChannel => Boolean(item));
  const worst = [...channels].sort((a, b) => (a.realizado / a.meta) - (b.realizado / b.meta))[0];
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  return {
    diagnostic: gap >= 0
      ? `A unidade está ${money(gap)} acima da trajetória esperada e precisa proteger o ritmo até o fechamento.`
      : `A unidade está ${money(Math.abs(gap))} abaixo da trajetória esperada. A recuperação ainda depende de execução diária.`,
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
