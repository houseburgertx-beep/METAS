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
};

export function buildDemoAnalysis(data: AIPayload) {
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
