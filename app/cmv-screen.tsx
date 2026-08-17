"use client";

import { Bot, CalendarDays, CheckCircle2, ChevronRight, ClipboardEdit, Factory, Gauge, Package, Save, Sparkles, TrendingDown, Utensils, WalletCards, Wine } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateCmv, emptyCmvCosts, monthlyCmv, revenueForPeriod, weekFromDate } from "@/lib/cmv-calculations";
import { formatDateBR, formatMoney, formatPercent } from "@/lib/format";
import type { CmvCosts, CmvEntry, SalesEntry, UnitConfig, UserRole } from "@/lib/types";

type AIResult = { diagnostic: string; alert: string; numbers: string[]; actions: string[]; tomorrow: string; demo?: boolean };

const costFields: Array<{ key: keyof CmvCosts; label: string; icon: React.ReactNode }> = [
  { key: "rawMaterials", label: "Matéria-prima", icon: <Utensils size={19} /> },
  { key: "productionCenter", label: "Central de produção", icon: <Factory size={19} /> },
  { key: "beverages", label: "Bebidas", icon: <Wine size={19} /> },
  { key: "packaging", label: "Embalagens", icon: <Package size={19} /> },
];

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function CmvRing({ percentage, target, empty = false }: { percentage: number; target: number; empty?: boolean }) {
  const radius = 68;
  const circumference = Math.PI * 2 * radius;
  const visual = empty ? 0.07 : Math.min(percentage, 60) / 60;
  const tone = percentage <= target ? "healthy" : percentage <= target + 3 ? "attention" : "critical";
  return <div className={`cmv-ring cmv-${empty ? "empty" : tone}`}>
    <svg viewBox="0 0 160 160" role="img" aria-label={empty ? "CMV aguardando custos" : `CMV de ${formatPercent(percentage)}`}>
      <circle cx="80" cy="80" r={radius} className="cmv-ring-track" />
      <circle cx="80" cy="80" r={radius} className="cmv-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - visual)} />
    </svg>
    <div><strong>{empty ? "—" : formatPercent(percentage)}</strong><span>CMV</span><small>Meta ≤ {formatPercent(target)}</small></div>
  </div>;
}

export function CmvScreen({ unit, units, sales, records, role, onSave }: {
  unit: UnitConfig;
  units: UnitConfig[];
  sales: SalesEntry[];
  records: CmvEntry[];
  role: UserRole;
  onSave: (entry: CmvEntry) => Promise<void>;
}) {
  const initialWeek = weekFromDate(todayIso());
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [period, setPeriod] = useState(initialWeek);
  const [costs, setCosts] = useState<CmvCosts>(emptyCmvCosts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [month, setMonth] = useState(initialWeek.weekEnd.slice(0, 7));
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const revenue = useMemo(() => revenueForPeriod(sales, unit.id, period.weekStart, period.weekEnd), [sales, unit.id, period]);
  const metrics = useMemo(() => calculateCmv(costs, revenue, unit.cmvTargetPercent), [costs, revenue, unit.cmvTargetPercent]);
  const hasCosts = metrics.totalCost > 0;
  const unitRecords = records.filter((record) => record.unitId === unit.id);
  const liveRevenue = (record: CmvEntry) => {
    const hasLoadedPeriod = sales.some((sale) => sale.unitId === record.unitId && sale.date >= record.weekStart && sale.date <= record.weekEnd);
    return hasLoadedPeriod ? revenueForPeriod(sales, record.unitId, record.weekStart, record.weekEnd) : record.revenue;
  };
  const liveRecords = records.map((record) => ({ ...record, revenue: liveRevenue(record) }));
  const monthly = units.map((item) => ({ unit: item, metrics: monthlyCmv(liveRecords, item, month) }));

  const selectDate = (date: string) => {
    const next = weekFromDate(date);
    const existing = unitRecords.find((record) => record.weekStart === next.weekStart);
    setSelectedDate(date);
    setPeriod(next);
    setMonth(next.weekEnd.slice(0, 7));
    setEditingId(existing?.id || null);
    setCosts(existing ? {
      rawMaterials: existing.rawMaterials,
      productionCenter: existing.productionCenter,
      beverages: existing.beverages,
      packaging: existing.packaging,
    } : emptyCmvCosts());
    setSaved(false);
    setSaveError("");
    setAi(null);
  };

  const editRecord = (record: CmvEntry) => {
    setSelectedDate(record.weekStart);
    setPeriod({ weekStart: record.weekStart, weekEnd: record.weekEnd });
    setMonth(record.referenceMonth);
    setEditingId(record.id);
    setCosts({ rawMaterials: record.rawMaterials, productionCenter: record.productionCenter, beverages: record.beverages, packaging: record.packaging });
    setSaved(false);
    setSaveError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const existing = records.find((record) => record.id === editingId);
      const entryToSave: CmvEntry = {
        id: `${unit.id}_${period.weekStart}`,
        unitId: unit.id,
        weekStart: period.weekStart,
        weekEnd: period.weekEnd,
        referenceMonth: period.weekEnd.slice(0, 7),
        revenue,
        targetPercent: unit.cmvTargetPercent,
        ...costs,
        createdAt: existing?.createdAt || new Date().toISOString(),
        ...(existing?.createdBy ? { createdBy: existing.createdBy } : {}),
        updatedAt: new Date().toISOString(),
      };
      await onSave(entryToSave);
      setEditingId(`${unit.id}_${period.weekStart}`);
      setSaved(true);
    } catch (err) {
      console.error("Erro ao salvar conferência de CMV:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("permission-denied") || msg.includes("permissões")) {
        setSaveError("Não foi possível salvar o CMV por falta de permissão no banco de dados. Verifique as regras do Firestore.");
      } else if (msg) {
        setSaveError(`Não foi possível salvar o CMV: ${msg}`);
      } else {
        setSaveError("Não foi possível salvar o CMV. Atualize a página e tente novamente; se persistir, as permissões do banco precisam ser publicadas.");
      }
    } finally {
      setSaving(false);
    }
  };

  const analyze = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        solicitacao: "Analisar CMV semanal e recomendar ações de redução de custo",
        unidade: unit.name,
        periodo: `${period.weekStart} a ${period.weekEnd}`,
        faturamentoTakeat: revenue,
        cmvPercentual: metrics.percentage,
        metaCmvPercentual: unit.cmvTargetPercent,
        desvioPontosPercentuais: metrics.variancePoints,
        custoTotal: metrics.totalCost,
        custos: costs,
      }) });
      const result = await response.json() as AIResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Análise indisponível");
      setAi(result);
    } catch {
      setAi({ diagnostic: "Não foi possível consultar a IA agora.", alert: "Os cálculos do CMV continuam disponíveis.", numbers: [], actions: [], tomorrow: "Revise os maiores grupos de custo e tente novamente." });
    } finally { setAiLoading(false); }
  };

  const verdictTitle = !hasCosts ? "Pronto para calcular" : metrics.status === "healthy" ? "CMV dentro da meta" : metrics.status === "attention" ? "CMV pede atenção" : metrics.status === "critical" ? "CMV acima do limite" : "Aguardando faturamento";
  const verdictDetail = !hasCosts ? "Preencha os custos da semana" : metrics.variancePoints <= 0 ? `${formatPercent(Math.abs(metrics.variancePoints))} abaixo do limite` : `${formatPercent(metrics.variancePoints)} acima do limite`;

  return <div className="screen-stack cmv-screen cmv-v2">
    <section className="cmv-hero">
      <div className="cmv-hero-orb cmv-hero-orb-one" /><div className="cmv-hero-orb cmv-hero-orb-two" />
      <div className="cmv-hero-copy">
        <span className="cmv-kicker"><Gauge size={15} /> Inteligência de custos</span>
        <h1>CMV semanal</h1>
        <p>Domingo a sábado, com faturamento sincronizado automaticamente.</p>
        <label className="cmv-date-control"><CalendarDays size={17} /><span>Data da conferência</span><input aria-label="Data da conferência" type="date" value={selectedDate} onChange={(event) => selectDate(event.target.value)} /></label>
        <div className="cmv-period-inline"><span>{formatDateBR(period.weekStart)}</span><ChevronRight size={15} /><span>{formatDateBR(period.weekEnd)}</span><b>7 dias</b></div>
      </div>
      <div className="cmv-hero-result">
        <CmvRing percentage={metrics.percentage} target={unit.cmvTargetPercent} empty={!hasCosts} />
        <div className={`cmv-hero-verdict cmv-${hasCosts ? metrics.status : "empty"}`}><strong>{verdictTitle}</strong><span>{verdictDetail}</span></div>
      </div>
      <div className="cmv-revenue-strip">
        <span className="takeat-mark">T</span>
        <div><span>Faturamento Takeat</span><strong>{formatMoney(revenue)}</strong></div>
        <small>{revenue > 0 ? <><CheckCircle2 size={14} /> Sincronizado</> : "Sem vendas no período"}</small>
      </div>
    </section>

    <section className="cmv-workspace">
      <div className="cmv-cost-panel surface-card"><div className="section-heading"><div><span className="eyebrow">Composição do custo</span><h2>{editingId ? "Editar conferência" : "Lançar custos"}</h2><p>Informe o total gasto em cada categoria durante a semana.</p></div>{editingId && <span className="status-badge status-warning"><ClipboardEdit size={14} /> Editando</span>}</div>
        <div className="cmv-cost-grid">{costFields.map((field, index) => <label key={field.key} className={`cmv-cost-tile cmv-cost-${index + 1}`}><span className="cmv-cost-icon">{field.icon}</span><span className="cmv-cost-name"><b>{field.label}</b><small>Acumulado de 7 dias</small></span><div className="cmv-money-input"><i>R$</i><input aria-label={`Custo de ${field.label}`} min="0" step="0.01" inputMode="decimal" type="number" value={costs[field.key] || ""} placeholder="0,00" onChange={(event) => { setCosts({ ...costs, [field.key]: Math.max(Number(event.target.value), 0) }); setSaved(false); }} /></div></label>)}</div>
        <div className="cmv-save-row"><div><span>Custo total da semana</span><strong>{formatMoney(metrics.totalCost)}</strong><small>{hasCosts && revenue > 0 ? `${formatPercent(metrics.percentage)} do faturamento` : "Atualizado em tempo real"}</small></div><button className="primary-button" onClick={() => void save()} disabled={saving || revenue <= 0}>{saving ? "Salvando..." : <><Save size={17} /> {editingId ? "Salvar alterações" : "Salvar conferência"}</>}</button></div>{saved && <p className="cmv-saved"><CheckCircle2 size={16} /> Conferência salva. Você pode editá-la a qualquer momento.</p>}{saveError && <p className="sync-error">{saveError}</p>}
      </div>

      <aside className="cmv-live-panel surface-card">
        <div className="cmv-live-heading"><div><span className="eyebrow">Leitura instantânea</span><h2>Composição do CMV</h2></div><span className="cmv-live-dot">Ao vivo</span></div>
        <div className="cmv-breakdown">{costFields.map((field, index) => { const value = costs[field.key]; const share = metrics.totalCost ? (value / metrics.totalCost) * 100 : 0; return <div key={field.key}><span><i className={`cmv-breakdown-dot dot-${index + 1}`} />{field.label}<b>{hasCosts ? formatPercent(share) : "—"}</b></span><div className="cmv-breakdown-track"><em style={{ width: `${share}%` }} /></div><small>{formatMoney(value)}</small></div>; })}</div>
        <div className="cmv-ai-launch"><span><Sparkles size={16} /> House IA</span><h3>Transforme números em decisões.</h3><p>Receba diagnóstico, alertas e um plano prático para reduzir o CMV.</p><button className="ai-primary cmv-ai-button" onClick={() => void analyze()} disabled={aiLoading || !hasCosts}><Sparkles size={17} /> {aiLoading ? "Analisando custos..." : "Gerar análise inteligente"}</button></div>
      </aside>
    </section>

    {(ai || aiLoading) && <section className="cmv-ai-insight ai-card"><div className="ai-label"><Bot size={17} /> Insight de CMV integrado</div>{aiLoading ? <div className="analysis-skeleton"><i /><i /><i /></div> : ai && <><h2>{ai.diagnostic}</h2><p>{ai.alert}</p><div className="cmv-ai-grid"><div><span>Números-chave</span>{ai.numbers.map((item) => <b key={item}>{item}</b>)}</div><div><span>Plano recomendado</span>{ai.actions.map((item, index) => <p key={item}><b>{index + 1}</b>{item}</p>)}</div></div><strong className="cmv-tomorrow">Próximo foco: {ai.tomorrow}</strong></>}</section>}

    <section className="surface-card cmv-monthly"><div className="section-heading"><div><span className="eyebrow">Visão executiva</span><h2>CMV global por unidade</h2><p>Consolidado do mês com base nas semanas conferidas.</p></div><label className="cmv-month-control"><CalendarDays size={16} /><input aria-label="Mês do consolidado" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div><div className="cmv-month-grid">{monthly.map(({ unit: item, metrics: itemMetrics }, index) => { const hasMonthData = itemMetrics.weeks > 0; return <article key={item.id} className={`cmv-unit-card unit-${index + 1}`}><span className="cmv-unit-index">0{index + 1}</span><div className="cmv-unit-name"><strong>{item.shortName}</strong><span>{hasMonthData ? `${itemMetrics.weeks} semana${itemMetrics.weeks === 1 ? "" : "s"} conferida${itemMetrics.weeks === 1 ? "" : "s"}` : "Aguardando conferência"}</span></div><div className="cmv-unit-metric"><b className={hasMonthData ? itemMetrics.percentage <= item.cmvTargetPercent ? "positive" : "negative" : "neutral"}>{hasMonthData ? formatPercent(itemMetrics.percentage) : "—"}</b><small>{hasMonthData ? `${formatMoney(itemMetrics.totalCost)} ÷ ${formatMoney(itemMetrics.revenue)}` : `Meta ≤ ${formatPercent(item.cmvTargetPercent)}`}</small></div><div className="cmv-unit-progress"><i><em style={{ width: hasMonthData ? `${Math.min((itemMetrics.percentage / Math.max(item.cmvTargetPercent, 1)) * 100, 100)}%` : "0%" }} /></i><span>{hasMonthData ? itemMetrics.percentage <= item.cmvTargetPercent ? "Dentro da meta" : "Acima da meta" : "Sem dados"}</span></div></article>; })}</div>{role !== "admin" && <p className="cmv-access-note">Seu perfil exibe somente a unidade vinculada.</p>}</section>

    <section className="surface-card cmv-history"><div className="section-heading"><div><span className="eyebrow">Histórico editável</span><h2>Conferências anteriores</h2><p>Abra qualquer semana para revisar ou corrigir os valores.</p></div></div>{unitRecords.length ? unitRecords.map((record) => { const item = calculateCmv(record, liveRevenue(record), record.targetPercent); return <button key={record.id} onClick={() => editRecord(record)}><span><b>{formatDateBR(record.weekStart)} a {formatDateBR(record.weekEnd)}</b><small>Atualizado em {new Date(record.updatedAt).toLocaleDateString("pt-BR")}</small></span><span><b className={item.percentage <= record.targetPercent ? "positive" : "negative"}>{formatPercent(item.percentage)}</b><small>{formatMoney(item.totalCost)} de custo</small></span><ClipboardEdit size={18} /></button>; }) : <div className="empty-cmv"><span><WalletCards size={24} /></span><div><strong>Sua primeira análise começa aqui</strong><p>Preencha os custos da semana e salve a conferência. O histórico aparecerá neste espaço.</p></div><TrendingDown size={22} /></div>}</section>
  </div>;
}
