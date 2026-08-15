"use client";

import { Bot, CalendarDays, CheckCircle2, ChevronRight, ClipboardEdit, Factory, Package, Save, Sparkles, Utensils, Wine } from "lucide-react";
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

function CmvRing({ percentage, target }: { percentage: number; target: number }) {
  const radius = 68;
  const circumference = Math.PI * 2 * radius;
  const visual = Math.min(percentage, 60) / 60;
  const tone = percentage <= target ? "healthy" : percentage <= target + 3 ? "attention" : "critical";
  return <div className={`cmv-ring cmv-${tone}`}>
    <svg viewBox="0 0 160 160" role="img" aria-label={`CMV de ${formatPercent(percentage)}`}>
      <circle cx="80" cy="80" r={radius} className="cmv-ring-track" />
      <circle cx="80" cy="80" r={radius} className="cmv-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - visual)} />
    </svg>
    <div><strong>{formatPercent(percentage)}</strong><span>CMV</span><small>Meta ≤ {formatPercent(target)}</small></div>
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
  const [month, setMonth] = useState(initialWeek.weekEnd.slice(0, 7));
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const revenue = useMemo(() => revenueForPeriod(sales, unit.id, period.weekStart, period.weekEnd), [sales, unit.id, period]);
  const metrics = useMemo(() => calculateCmv(costs, revenue, unit.cmvTargetPercent), [costs, revenue, unit.cmvTargetPercent]);
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
    setAi(null);
  };

  const editRecord = (record: CmvEntry) => {
    setSelectedDate(record.weekStart);
    setPeriod({ weekStart: record.weekStart, weekEnd: record.weekEnd });
    setMonth(record.referenceMonth);
    setEditingId(record.id);
    setCosts({ rawMaterials: record.rawMaterials, productionCenter: record.productionCenter, beverages: record.beverages, packaging: record.packaging });
    setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setSaving(true);
    const existing = records.find((record) => record.id === editingId);
    await onSave({
      id: `${unit.id}_${period.weekStart}`,
      unitId: unit.id,
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      referenceMonth: period.weekEnd.slice(0, 7),
      revenue,
      targetPercent: unit.cmvTargetPercent,
      ...costs,
      createdAt: existing?.createdAt || new Date().toISOString(),
      createdBy: existing?.createdBy,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(`${unit.id}_${period.weekStart}`);
    setSaving(false);
    setSaved(true);
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

  return <div className="screen-stack cmv-screen">
    <div className="page-title"><div><span className="eyebrow">Controle de custos</span><h1>CMV semanal</h1><p>Conferência de domingo a sábado com faturamento automático da Takeat.</p></div><label className="date-picker"><CalendarDays size={17} /><input type="date" value={selectedDate} onChange={(event) => selectDate(event.target.value)} /></label></div>

    <section className="cmv-period-bar surface-card"><div><span>Período da conferência</span><strong>{formatDateBR(period.weekStart)} <ChevronRight size={15} /> {formatDateBR(period.weekEnd)}</strong></div><div><span>Faturamento Takeat</span><strong>{formatMoney(revenue)}</strong><small>{revenue > 0 ? "Denominador automático · 7 dias" : "Sincronize as vendas deste período"}</small></div><span className="takeat-seal">T <small>automático</small></span></section>

    <section className="cmv-workspace">
      <div className="cmv-cost-panel surface-card"><div className="section-heading"><div><span className="eyebrow">Lançamento de custos</span><h2>{editingId ? "Editar conferência" : "Nova conferência"}</h2></div>{editingId && <span className="status-badge status-warning"><ClipboardEdit size={14} /> Edição</span>}</div>
        <div className="cmv-cost-grid">{costFields.map((field) => <label key={field.key}><span className="cmv-cost-icon">{field.icon}</span><span><b>{field.label}</b><small>Gasto nos 7 dias</small></span><div><i>R$</i><input min="0" step="0.01" inputMode="decimal" type="number" value={costs[field.key] || ""} placeholder="0,00" onChange={(event) => { setCosts({ ...costs, [field.key]: Math.max(Number(event.target.value), 0) }); setSaved(false); }} /></div></label>)}</div>
        <div className="cmv-save-row"><div><span>Custo total</span><strong>{formatMoney(metrics.totalCost)}</strong></div><button className="primary-button" onClick={() => void save()} disabled={saving || revenue <= 0}>{saving ? "Salvando..." : <><Save size={17} /> {editingId ? "Salvar alterações" : "Salvar conferência"}</>}</button></div>{saved && <p className="cmv-saved"><CheckCircle2 size={16} /> Conferência salva. Você pode editá-la a qualquer momento.</p>}
      </div>

      <aside className="cmv-result-card surface-card"><CmvRing percentage={metrics.percentage} target={unit.cmvTargetPercent} /><div className={`cmv-verdict cmv-${metrics.status}`}><strong>{metrics.status === "healthy" ? "CMV dentro da meta" : metrics.status === "attention" ? "CMV pede atenção" : metrics.status === "critical" ? "CMV acima do limite" : "Aguardando faturamento"}</strong><span>{metrics.variancePoints <= 0 ? `${formatPercent(Math.abs(metrics.variancePoints))} abaixo do limite` : `${formatPercent(metrics.variancePoints)} acima do limite`}</span></div><div className="cmv-breakdown">{costFields.map((field) => { const value = costs[field.key]; const share = metrics.totalCost ? (value / metrics.totalCost) * 100 : 0; return <div key={field.key}><span>{field.label}<b>{formatPercent(share)}</b></span><i><em style={{ width: `${share}%` }} /></i></div>; })}</div><button className="ai-primary cmv-ai-button" onClick={() => void analyze()} disabled={aiLoading || metrics.totalCost <= 0}><Sparkles size={17} /> {aiLoading ? "Analisando custos..." : "Analisar com House IA"}</button></aside>
    </section>

    {(ai || aiLoading) && <section className="cmv-ai-insight ai-card"><div className="ai-label"><Bot size={17} /> Insight de CMV integrado</div>{aiLoading ? <div className="analysis-skeleton"><i /><i /><i /></div> : ai && <><h2>{ai.diagnostic}</h2><p>{ai.alert}</p><div className="cmv-ai-grid"><div><span>Números-chave</span>{ai.numbers.map((item) => <b key={item}>{item}</b>)}</div><div><span>Plano recomendado</span>{ai.actions.map((item, index) => <p key={item}><b>{index + 1}</b>{item}</p>)}</div></div><strong className="cmv-tomorrow">Próximo foco: {ai.tomorrow}</strong></>}</section>}

    <section className="surface-card cmv-monthly"><div className="section-heading"><div><span className="eyebrow">CMV global por unidade</span><h2>Consolidado mensal</h2></div><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className="cmv-month-grid">{monthly.map(({ unit: item, metrics: itemMetrics }) => <article key={item.id}><div><strong>{item.shortName}</strong><span>{itemMetrics.weeks} semana{itemMetrics.weeks === 1 ? "" : "s"} conferida{itemMetrics.weeks === 1 ? "" : "s"}</span></div><b className={itemMetrics.percentage <= item.cmvTargetPercent ? "positive" : "negative"}>{formatPercent(itemMetrics.percentage)}</b><small>{formatMoney(itemMetrics.totalCost)} ÷ {formatMoney(itemMetrics.revenue)}</small><i><em style={{ width: `${Math.min((itemMetrics.percentage / Math.max(item.cmvTargetPercent, 1)) * 100, 100)}%` }} /></i></article>)}</div>{role !== "admin" && <p className="cmv-access-note">Seu perfil exibe somente a unidade vinculada.</p>}</section>

    <section className="surface-card cmv-history"><div className="section-heading"><div><span className="eyebrow">Histórico editável</span><h2>Conferências anteriores</h2></div></div>{unitRecords.length ? unitRecords.map((record) => { const item = calculateCmv(record, liveRevenue(record), record.targetPercent); return <button key={record.id} onClick={() => editRecord(record)}><span><b>{formatDateBR(record.weekStart)} a {formatDateBR(record.weekEnd)}</b><small>Atualizado em {new Date(record.updatedAt).toLocaleDateString("pt-BR")}</small></span><span><b className={item.percentage <= record.targetPercent ? "positive" : "negative"}>{formatPercent(item.percentage)}</b><small>{formatMoney(item.totalCost)} de custo</small></span><ClipboardEdit size={18} /></button>; }) : <div className="empty-cmv">Nenhuma conferência salva para esta unidade.</div>}</section>
  </div>;
}
