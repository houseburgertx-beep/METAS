"use client";

import {
  AlertTriangle,
  Bot,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardEdit,
  Copy,
  Factory,
  Gauge,
  Info,
  Package,
  PlusCircle,
  Save,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  WalletCards,
  Wine,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { requestAiAnalysis, type AIResult } from "@/lib/ai-service";
import {
  calculateCmv,
  emptyCmvCosts,
  monthlyCmv,
  revenueForPeriod,
  weekFromDate,
  weeksInMonth,
} from "@/lib/cmv-calculations";
import { formatDateBR, formatMoney, formatPercent } from "@/lib/format";
import {
  calculateCmvBonusImpact,
  detectCostAnomalies,
  generateCmvWhatsAppText,
} from "@/lib/smart-features";
import type { CmvCosts, CmvEntry, SalesEntry, UnitConfig, UserRole } from "@/lib/types";

const costFields: Array<{ key: keyof CmvCosts; label: string; icon: React.ReactNode; color: string }> = [
  { key: "rawMaterials", label: "Matéria-prima", icon: <Utensils size={18} />, color: "var(--brand)" },
  { key: "productionCenter", label: "Central de produção", icon: <Factory size={18} />, color: "#8b5cf6" },
  { key: "beverages", label: "Bebidas", icon: <Wine size={18} />, color: "#06b6d4" },
  { key: "packaging", label: "Embalagens", icon: <Package size={18} />, color: "#f59e0b" },
];

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function CmvRing({ percentage, target, empty = false }: { percentage: number; target: number; empty?: boolean }) {
  const radius = 64;
  const circumference = Math.PI * 2 * radius;
  const visual = empty ? 0.05 : Math.min(percentage, 60) / 60;
  const tone = percentage <= target ? "healthy" : percentage <= target + 3 ? "attention" : "critical";
  return (
    <div className={`cmv-ring cmv-${empty ? "empty" : tone}`}>
      <svg viewBox="0 0 160 160" role="img" aria-label={empty ? "CMV aguardando custos" : `CMV de ${formatPercent(percentage)}`}>
        <circle cx="80" cy="80" r={radius} className="cmv-ring-track" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          className="cmv-ring-value"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - visual)}
        />
      </svg>
      <div>
        <strong>{empty ? "—" : formatPercent(percentage)}</strong>
        <span>CMV</span>
        <small>Meta ≤ {formatPercent(target)}</small>
      </div>
    </div>
  );
}

export function CmvScreen({
  unit,
  units,
  sales,
  records,
  role,
  onSave,
}: {
  unit: UnitConfig;
  units: UnitConfig[];
  sales: SalesEntry[];
  records: CmvEntry[];
  role: UserRole;
  onSave: (entry: CmvEntry) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const initialWeek = weekFromDate(todayIso());
  const [period, setPeriod] = useState(initialWeek);
  const [costs, setCosts] = useState<CmvCosts>(emptyCmvCosts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(todayIso().slice(0, 7));
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Period calculations
  const revenue = useMemo(
    () => revenueForPeriod(sales, unit.id, period.weekStart, period.weekEnd),
    [sales, unit.id, period]
  );
  const metrics = useMemo(
    () => calculateCmv(costs, revenue, unit.cmvTargetPercent),
    [costs, revenue, unit.cmvTargetPercent]
  );
  const hasCosts = metrics.totalCost > 0;
  const unitRecords = records.filter((record) => record.unitId === unit.id);

  const liveRevenue = (record: CmvEntry) => {
    const hasLoadedPeriod = sales.some(
      (sale) => sale.unitId === record.unitId && sale.date >= record.weekStart && sale.date <= record.weekEnd
    );
    return hasLoadedPeriod ? revenueForPeriod(sales, record.unitId, record.weekStart, record.weekEnd) : record.revenue;
  };
  const liveRecords = records.map((record) => ({ ...record, revenue: liveRevenue(record) }));

  // Monthly calculations for current unit
  const currentUnitMonthMetrics = useMemo(
    () => monthlyCmv(liveRecords, unit, selectedMonth),
    [liveRecords, unit, selectedMonth]
  );
  // Default 4 clean weeks of the selected month
  const monthWeeks = useMemo(() => weeksInMonth(selectedMonth), [selectedMonth]);

  // Monthly across all units
  const monthlyByUnit = units.map((item) => ({
    unit: item,
    metrics: monthlyCmv(liveRecords, item, selectedMonth),
  }));

  // Smart Features: Semáforo de Bônus e Detecção de Anomalias
  const bonusImpact = useMemo(
    () => calculateCmvBonusImpact(metrics.percentage, revenue, metrics.totalCost, unit.cmvTargetPercent, 2000),
    [metrics, revenue, unit.cmvTargetPercent]
  );
  const anomalies = useMemo(() => detectCostAnomalies(costs, unitRecords), [costs, unitRecords]);

  const setCustomPeriod = (newStart: string, newEnd: string) => {
    const existing = unitRecords.find((record) => record.weekStart === newStart);
    setPeriod({ weekStart: newStart, weekEnd: newEnd });
    setSelectedMonth(newStart.slice(0, 7));
    setEditingId(existing?.id || null);
    setCosts(
      existing
        ? {
            rawMaterials: existing.rawMaterials,
            productionCenter: existing.productionCenter,
            beverages: existing.beverages,
            packaging: existing.packaging,
          }
        : emptyCmvCosts()
    );
    setSaved(false);
    setSaveError("");
    setAi(null);
  };

  const editRecord = (record: CmvEntry) => {
    setPeriod({ weekStart: record.weekStart, weekEnd: record.weekEnd });
    setSelectedMonth(record.referenceMonth || record.weekEnd.slice(0, 7));
    setEditingId(record.id);
    setCosts({
      rawMaterials: record.rawMaterials,
      productionCenter: record.productionCenter,
      beverages: record.beverages,
      packaging: record.packaging,
    });
    setSaved(false);
    setSaveError("");
    setActiveTab("weekly");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openWeek = (weekStart: string, weekEnd: string) => {
    const existing = unitRecords.find((record) => record.weekStart === weekStart);
    setPeriod({ weekStart, weekEnd });
    setEditingId(existing?.id || null);
    setCosts(
      existing
        ? {
            rawMaterials: existing.rawMaterials,
            productionCenter: existing.productionCenter,
            beverages: existing.beverages,
            packaging: existing.packaging,
          }
        : emptyCmvCosts()
    );
    setSaved(false);
    setSaveError("");
    setActiveTab("weekly");
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
        referenceMonth: period.weekStart.slice(0, 7),
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
        setSaveError("Não foi possível salvar o CMV por falta de permissão no banco de dados.");
      } else if (msg) {
        setSaveError(`Não foi possível salvar o CMV: ${msg}`);
      } else {
        setSaveError("Não foi possível salvar o CMV. Atualize a página e tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = () => {
    const text = generateCmvWhatsAppText({
      unitName: unit.name,
      periodStart: period.weekStart,
      periodEnd: period.weekEnd,
      revenue,
      costs,
      cmvPercent: metrics.percentage,
      targetPercent: unit.cmvTargetPercent,
    });
    void navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const result = await requestAiAnalysis({
        solicitacao:
          activeTab === "weekly"
            ? "Analisar CMV semanal e recomendar ações de redução de custo"
            : "Analisar CMV consolidado do mês e recomendar plano de ação",
        unidade: unit.name,
        periodo: activeTab === "weekly" ? `${period.weekStart} a ${period.weekEnd}` : selectedMonth,
        faturamentoTakeat: activeTab === "weekly" ? revenue : currentUnitMonthMetrics.revenue,
        cmvPercentual: activeTab === "weekly" ? metrics.percentage : currentUnitMonthMetrics.percentage,
        metaCmvPercentual: unit.cmvTargetPercent,
        desvioPontosPercentuais:
          activeTab === "weekly" ? metrics.variancePoints : currentUnitMonthMetrics.variancePoints,
        custoTotal: activeTab === "weekly" ? metrics.totalCost : currentUnitMonthMetrics.totalCost,
        custos:
          activeTab === "weekly"
            ? costs
            : {
                rawMaterials: currentUnitMonthMetrics.rawMaterials,
                productionCenter: currentUnitMonthMetrics.productionCenter,
                beverages: currentUnitMonthMetrics.beverages,
                packaging: currentUnitMonthMetrics.packaging,
              },
      });
      setAi(result);
    } catch {
      setAi({
        diagnostic: "Não foi possível consultar a IA agora.",
        alert: "Os cálculos do CMV continuam disponíveis.",
        numbers: [],
        actions: [],
        tomorrow: "Revise os maiores grupos de custo e tente novamente.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const verdictTitle = !hasCosts
    ? "Pronto para calcular"
    : metrics.status === "healthy"
      ? "CMV dentro da meta"
      : metrics.status === "attention"
        ? "CMV pede atenção"
        : metrics.status === "critical"
          ? "CMV acima do limite"
          : "Aguardando faturamento";

  const verdictDetail = !hasCosts
    ? "Preencha os custos do período"
    : metrics.variancePoints <= 0
      ? `${formatPercent(Math.abs(metrics.variancePoints))} abaixo do limite`
      : `${formatPercent(metrics.variancePoints)} acima do limite`;

  return (
    <div className="screen-stack cmv-screen cmv-v2">
      {/* Top Tab Navigator: Semana vs Mês */}
      <div className="cmv-view-switch" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "weekly"}
          className={`cmv-tab-btn ${activeTab === "weekly" ? "active" : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          <Calendar size={18} />
          <span>Conferência de Período / Semana</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "monthly"}
          className={`cmv-tab-btn ${activeTab === "monthly" ? "active" : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          <Gauge size={18} />
          <span>Consolidado do Mês (4 Semanas)</span>
        </button>
      </div>

      {activeTab === "weekly" ? (
        <>
          {/* Hero de Conferência com Datas Flexíveis */}
          <section className="cmv-hero">
            <div className="cmv-hero-orb cmv-hero-orb-one" />
            <div className="cmv-hero-orb cmv-hero-orb-two" />
            <div className="cmv-hero-copy">
              <span className="cmv-kicker"><Gauge size={15} /> Inteligência de custos</span>
              <h1>Conferência de CMV</h1>
              <p>Escolha o período livremente com faturamento Takeat sincronizado.</p>
              
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
                <label className="cmv-date-control">
                  <CalendarDays size={17} />
                  <span>Data Início</span>
                  <input
                    aria-label="Data de início"
                    type="date"
                    value={period.weekStart}
                    onChange={(event) => setCustomPeriod(event.target.value, period.weekEnd)}
                  />
                </label>
                <label className="cmv-date-control">
                  <CalendarDays size={17} />
                  <span>Data Fim</span>
                  <input
                    aria-label="Data de fim"
                    type="date"
                    value={period.weekEnd}
                    onChange={(event) => setCustomPeriod(period.weekStart, event.target.value)}
                  />
                </label>
              </div>

              <div className="cmv-period-inline">
                <span>{formatDateBR(period.weekStart)}</span>
                <ChevronRight size={15} />
                <span>{formatDateBR(period.weekEnd)}</span>
                <b>Período selecionado</b>
              </div>
            </div>
            <div className="cmv-hero-result">
              <CmvRing percentage={metrics.percentage} target={unit.cmvTargetPercent} empty={!hasCosts} />
              <div className={`cmv-hero-verdict cmv-${hasCosts ? metrics.status : "empty"}`}>
                <strong>{verdictTitle}</strong>
                <span>{verdictDetail}</span>
              </div>
            </div>
            <div className="cmv-revenue-strip">
              <span className="takeat-mark">T</span>
              <div>
                <span>Faturamento Takeat</span>
                <strong>{formatMoney(revenue)}</strong>
              </div>
              <small>{revenue > 0 ? <><CheckCircle2 size={14} /> Sincronizado</> : "Sem vendas no período"}</small>
            </div>
          </section>

          {/* Semáforo do Impacto no Bônus */}
          {hasCosts && revenue > 0 && (
            <section className={`cmv-bonus-semaphore surface-card tone-${bonusImpact.statusTone}`}>
              <div className="semaphore-icon">
                {bonusImpact.isBlocked ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
              </div>
              <div className="semaphore-body">
                <div className="semaphore-head">
                  <span className="eyebrow">Impacto no Bônus</span>
                  <span className={`status-badge status-${bonusImpact.statusTone}`}>
                    {bonusImpact.statusLabel}
                  </span>
                </div>
                <h3>{bonusImpact.actionAdvice}</h3>
                <div className="semaphore-kpis">
                  <div>
                    <span>Teto de CMV:</span>
                    <strong>≤ {formatPercent(unit.cmvTargetPercent)}</strong>
                  </div>
                  <div>
                    <span>CMV Atual:</span>
                    <strong className={bonusImpact.isBlocked ? "negative" : "positive"}>
                      {formatPercent(metrics.percentage)}
                    </strong>
                  </div>
                  <div>
                    <span>{bonusImpact.isBlocked ? "Custo a cortar:" : "Margem de folga:"}</span>
                    <strong className={bonusImpact.isBlocked ? "negative" : "positive"}>
                      {bonusImpact.isBlocked ? formatMoney(bonusImpact.excessReais) : formatMoney(bonusImpact.marginReais)}
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Workspace de Custos */}
          <section className="cmv-workspace">
            <div className="cmv-cost-panel surface-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Composição do custo</span>
                  <h2>{editingId ? "Editar conferência" : "Lançar custos do período"}</h2>
                  <p>Informe o valor gasto em cada categoria durante o período.</p>
                </div>
                {editingId && <span className="status-badge status-warning"><ClipboardEdit size={14} /> Editando</span>}
              </div>

              <div className="cmv-cost-grid">
                {costFields.map((field, index) => {
                  const anomaly = anomalies.find((a) => a.key === field.key);
                  return (
                    <label key={field.key} className={`cmv-cost-tile cmv-cost-${index + 1}`}>
                      <span className="cmv-cost-icon">{field.icon}</span>
                      <span className="cmv-cost-name">
                        <b>{field.label}</b>
                        <small>Acumulado do período</small>
                      </span>
                      <div className="cmv-money-input">
                        <i>R$</i>
                        <input
                          aria-label={`Custo de ${field.label}`}
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          type="number"
                          value={costs[field.key] || ""}
                          placeholder="0,00"
                          onChange={(event) => {
                            setCosts({ ...costs, [field.key]: Math.max(Number(event.target.value), 0) });
                            setSaved(false);
                          }}
                        />
                      </div>
                      {anomaly?.isAnomaly && (
                        <div className="cost-anomaly-warning">
                          <AlertTriangle size={12} />
                          <span>Salto atípico (+{formatPercent(anomaly.differencePoints)})</span>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="cmv-save-row">
                <div>
                  <span>Custo total do período</span>
                  <strong>{formatMoney(metrics.totalCost)}</strong>
                  <small>{hasCosts && revenue > 0 ? `${formatPercent(metrics.percentage)} do faturamento Takeat` : "Atualizado em tempo real"}</small>
                </div>
                <div className="cmv-save-actions">
                  <button
                    type="button"
                    className="secondary-button cmv-share-btn"
                    onClick={shareWhatsApp}
                    disabled={revenue <= 0}
                    title="Compartilhar fechamento no WhatsApp"
                  >
                    <Share2 size={16} /> {copiedWhatsApp ? "Copiado!" : "WhatsApp"}
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => void save()}
                    disabled={saving || revenue <= 0}
                  >
                    {saving ? "Salvando..." : <><Save size={17} /> {editingId ? "Salvar alterações" : "Salvar conferência"}</>}
                  </button>
                </div>
              </div>
              {saved && (
                <p className="cmv-saved">
                  <CheckCircle2 size={16} /> Conferência salva no Firebase com sucesso!
                </p>
              )}
              {saveError && <p className="sync-error">{saveError}</p>}
            </div>

            {/* Painel lateral de Breakdown e IA */}
            <aside className="cmv-live-panel surface-card">
              <div className="cmv-live-heading">
                <div>
                  <span className="eyebrow">Leitura instantânea</span>
                  <h2>Distribuição dos Custos</h2>
                </div>
                <span className="cmv-live-dot">Ao vivo</span>
              </div>
              <div className="cmv-breakdown">
                {costFields.map((field, index) => {
                  const value = costs[field.key];
                  const share = metrics.totalCost ? (value / metrics.totalCost) * 100 : 0;
                  return (
                    <div key={field.key}>
                      <span>
                        <i className={`cmv-breakdown-dot dot-${index + 1}`} />
                        {field.label}
                        <b>{hasCosts ? formatPercent(share) : "—"}</b>
                      </span>
                      <div className="cmv-breakdown-track">
                        <em style={{ width: `${share}%` }} />
                      </div>
                      <small>{formatMoney(value)}</small>
                    </div>
                  );
                })}
              </div>
              <div className="cmv-ai-launch">
                <span><Sparkles size={16} /> House IA</span>
                <h3>Consultoria Estratégica de Custos</h3>
                <p>Receba diagnóstico, maior ofensor e plano de ação em 3 passos para reduzir seu CMV.</p>
                <button
                  className="ai-primary cmv-ai-button"
                  onClick={() => void runAiAnalysis()}
                  disabled={aiLoading || !hasCosts}
                >
                  <Sparkles size={17} /> {aiLoading ? "Analisando custos..." : "Gerar análise inteligente"}
                </button>
              </div>
            </aside>
          </section>

          {/* Resultado da IA */}
          {(ai || aiLoading) && (
            <section className="cmv-ai-insight ai-card">
              <div className="ai-label"><Bot size={17} /> Diagnóstico House IA</div>
              {aiLoading ? (
                <div className="analysis-skeleton"><i /><i /><i /></div>
              ) : ai && (
                <>
                  <h2>{ai.diagnostic}</h2>
                  <p className="cmv-ai-alert">{ai.alert}</p>
                  <div className="cmv-ai-grid">
                    <div>
                      <span>Números-chave</span>
                      {ai.numbers.map((item) => <b key={item}>{item}</b>)}
                    </div>
                    <div>
                      <span>Plano de ação recomendado</span>
                      {ai.actions.map((item, index) => <p key={item}><b>{index + 1}</b>{item}</p>)}
                    </div>
                  </div>
                  <strong className="cmv-tomorrow">Foco prioritário: {ai.tomorrow}</strong>
                </>
              )}
            </section>
          )}

          {/* Histórico das conferências cadastradas */}
          <section className="surface-card cmv-history">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Histórico da unidade</span>
                <h2>Conferências cadastradas ({unitRecords.length})</h2>
                <p>Abra qualquer conferência para revisar ou editar os lançamentos.</p>
              </div>
            </div>
            {unitRecords.length ? (
              unitRecords.map((record) => {
                const item = calculateCmv(record, liveRevenue(record), record.targetPercent);
                return (
                  <button key={record.id} onClick={() => editRecord(record)}>
                    <span>
                      <b>{formatDateBR(record.weekStart)} a {formatDateBR(record.weekEnd)}</b>
                      <small>Atualizado em {new Date(record.updatedAt).toLocaleDateString("pt-BR")}</small>
                    </span>
                    <span>
                      <b className={item.percentage <= record.targetPercent ? "positive" : "negative"}>
                        {formatPercent(item.percentage)}
                      </b>
                      <small>{formatMoney(item.totalCost)} de custo</small>
                    </span>
                    <ClipboardEdit size={18} />
                  </button>
                );
              })
            ) : (
              <div className="empty-cmv">
                <span><WalletCards size={24} /></span>
                <div>
                  <strong>Nenhuma conferência salva ainda</strong>
                  <p>Preencha os custos do período acima e clique em salvar para registrar o histórico.</p>
                </div>
                <TrendingDown size={22} />
              </div>
            )}
          </section>
        </>
      ) : (
        /* VISÃO MENSAL CONSOLIDADA (4 SEMANAS PADRÃO) */
        <>
          {/* Header do Mês com Seletor */}
          <section className="cmv-month-hero surface-card">
            <div className="cmv-month-hero-head">
              <div>
                <span className="eyebrow">Consolidado Mensal</span>
                <h1>Performance do Mês (4 Semanas)</h1>
                <p>Visão integrada das 4 semanas de {selectedMonth}.</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label className="cmv-month-control">
                  <CalendarDays size={18} />
                  <span>Mês de referência</span>
                  <input
                    aria-label="Mês do consolidado"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </label>
              </div>
            </div>

            {/* KPIs do Mês */}
            <div className="cmv-month-kpis">
              <article className="cmv-kpi-card highlight">
                <div className="cmv-kpi-top">
                  <span>CMV Acumulado do Mês</span>
                  <span className={`status-badge status-${currentUnitMonthMetrics.status === "healthy" ? "success" : currentUnitMonthMetrics.status === "attention" ? "warning" : "danger"}`}>
                    Meta ≤ {formatPercent(unit.cmvTargetPercent)}
                  </span>
                </div>
                <strong className={currentUnitMonthMetrics.weeks ? (currentUnitMonthMetrics.percentage <= unit.cmvTargetPercent ? "positive" : "negative") : ""}>
                  {currentUnitMonthMetrics.weeks ? formatPercent(currentUnitMonthMetrics.percentage) : "—"}
                </strong>
                <small>
                  {currentUnitMonthMetrics.weeks
                    ? currentUnitMonthMetrics.variancePoints <= 0
                      ? `${formatPercent(Math.abs(currentUnitMonthMetrics.variancePoints))} abaixo do limite (Seguro)`
                      : `${formatPercent(currentUnitMonthMetrics.variancePoints)} acima da meta (Atenção)`
                    : "Aguardando conferências"}
                </small>
              </article>

              <article className="cmv-kpi-card">
                <span>Custo Total do Mês</span>
                <strong>{formatMoney(currentUnitMonthMetrics.totalCost)}</strong>
                <small>{currentUnitMonthMetrics.weeks} conferência{currentUnitMonthMetrics.weeks === 1 ? "" : "s"} somada{currentUnitMonthMetrics.weeks === 1 ? "" : "s"}</small>
              </article>

              <article className="cmv-kpi-card">
                <span>Faturamento Takeat Somado</span>
                <strong>{formatMoney(currentUnitMonthMetrics.revenue)}</strong>
                <small>{currentUnitMonthMetrics.revenue > 0 ? "Sincronizado do período" : "Sem vendas"}</small>
              </article>
            </div>
          </section>

          {/* Composição Mensal dos Custos */}
          <section className="surface-card cmv-month-breakdown-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Custos Acumulados</span>
                <h2>Composição de Gastos no Mês</h2>
                <p>Total gasto por categoria ao longo de todas as semanas conferidas.</p>
              </div>
            </div>
            <div className="cmv-month-cats-grid">
              {costFields.map((field) => {
                const val = currentUnitMonthMetrics[field.key];
                const pct = currentUnitMonthMetrics.revenue > 0 ? (val / currentUnitMonthMetrics.revenue) * 100 : 0;
                const shareOfCost = currentUnitMonthMetrics.totalCost > 0 ? (val / currentUnitMonthMetrics.totalCost) * 100 : 0;
                return (
                  <div className="cmv-month-cat-tile" key={field.key}>
                    <div className="cmv-cat-tile-head">
                      <span>{field.icon} {field.label}</span>
                      <strong>{formatMoney(val)}</strong>
                    </div>
                    <div className="cmv-cat-tile-bar">
                      <div className="cmv-cat-tile-fill" style={{ width: `${shareOfCost}%`, background: field.color }} />
                    </div>
                    <div className="cmv-cat-tile-foot">
                      <small>{formatPercent(pct)} do faturamento</small>
                      <small>{formatPercent(shareOfCost)} dos custos</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lista de 4 Semanas do Mês */}
          <section className="surface-card cmv-weeks-table-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Cronograma do Mês</span>
                <h2>4 Semanas do Mês Selecionado</h2>
                <p>Acompanhe e lance a conferência das 4 semanas de {selectedMonth}.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => {
                  setActiveTab("weekly");
                  setCosts(emptyCmvCosts());
                  setEditingId(null);
                }}
              >
                <PlusCircle size={16} /> Cadastrar Período Customizado
              </button>
            </div>
            <div className="cmv-weeks-list">
              {monthWeeks.map((w) => {
                const rec = unitRecords.find((r) => r.weekStart === w.weekStart || (r.weekStart >= w.weekStart && r.weekStart <= w.weekEnd));
                const weekRev = revenueForPeriod(sales, unit.id, w.weekStart, w.weekEnd);
                const weekMetrics = rec ? calculateCmv(rec, weekRev || rec.revenue, unit.cmvTargetPercent) : null;
                const isConferred = Boolean(rec && weekMetrics && weekMetrics.totalCost > 0);

                return (
                  <article className="cmv-week-row" key={w.weekStart}>
                    <div className="cmv-week-info">
                      <span className={`cmv-week-badge ${isConferred ? "done" : "pending"}`}>
                        {isConferred ? <ClipboardCheck size={16} /> : <PlusCircle size={16} />}
                        {w.label}
                      </span>
                      <div>
                        <strong>{formatDateBR(w.weekStart)} a {formatDateBR(w.weekEnd)}</strong>
                        <small>
                          Faturamento Takeat: <b>{formatMoney(weekRev)}</b>
                        </small>
                      </div>
                    </div>

                    <div className="cmv-week-status-area">
                      {isConferred && weekMetrics ? (
                        <div className="cmv-week-numbers">
                          <span>
                            CMV:{" "}
                            <b className={weekMetrics.percentage <= unit.cmvTargetPercent ? "positive" : "negative"}>
                              {formatPercent(weekMetrics.percentage)}
                            </b>
                          </span>
                          <small>Custo: {formatMoney(weekMetrics.totalCost)}</small>
                        </div>
                      ) : (
                        <span className="cmv-status-pending">Pendente</span>
                      )}
                      <button
                        className="secondary-button cmv-open-week-btn"
                        onClick={() => openWeek(w.weekStart, w.weekEnd)}
                      >
                        {isConferred ? "Editar" : "Lançar custos"} <ChevronRight size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Comparativo Global de Unidades */}
          <section className="surface-card cmv-monthly">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Visão Executiva</span>
                <h2>CMV por Unidade no Mês</h2>
                <p>Consolidado comparativo das unidades no mês de {selectedMonth}.</p>
              </div>
            </div>
            <div className="cmv-month-grid">
              {monthlyByUnit.map(({ unit: item, metrics: itemMetrics }, index) => {
                const hasMonthData = itemMetrics.weeks > 0;
                return (
                  <article key={item.id} className={`cmv-unit-card unit-${index + 1}`}>
                    <span className="cmv-unit-index">0{index + 1}</span>
                    <div className="cmv-unit-name">
                      <strong>{item.shortName}</strong>
                      <span>{hasMonthData ? `${itemMetrics.weeks} conferência${itemMetrics.weeks === 1 ? "" : "s"}` : "Sem conferências"}</span>
                    </div>
                    <div className="cmv-unit-metric">
                      <b className={hasMonthData ? (itemMetrics.percentage <= item.cmvTargetPercent ? "positive" : "negative") : "neutral"}>
                        {hasMonthData ? formatPercent(itemMetrics.percentage) : "—"}
                      </b>
                      <small>
                        {hasMonthData ? `${formatMoney(itemMetrics.totalCost)} de custo` : `Meta ≤ ${formatPercent(item.cmvTargetPercent)}`}
                      </small>
                    </div>
                    <div className="cmv-unit-progress">
                      <i>
                        <em style={{ width: hasMonthData ? `${Math.min((itemMetrics.percentage / Math.max(item.cmvTargetPercent, 1)) * 100, 100)}%` : "0%" }} />
                      </i>
                      <span>{hasMonthData ? (itemMetrics.percentage <= item.cmvTargetPercent ? "Dentro da meta" : "Acima da meta") : "Sem dados"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
