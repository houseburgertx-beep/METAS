"use client";

// A Takeat é a fonte automática dos faturamentos diários por unidade.

import {
  Activity, BarChart3, Bot, Building2, CalendarDays, ChevronDown, ChevronRight,
  CircleDollarSign, Clock, DollarSign, History, Home, Lightbulb, LogOut, Moon, MoreHorizontal,
  PlusCircle, RefreshCw, Rocket, Save, Send, Settings, Share2, ShieldAlert, ShieldCheck,
  ShoppingBag, Sparkles, Store, Sun, Target, Trash2, TrendingDown, TrendingUp,
  Truck, Tv, UserRound, UsersRound, Utensils, UtensilsCrossed, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGoalEditor } from "./admin-goals";
import { CmvScreen } from "./cmv-screen";
import { calculateBonus, calculatePerformance, validateDetails } from "@/lib/calculations";
import { MANAGEMENT_RULES, UNITS } from "@/lib/config";
import { formatDateBR, formatMoney, formatMoneyInput, formatPercent, parseMoney } from "@/lib/format";
import { monthlyCmv, revenueForPeriod } from "@/lib/cmv-calculations";
import { requestAiAnalysis } from "@/lib/ai-service";
import { generateDashboardWhatsAppText } from "@/lib/smart-features";
import type { CmvEntry, FreelancerEntry, OperatingInputs, SalesEntry, UnitConfig, UserRole } from "@/lib/types";

type View = "dashboard" | "launch" | "history" | "cmv" | "ai" | "profile" | "admin";
type Theme = "light" | "dark" | "system";
type SyncStatus = { state: "idle" | "syncing" | "success" | "error"; message: string };
const currentDate = new Date();
const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const entryTotal = (entry: SalesEntry) => entry.salao + entry.delivery + entry.ifood;
const monthDatesUntil = (date: Date) => Array.from({ length: date.getDate() }, (_, index) => isoDate(new Date(date.getFullYear(), date.getMonth(), index + 1)));

function IconForChannel({ channel }: { channel: string }) {
  if (channel === "salao") return <UtensilsCrossed size={17} />;
  if (channel === "delivery") return <Truck size={17} />;
  return <ShoppingBag size={17} />;
}

function ProgressBar({ value, expected, tone = "brand" }: { value: number; expected?: number; tone?: string }) {
  return (
    <div className="progress-shell" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span className={`progress-fill tone-${tone}`} style={{ width: `${Math.min(Math.max(value, 2), 100)}%` }} />
      {expected !== undefined && <span className="progress-marker" style={{ left: `${Math.min(Math.max(expected, 1), 99)}%` }} aria-label="Trajetória esperada" />}
    </div>
  );
}

function ProgressRing({ value, size = 86, tone = "brand" }: { value: number; size?: number; tone?: string }) {
  const radius = 38, circumference = 2 * Math.PI * radius, progress = Math.min(Math.max(value, 0), 100);
  return (
    <div className={`progress-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle className="ring-track" cx="44" cy="44" r={radius} />
        <circle className="ring-value" cx="44" cy="44" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference - (progress / 100) * circumference} />
      </svg>
      <strong>{Math.round(value)}%</strong>
    </div>
  );
}

function Trend({ value }: { value: number }) {
  const state = value > 1 ? "up" : value < -1 ? "down" : "stable";
  return (
    <span className={`trend trend-${state}`}>
      {state === "up" ? <TrendingUp size={15} /> : state === "down" ? <TrendingDown size={15} /> : <MoreHorizontal size={15} />}
      {value > 0 ? "+" : ""}{formatPercent(value)} <small>vs. anterior</small>
    </span>
  );
}

function Sparkline({ values, target }: { values: number[]; target?: number[] }) {
  if (!values.length) return <div className="spark-empty" />;
  const all = [...values, ...(target || [])], max = Math.max(...all, 1), min = Math.min(...all, 0), range = max - min || 1;
  const points = (series: number[]) => series.map((value, index) => `${(index / Math.max(series.length - 1, 1)) * 100},${46 - ((value - min) / range) * 40}`).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="Evolução dos últimos dias">
      {target && <polyline points={points(target)} className="spark-target" />}
      <polyline points={points(values)} className="spark-main" />
    </svg>
  );
}

function LineChart({ entries, unit }: { entries: SalesEntry[]; unit: UnitConfig }) {
  const daily = entries.slice(-14), values = daily.map(entryTotal), targets = daily.map((entry) => { const [y, m, d] = entry.date.split("-").map(Number); return unit.dailyTargets[new Date(y, m - 1, d).getDay()].total; });
  const max = Math.max(...values, ...targets, 1), x = (i: number) => 8 + (i / Math.max(daily.length - 1, 1)) * 284, y = (v: number) => 128 - (v / max) * 106;
  const points = (series: number[]) => series.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="legend-real" /> Realizado</span>
        <span><i className="legend-target" /> Meta diária</span>
      </div>
      <svg className="line-chart" viewBox="0 0 300 155" role="img" aria-label="Faturamento realizado comparado à meta diária">
        {[25, 55, 85, 115].map((line) => <line key={line} x1="8" x2="292" y1={line} y2={line} className="grid-line" />)}
        <polyline points={points(targets)} className="line-target" />
        <polyline points={points(values)} className="line-real" />
        {values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="2.6" className="chart-dot" aria-label={`${formatDateBR(daily[index].date)}: ${formatMoney(value)}`} />)}
        {daily.map((entry, index) => (index % Math.ceil(daily.length / 5) === 0 || index === daily.length - 1) && <text key={entry.date} x={x(index)} y="151" textAnchor="middle">{entry.date.slice(-2)}</text>)}
      </svg>
    </div>
  );
}

function StackedChannelChart({ entries, unit }: { entries: SalesEntry[]; unit: UnitConfig }) {
  const daily = entries.slice(-10);
  if (!daily.length) return <div className="chart-empty">Aguardando dados de vendas</div>;

  const maxTotal = Math.max(
    ...daily.map(entryTotal),
    ...daily.map((e) => {
      const [y, m, d] = e.date.split("-").map(Number);
      return unit.dailyTargets[new Date(y, m - 1, d).getDay()].total;
    }),
    1
  );

  return (
    <div className="stacked-chart-wrap">
      <div className="stacked-chart-legend">
        <span><i style={{ background: "var(--brand)" }} /> Salão</span>
        <span><i style={{ background: "var(--success)" }} /> Delivery</span>
        <span><i style={{ background: "var(--warning)" }} /> iFood</span>
        <span><i style={{ borderTop: "2px dashed var(--text-tertiary)", width: 14, height: 0 }} /> Meta do dia</span>
      </div>
      <div className="stacked-bars-grid">
        {daily.map((entry) => {
          const [y, m, d] = entry.date.split("-").map(Number);
          const target = unit.dailyTargets[new Date(y, m - 1, d).getDay()].total;
          const tot = entryTotal(entry);
          const targetH = (target / maxTotal) * 100;
          const dayName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(y, m - 1, d).getDay()];

          return (
            <div className="stacked-col" key={entry.date}>
              <div className="stacked-bar-track">
                <span className="stacked-target-line" style={{ bottom: `${targetH}%` }} title={`Meta: ${formatMoney(target)}`} />
                <div className="stacked-bar-fill" style={{ height: `${(tot / maxTotal) * 100}%` }}>
                  <span className="bar-part ifood" style={{ height: `${tot ? (entry.ifood / tot) * 100 : 0}%` }} title={`iFood: ${formatMoney(entry.ifood)}`} />
                  <span className="bar-part delivery" style={{ height: `${tot ? (entry.delivery / tot) * 100 : 0}%` }} title={`Delivery: ${formatMoney(entry.delivery)}`} />
                  <span className="bar-part salao" style={{ height: `${tot ? (entry.salao / tot) * 100 : 0}%` }} title={`Salão: ${formatMoney(entry.salao)}`} />
                </div>
              </div>
              <div className="stacked-label">
                <strong>{entry.date.slice(-2)}</strong>
                <small>{dayName}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Donut({ channels }: { channels: { label: string; realized: number; key: string }[] }) {
  const total = channels.reduce((sum, item) => sum + item.realized, 0) || 1, colors: Record<string, string> = { salao: "var(--brand)", delivery: "var(--success)", ifood: "var(--warning)" };
  const slices = channels.reduce<{ channel: typeof channels[number]; percent: number; offset: number }[]>((items, channel) => {
    const percent = (channel.realized / total) * 100, offset = items.reduce((sum, item) => sum + item.percent, 0);
    return [...items, { channel, percent, offset }];
  }, []);
  return (
    <div className="donut-layout">
      <svg className="donut" viewBox="0 0 42 42" aria-label="Participação por canal">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-secondary)" strokeWidth="6" />
        {slices.map(({ channel, percent, offset }) => (
          <circle
            key={channel.key}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={colors[channel.key]}
            strokeWidth="6"
            strokeDasharray={`${percent} ${100 - percent}`}
            strokeDashoffset={25 - offset}
          />
        ))}
      </svg>
      <div className="donut-legend">
        {channels.map((channel) => (
          <div key={channel.key}>
            <i style={{ background: colors[channel.key] }} />
            <span>{channel.label}</span>
            <strong>{formatPercent((channel.realized / total) * 100)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   MODO TV MULTI-LOJAS ULTRA PREMIUM COM MEDIDORES RADIAIS E CANAIS DO MÊS
========================================================================= */
function TvModeView({
  units,
  entries,
  cmvRecords,
  onClose,
  onSync,
}: {
  units: UnitConfig[];
  entries: SalesEntry[];
  cmvRecords: CmvEntry[];
  onClose: () => void;
  onSync: () => void;
}) {
  const [clockTime, setClockTime] = useState("");
  const todayStr = isoDate(currentDate);
  const currentMonthPrefix = todayStr.slice(0, 7);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString("pt-BR", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const unitCards = units.map((u) => {
    const metrics = calculatePerformance(u, entries, currentDate);
    const unitEntries = entries.filter((e) => e.unitId === u.id);
    const todayEntry = unitEntries.find((e) => e.date === todayStr);
    const activeEntries = unitEntries.filter((e) => entryTotal(e) > 0);
    const lastActiveEntry = activeEntries[activeEntries.length - 1];

    const isTodayActive = Boolean(todayEntry && entryTotal(todayEntry) > 0);
    const displayDayEntry = isTodayActive ? todayEntry : lastActiveEntry;
    const dayTotal = displayDayEntry ? entryTotal(displayDayEntry) : 0;
    const [y, m, d] = (displayDayEntry?.date || todayStr).split("-").map(Number);
    const dayTarget = u.dailyTargets[new Date(y, m - 1, d).getDay()].total;
    const dayPct = dayTarget > 0 ? (dayTotal / dayTarget) * 100 : 0;

    const liveCmv = cmvRecords
      .filter((r) => r.unitId === u.id)
      .map((r) => ({
        ...r,
        revenue: revenueForPeriod(entries, r.unitId, r.weekStart, r.weekEnd) || r.revenue,
      }));
    const monthCmv = monthlyCmv(liveCmv, u, currentMonthPrefix);

    const bonus = calculateBonus(u, unitEntries, {
      cmvPercent: monthCmv.weeks > 0 ? monthCmv.percentage : 32.0,
      freelancerSpend: 0,
    });

    return {
      unit: u,
      metrics,
      isTodayActive,
      displayDayEntry,
      dayTotal,
      dayTarget,
      dayPct,
      monthCmv,
      bonus,
    };
  });

  const totalNetworkMonth = unitCards.reduce((sum, c) => sum + c.metrics.total, 0);
  const totalNetworkGoal = unitCards.reduce((sum, c) => sum + c.unit.monthlyGoal, 0);
  const networkPct = totalNetworkGoal > 0 ? (totalNetworkMonth / totalNetworkGoal) * 100 : 0;

  return (
    <div className="tv-mode-overlay">
      {/* Animated Floating Ambient Background Mesh Orbs */}
      <div className="tv-ambient-orb tv-orb-1" />
      <div className="tv-ambient-orb tv-orb-2" />
      <div className="tv-ambient-orb tv-orb-3" />

      {/* TV Cockpit Header */}
      <header className="tv-multi-top">
        <div className="tv-brand-block">
          <span className="tv-brand-logo-glow"><BarChart3 size={26} /></span>
          <div>
            <h1>HOUSE GESTÃO · PAINEL OPERACIONAL</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2 }}>
              <span className="tv-live-badge"><i className="tv-live-dot" /> AO VIVO</span>
              <span style={{ fontSize: 12, color: "#a8a29e" }}>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
          </div>
        </div>

        <div className="tv-top-actions-cluster">
          <div className="tv-clock-display">
            <Clock size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {clockTime}
          </div>

          <div className="tv-network-summary">
            <div className="tv-network-kpi">
              <span>Faturamento Total da Rede</span>
              <strong>{formatMoney(totalNetworkMonth)}</strong>
              <small>Meta Global: {formatMoney(totalNetworkGoal)} ({formatPercent(networkPct)})</small>
            </div>
          </div>

          <button className="tv-exit-btn" onClick={onSync} title="Atualizar dados Takeat">
            <RefreshCw size={15} /> Sincronizar
          </button>
          <button className="tv-exit-btn" onClick={onClose}>
            <X size={16} /> Sair da TV
          </button>
        </div>
      </header>

      {/* Grid de Lojas com Animações, Medidores Radiais e Canais do Mês */}
      <section className="tv-multi-grid">
        {unitCards.map(({ unit: u, metrics, isTodayActive, displayDayEntry, dayTotal, dayTarget, dayPct, monthCmv, bonus }) => {
          const isHealthy = metrics.health === "green";
          const gaugeTone = metrics.percentage >= 95 ? "tone-green" : metrics.percentage >= 80 ? "tone-yellow" : "tone-red";
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const progressOffset = circumference - (Math.min(metrics.percentage, 100) / 100) * circumference;

          return (
            <article key={u.id} className={`tv-unit-card ${u.type === "foodpark" ? "unit-foodpark" : ""}`}>
              <div className="tv-unit-head">
                <div>
                  <h2>
                    <Store size={20} color="var(--brand)" /> {u.name}
                  </h2>
                  <span className="tv-submeta">Meta mensal: <b>{formatMoney(u.monthlyGoal)}</b></span>
                </div>
                <span className={`status-badge status-${isHealthy ? "success" : "warning"}`}>
                  {metrics.healthLabel}
                </span>
              </div>

              {/* Centerpiece com Gráfico Radial / Anel SVG */}
              <div className="tv-unit-centerpiece">
                <div className="tv-gauge-container">
                  <svg className="tv-gauge-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} className="tv-gauge-track" />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className={`tv-gauge-fill ${gaugeTone}`}
                      strokeDasharray={circumference}
                      strokeDashoffset={progressOffset}
                    />
                  </svg>
                  <div className="tv-gauge-label">
                    <strong>{Math.round(metrics.percentage)}%</strong>
                    <small>da meta</small>
                  </div>
                </div>

                <div className="tv-center-info">
                  <span className="tv-eyebrow">Realizado no Mês</span>
                  <div className="tv-unit-main-val">{formatMoney(metrics.total)}</div>
                  <div className="tv-center-substats">
                    <span>Falta: <b>{formatMoney(metrics.missing)}</b></span>
                    <span>Projeção: <b>{formatMoney(metrics.projection)}</b></span>
                  </div>
                </div>
              </div>

              {/* CANAIS ACUMULADOS NO MÊS (MESA / SALÃO, DELIVERY PRÓPRIO, IFOOD) */}
              <div className="tv-channels-month-grid">
                {metrics.channels.map((chan) => (
                  <div key={chan.key} className={`tv-month-chan-card chan-${chan.key}`}>
                    <div className="tv-chan-card-top">
                      <span><IconForChannel channel={chan.key} /> {chan.label}</span>
                      <b>{Math.round(chan.percentage)}%</b>
                    </div>
                    <strong className="tv-chan-realized">{formatMoney(chan.realized)}</strong>
                    <div className="tv-chan-bar-track">
                      <div className="tv-chan-bar-fill" style={{ width: `${Math.min(chan.percentage, 100)}%` }} />
                    </div>
                    <small>Meta: {formatMoney(chan.goal)}</small>
                  </div>
                ))}
              </div>

              {/* Vendas Diárias (Hoje se aberto, ou Último Fechamento) */}
              <div className="tv-unit-today-box">
                <div className="tv-unit-today-head">
                  <span>
                    {isTodayActive ? "Vendas de Hoje (em tempo real):" : `Último Fechamento (${displayDayEntry ? formatDateBR(displayDayEntry.date) : "Ontem"}):`}
                  </span>
                  <strong>{formatMoney(dayTotal)}</strong>
                </div>
                <div style={{ fontSize: 11, color: "#a8a29e", display: "flex", justifyContent: "space-between" }}>
                  <span>Meta diária: <b>{formatMoney(dayTarget)}</b></span>
                  <span style={{ color: dayPct >= 100 ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                    {isTodayActive ? `${formatPercent(dayPct)} do dia` : `${formatPercent(dayPct)} (Ontem)`}
                  </span>
                </div>
                <div className="tv-unit-channels">
                  <div className="tv-unit-chan-tile chan-salao">
                    <span><UtensilsCrossed size={12} /> Salão</span>
                    <strong>{formatMoney(displayDayEntry?.salao || 0)}</strong>
                  </div>
                  <div className="tv-unit-chan-tile chan-delivery">
                    <span><Truck size={12} /> Delivery</span>
                    <strong>{formatMoney(displayDayEntry?.delivery || 0)}</strong>
                  </div>
                  <div className="tv-unit-chan-tile chan-ifood">
                    <span><ShoppingBag size={12} /> iFood</span>
                    <strong>{formatMoney(displayDayEntry?.ifood || 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Indicadores Operacionais de Rodapé */}
              <div className="tv-unit-operational-row">
                <div className="tv-op-cell">
                  <span>CMV do Mês</span>
                  <strong style={{ color: monthCmv.weeks && monthCmv.percentage <= u.cmvTargetPercent ? "#10b981" : "#f87171" }}>
                    {monthCmv.weeks ? formatPercent(monthCmv.percentage) : "—"}
                  </strong>
                </div>
                <div className="tv-op-cell">
                  <span>Bônus Equipe</span>
                  <strong style={{ color: "#f59e0b" }}>
                    {formatMoney(bonus.conquered)}
                  </strong>
                </div>
                <div className="tv-op-cell">
                  <span>Supermeta</span>
                  <strong>{formatMoney(u.superGoal)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

/* =========================================================================
   MODAL RÁPIDO PARA LANÇAR SUB-MARCAS (X-TUDO / FRANGO / PIZZA)
========================================================================= */
function SubBrandModal({
  unit,
  entries,
  onSave,
  onClose,
}: {
  unit: UnitConfig;
  entries: SalesEntry[];
  onSave: (entry: SalesEntry) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(isoDate(currentDate));
  const currentEntry = entries.find((e) => e.unitId === unit.id && e.date === date);

  const [xtudoDelivery, setXtudoDelivery] = useState<number>(currentEntry?.deliveryDetails?.xtudo || 0);
  const [xtudoIfood, setXtudoIfood] = useState<number>(currentEntry?.ifoodDetails?.xtudo || 0);

  const [frangoDelivery, setFrangoDelivery] = useState<number>(currentEntry?.deliveryDetails?.frango || 0);
  const [frangoIfood, setFrangoIfood] = useState<number>(currentEntry?.ifoodDetails?.frango || 0);
  const [pizzaDelivery, setPizzaDelivery] = useState<number>(currentEntry?.deliveryDetails?.pizza || 0);
  const [pizzaIfood, setPizzaIfood] = useState<number>(currentEntry?.ifoodDetails?.pizza || 0);

  const [saving, setSaving] = useState(false);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const entry = entries.find((e) => e.unitId === unit.id && e.date === newDate);
    setXtudoDelivery(entry?.deliveryDetails?.xtudo || 0);
    setXtudoIfood(entry?.ifoodDetails?.xtudo || 0);
    setFrangoDelivery(entry?.deliveryDetails?.frango || 0);
    setFrangoIfood(entry?.ifoodDetails?.frango || 0);
    setPizzaDelivery(entry?.deliveryDetails?.pizza || 0);
    setPizzaIfood(entry?.ifoodDetails?.pizza || 0);
  };

  const currentTotalDelivery = currentEntry?.delivery || 0;
  const currentTotalIfood = currentEntry?.ifood || 0;

  const houseDeliveryRemaining = Math.max(currentTotalDelivery - xtudoDelivery, 0);
  const houseIfoodRemaining = Math.max(currentTotalIfood - xtudoIfood, 0);

  const burgerDeliveryRemaining = Math.max(currentTotalDelivery - frangoDelivery - pizzaDelivery, 0);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const baseEntry: SalesEntry = currentEntry || {
        id: `${unit.id}_${date}`,
        unitId: unit.id,
        date,
        salao: 0,
        delivery: 0,
        ifood: 0,
        createdBy: "gerente@house190.com.br",
        updatedAt: new Date().toISOString(),
      };

      const updatedEntry: SalesEntry = {
        ...baseEntry,
        deliveryDetails:
          unit.type === "house190"
            ? { ...(baseEntry.deliveryDetails || {}), xtudo: xtudoDelivery }
            : { ...(baseEntry.deliveryDetails || {}), frango: frangoDelivery, pizza: pizzaDelivery },
        ifoodDetails:
          unit.type === "house190"
            ? { ...(baseEntry.ifoodDetails || {}), xtudo: xtudoIfood }
            : { ...(baseEntry.ifoodDetails || {}), frango: frangoIfood, pizza: pizzaIfood },
        updatedAt: new Date().toISOString(),
      };

      await onSave(updatedEntry);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="subbrand-modal surface-card">
        <div className="subbrand-modal-header">
          <h2>
            <Utensils size={18} color="var(--brand)" /> Separação de Sub-marcas
          </h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar" style={{ width: 32, height: 32 }}>
            <X size={18} />
          </button>
        </div>

        <div className="subbrand-modal-body">
          <div className="subbrand-date-strip">
            <label className="subbrand-date-input">
              <span>Data:</span>
              <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} required />
            </label>
            <div className="subbrand-takeat-pill">
              <span>Takeat Delivery: <b>{formatMoney(currentTotalDelivery)}</b></span><br />
              <span>Takeat iFood: <b>{formatMoney(currentTotalIfood)}</b></span>
            </div>
          </div>

          {unit.type === "house190" ? (
            <div className="subbrand-compact-grid">
              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><Truck size={14} color="var(--brand)" /> X-Tudo Delivery</span>
                <span className="subbrand-compact-sub">House Delivery: {formatMoney(houseDeliveryRemaining)}</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={xtudoDelivery ? formatMoneyInput(xtudoDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setXtudoDelivery(parseMoney(e.target.value))}
                  />
                </div>
              </div>

              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><ShoppingBag size={14} color="var(--brand)" /> X-Tudo iFood</span>
                <span className="subbrand-compact-sub">House iFood: {formatMoney(houseIfoodRemaining)}</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={xtudoIfood ? formatMoneyInput(xtudoIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setXtudoIfood(parseMoney(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="subbrand-compact-grid">
              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><Truck size={14} color="#f59e0b" /> Frango Delivery</span>
                <span className="subbrand-compact-sub">Vendas Chicken</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={frangoDelivery ? formatMoneyInput(frangoDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setFrangoDelivery(parseMoney(e.target.value))}
                  />
                </div>
              </div>

              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><ShoppingBag size={14} color="#f59e0b" /> Frango iFood</span>
                <span className="subbrand-compact-sub">Vendas Chicken</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={frangoIfood ? formatMoneyInput(frangoIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setFrangoIfood(parseMoney(e.target.value))}
                  />
                </div>
              </div>

              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><Truck size={14} color="#ec4899" /> Pizza Delivery</span>
                <span className="subbrand-compact-sub">Vendas Pizza</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={pizzaDelivery ? formatMoneyInput(pizzaDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setPizzaDelivery(parseMoney(e.target.value))}
                  />
                </div>
              </div>

              <div className="subbrand-compact-tile">
                <span className="subbrand-compact-title"><ShoppingBag size={14} color="#ec4899" /> Pizza iFood</span>
                <span className="subbrand-compact-sub">Vendas Pizza</span>
                <div className="subbrand-compact-input-row">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={pizzaIfood ? formatMoneyInput(pizzaIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setPizzaIfood(parseMoney(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {unit.type === "foodpark" && (
            <small style={{ fontSize: 9.5, color: "var(--text-secondary)", textAlign: "center", display: "block" }}>
              Burger / Lanches Delivery restante: <b>{formatMoney(burgerDeliveryRemaining)}</b>
            </small>
          )}
        </div>

        <div className="subbrand-modal-footer">
          <button className="primary-button subbrand-save-btn" onClick={() => void handleSave()} disabled={saving}>
            <Save size={16} /> {saving ? "Salvando..." : "Salvar e Atualizar Bonificação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  unit,
  units,
  entries,
  cmvRecords,
  freelancers,
  onNavigate,
  syncStatus,
  onSync,
  onOpenFreelancers,
  onOpenSubBrands,
}: {
  unit: UnitConfig;
  units: UnitConfig[];
  entries: SalesEntry[];
  cmvRecords: CmvEntry[];
  freelancers: FreelancerEntry[];
  onNavigate: (view: View) => void;
  syncStatus: SyncStatus;
  onSync: () => void;
  onOpenFreelancers: () => void;
  onOpenSubBrands: () => void;
}) {
  const [tvMode, setTvMode] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [chartType, setChartType] = useState<"stacked" | "line">("stacked");

  const metrics = useMemo(() => calculatePerformance(unit, entries, currentDate), [unit, entries]);
  const currentEntries = entries.filter((entry) => entry.unitId === unit.id);
  const recent = currentEntries.slice(-7);
  const channelValues = (key: "salao" | "delivery" | "ifood") => recent.map((entry) => entry[key]);
  const statusTone = metrics.health === "green" ? "success" : metrics.health === "yellow" ? "warning" : "danger";

  // Total Freelancers spent for this unit
  const currentMonthPrefix = isoDate(currentDate).slice(0, 7);
  const freelancerSpend = useMemo(
    () => freelancers.filter((f) => f.unitId === unit.id).reduce((sum, f) => sum + f.amount, 0),
    [freelancers, unit.id]
  );

  // Real-time Monthly CMV calculations for current unit
  const liveRevenue = (record: CmvEntry) => {
    const hasLoadedPeriod = entries.some((sale) => sale.unitId === record.unitId && sale.date >= record.weekStart && sale.date <= record.weekEnd);
    return hasLoadedPeriod ? revenueForPeriod(entries, record.unitId, record.weekStart, record.weekEnd) : record.revenue;
  };
  const liveCmvRecords = cmvRecords.map((r) => ({ ...r, revenue: liveRevenue(r) }));
  const monthCmvMetrics = useMemo(() => monthlyCmv(liveCmvRecords, unit, currentMonthPrefix), [liveCmvRecords, unit, currentMonthPrefix]);
  const cmvHasData = monthCmvMetrics.weeks > 0;

  const bonus = calculateBonus(unit, currentEntries, {
    cmvPercent: cmvHasData ? monthCmvMetrics.percentage : 32.0,
    freelancerSpend,
  });

  const realizedPosition = Math.min(Math.max(metrics.percentage, 0), 100);
  const expectedPosition = Math.min(Math.max((metrics.expected / unit.monthlyGoal) * 100, 0), 100);
  const trajectoryGapStart = Math.min(realizedPosition, expectedPosition);
  const trajectoryGapWidth = Math.abs(realizedPosition - expectedPosition);

  // Takeat sessions / orders calculation
  const totalSessions = currentEntries.reduce((sum, e) => sum + (e.sourceSummary?.sessions || 0), 0);
  const averageTicket = totalSessions > 0 ? metrics.total / totalSessions : 0;

  const shareWhatsApp = () => {
    const text = generateDashboardWhatsAppText({
      unitName: unit.name,
      metrics,
      bonusConquered: bonus.conquered,
      freelancerTotal: freelancerSpend,
      cmvPercent: cmvHasData ? monthCmvMetrics.percentage : undefined,
    });
    void navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <div className="screen-stack dashboard-screen">
      {tvMode && (
        <TvModeView
          units={units}
          entries={entries}
          cmvRecords={cmvRecords}
          onClose={() => setTvMode(false)}
          onSync={onSync}
        />
      )}

      {/* BARRA SUPERIOR DE AÇÕES RÁPIDAS (MOBILE & DESKTOP) */}
      <div className="mobile-action-bar">
        <button className="mobile-action-btn action-subbrands" onClick={onOpenSubBrands}>
          <Utensils size={20} />
          <div>
            <strong>Lançar Sub-marcas</strong>
            <small>{unit.type === "house190" ? "X-Tudo Delivery / iFood" : "Frango / Pizza / Burger"}</small>
          </div>
          <ChevronRight size={16} />
        </button>
        <button className="mobile-action-btn action-freelancers" onClick={onOpenFreelancers}>
          <UsersRound size={20} />
          <div>
            <strong>Lançar Diárias</strong>
            <small>Teto máx R$ 1.500</small>
          </div>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Top Bar Actions: TV Mode and WhatsApp */}
      <div className="dashboard-top-actions">
        <button className="tv-toggle-btn" onClick={() => setTvMode(true)}>
          <Tv size={15} /> Modo TV / Multi-Lojas
        </button>
        <button className="whatsapp-share-btn" onClick={shareWhatsApp}>
          <Share2 size={15} /> {copiedWhatsApp ? "Copiado!" : "Compartilhar Resumo WhatsApp"}
        </button>
      </div>

      <section className={`sync-status-card takeat-state-${syncStatus.state}`} aria-live="polite">
        <span className="sync-status-icon"><RefreshCw size={18} /></span>
        <div>
          <strong>
            {syncStatus.state === "syncing"
              ? "Atualizando vendas"
              : syncStatus.state === "error"
                ? "Falha na atualização"
                : syncStatus.state === "success"
                  ? "Takeat atualizada"
                  : "Integração Takeat"}
          </strong>
          <small>{syncStatus.message}</small>
        </div>
        <button type="button" onClick={onSync} disabled={syncStatus.state === "syncing"}>
          {syncStatus.state === "syncing" ? "Aguarde" : "Atualizar"}
        </button>
      </section>

      {/* Hero Card */}
      <section className="hero-card surface-card entrance">
        <div className="hero-topline">
          <span>Faturamento do mês</span>
          <span className="live-pill"><i /> Atualizado agora</span>
        </div>
        <div className="hero-grid">
          <div>
            <strong className="hero-value">{formatMoney(metrics.total)}</strong>
            <p><b>{formatPercent(metrics.percentage)}</b> da meta mensal</p>
          </div>
          <ProgressRing value={metrics.percentage} size={96} />
        </div>
        <div className={`hero-trajectory ${metrics.gap >= 0 ? "hero-ahead" : "hero-behind"}`}>
          <div className="hero-trajectory-labels">
            <span>Realizado <b>{formatPercent(realizedPosition)}</b></span>
            <span>Ritmo de hoje <b>{formatPercent(expectedPosition)}</b></span>
          </div>
          <div
            className="hero-progress-track"
            role="progressbar"
            aria-label="Progresso do faturamento mensal"
            aria-valuenow={Math.round(realizedPosition)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="hero-progress-fill" style={{ width: `${realizedPosition}%` }}><i /></span>
            <span className="hero-progress-gap" style={{ left: `${trajectoryGapStart}%`, width: `${trajectoryGapWidth}%` }} />
            <span className="hero-progress-pin" style={{ left: `${realizedPosition}%` }} />
            <span className="hero-progress-today" style={{ left: `${expectedPosition}%` }}><i /><em>Hoje</em></span>
          </div>
        </div>
        <div className="hero-foot">
          <div>
            <span>Meta</span>
            <strong>{formatMoney(unit.monthlyGoal)}</strong>
          </div>
          <div>
            <span>Falta</span>
            <strong>{formatMoney(metrics.missing)}</strong>
          </div>
          <div>
            <span>Supermeta</span>
            <strong>{formatMoney(unit.superGoal)}</strong>
          </div>
        </div>
      </section>

      {/* CMV do Mês Widget */}
      <section className="surface-card cmv-dashboard-widget entrance delay-1">
        <div className="cmv-widget-head">
          <div className="cmv-widget-title">
            <span className="metric-icon icon-crimson"><CircleDollarSign size={20} /></span>
            <div>
              <span className="eyebrow">Gestão de Custos</span>
              <h2>CMV do Mês</h2>
            </div>
          </div>
          <span className={`status-badge status-${cmvHasData ? (monthCmvMetrics.percentage <= unit.cmvTargetPercent ? "success" : "danger") : "neutral"}`}>
            Meta ≤ {formatPercent(unit.cmvTargetPercent)}
          </span>
        </div>

        <div className="cmv-widget-body">
          <div className="cmv-widget-main-stat">
            <strong className={cmvHasData ? (monthCmvMetrics.percentage <= unit.cmvTargetPercent ? "positive" : "negative") : ""}>
              {cmvHasData ? formatPercent(monthCmvMetrics.percentage) : "—"}
            </strong>
            <p>
              {cmvHasData
                ? monthCmvMetrics.variancePoints <= 0
                  ? `${formatPercent(Math.abs(monthCmvMetrics.variancePoints))} abaixo do limite (Saudável)`
                  : `${formatPercent(monthCmvMetrics.variancePoints)} acima da meta (Atenção aos custos)`
                : "Nenhuma conferência salva neste mês ainda"}
            </p>
          </div>
          <div className="cmv-widget-details">
            <div>
              <span>Custos lançados</span>
              <strong>{formatMoney(monthCmvMetrics.totalCost)}</strong>
            </div>
            <div>
              <span>Faturamento Takeat</span>
              <strong>{formatMoney(monthCmvMetrics.revenue)}</strong>
            </div>
            <div>
              <span>Conferências</span>
              <strong>{monthCmvMetrics.weeks} registrada{monthCmvMetrics.weeks === 1 ? "" : "s"}</strong>
            </div>
          </div>
        </div>

        <div className="cmv-widget-actions">
          <button className="primary-button cmv-widget-btn" onClick={() => onNavigate("cmv")}>
            <CircleDollarSign size={16} /> Abrir módulo de CMV / Lançar custos <ChevronRight size={15} />
          </button>
        </div>
      </section>

      {/* Widget de Controle de Freelancers */}
      <section className="surface-card cmv-dashboard-widget entrance delay-1">
        <div className="cmv-widget-head">
          <div className="cmv-widget-title">
            <span className="metric-icon icon-purple"><UsersRound size={20} /></span>
            <div>
              <span className="eyebrow">Operação e Equipe</span>
              <h2>Diárias de Freelancers</h2>
            </div>
          </div>
          <span className={`status-badge status-${freelancerSpend <= 1500 ? "success" : "danger"}`}>
            {freelancerSpend <= 1500 ? "Dentro do limite (≤ R$ 1.500)" : "Estourou teto (Bônus bloqueado)"}
          </span>
        </div>

        <div className="freelancer-cap-bar">
          <div className="freelancer-cap-head">
            <span>Gasto acumulado no mês: <b>{formatMoney(freelancerSpend)}</b></span>
            <span>Teto máximo: <b>R$ 1.500,00</b></span>
          </div>
          <div className="freelancer-cap-track">
            <div
              className="freelancer-cap-fill"
              style={{
                width: `${Math.min((freelancerSpend / 1500) * 100, 100)}%`,
                background: freelancerSpend <= 1200 ? "var(--success)" : freelancerSpend <= 1500 ? "var(--warning)" : "var(--danger)",
              }}
            />
          </div>
        </div>

        <div className="cmv-widget-actions">
          <button className="secondary-button" onClick={onOpenFreelancers}>
            <PlusCircle size={16} /> Lançar / Gerenciar Diaristas <ChevronRight size={15} />
          </button>
        </div>
      </section>

      {/* Health Card */}
      <section className={`health-card health-${metrics.health} entrance delay-1`}>
        <div className="health-icon"><Activity size={23} /></div>
        <div className="health-copy">
          <span className="eyebrow">Saúde da meta</span>
          <h2>{metrics.healthLabel}</h2>
          <p>
            Você está <strong>{formatMoney(Math.abs(metrics.gap))} {metrics.gap >= 0 ? "acima" : "abaixo"}</strong> da trajetória esperada.
          </p>
        </div>
        <div className="health-projection">
          <span>No ritmo atual</span>
          <strong>{formatMoney(metrics.projection)}</strong>
        </div>
      </section>

      {/* Trajectory Card */}
      <section className="surface-card trajectory-card entrance delay-2">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Trajetória do mês</span>
            <h2>Realizado x esperado</h2>
          </div>
          <span className={`status-badge status-${statusTone}`}>{formatPercent(metrics.trajectoryPercentage)} do ritmo</span>
        </div>
        <div className="trajectory-values">
          <div>
            <span>Realizado</span>
            <strong>{formatMoney(metrics.total)}</strong>
          </div>
          <div>
            <span>Esperado até hoje</span>
            <strong>{formatMoney(metrics.expected)}</strong>
          </div>
          <div className={metrics.gap >= 0 ? "positive" : "negative"}>
            <span>Diferença</span>
            <strong>{metrics.gap >= 0 ? "+" : "−"}{formatMoney(Math.abs(metrics.gap))}</strong>
          </div>
        </div>
        <div className={`trajectory-progress ${metrics.gap >= 0 ? "trajectory-ahead" : "trajectory-behind"}`}>
          <div className="trajectory-scale">
            <span>Início</span>
            <b style={{ left: `${expectedPosition}%` }}>Hoje · {formatPercent(expectedPosition)} da meta</b>
            <span>Meta mensal</span>
          </div>
          <div
            className="trajectory-track"
            role="progressbar"
            aria-label="Progresso realizado em relação à trajetória do mês"
            aria-valuenow={Math.round(realizedPosition)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="trajectory-fill" style={{ width: `${realizedPosition}%` }}><i /></span>
            <span className="trajectory-gap-zone" style={{ left: `${trajectoryGapStart}%`, width: `${trajectoryGapWidth}%` }} />
            <span className="trajectory-today-marker" style={{ left: `${expectedPosition}%` }}><i /><em>Esperado</em></span>
            <span className="trajectory-realized-pin" style={{ left: `${realizedPosition}%` }} />
          </div>
          <div className="trajectory-legend">
            <span><i className="legend-achieved" />Realizado <b>{formatPercent(realizedPosition)}</b></span>
            <span><i className="legend-expected" />Esperado <b>{formatPercent(expectedPosition)}</b></span>
            <strong className={metrics.gap >= 0 ? "positive" : "negative"}>
              {metrics.gap >= 0 ? "Ritmo adiantado" : `${formatPercent(Math.max(100 - metrics.trajectoryPercentage, 0))} abaixo do ritmo`}
            </strong>
          </div>
        </div>
      </section>

      {/* Performance por canal */}
      <div className="section-heading channels-heading">
        <div>
          <span className="eyebrow">Performance por canal</span>
          <h2>Onde o resultado acontece</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("history")}>
          Ver histórico <ChevronRight size={16} />
        </button>
      </div>
      <section className="channel-scroller">
        {metrics.channels.map((channel) => (
          <article className="channel-card surface-card" key={channel.key}>
            <div className="channel-head">
              <span className={`channel-icon channel-${channel.key}`}>
                <IconForChannel channel={channel.key} />
              </span>
              <ProgressRing value={channel.percentage} size={62} tone={channel.key} />
            </div>
            <span className="eyebrow">{channel.label}</span>
            <strong className="channel-value">{formatMoney(channel.realized)}</strong>
            <p>de {formatMoney(channel.goal)}</p>
            <ProgressBar value={channel.percentage} tone={channel.key} />
            <div className="channel-bottom">
              <span>Faltam {formatMoney(Math.max(-channel.gap, 0))}</span>
              <Trend value={channel.trend} />
            </div>
            <Sparkline values={channelValues(channel.key)} />
          </article>
        ))}
      </section>

      {/* Dashboard Charts: Stacked vs Line */}
      <section className="dashboard-grid">
        <article className="surface-card chart-card span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Evolução por canais</span>
              <h2>Vendas dos últimos dias</h2>
            </div>
            <div className="chart-type-toggle">
              <button className={chartType === "stacked" ? "active" : ""} onClick={() => setChartType("stacked")}>
                Canais empilhados
              </button>
              <button className={chartType === "line" ? "active" : ""} onClick={() => setChartType("line")}>
                Linha
              </button>
            </div>
          </div>
          {chartType === "stacked" ? (
            <StackedChannelChart entries={currentEntries} unit={unit} />
          ) : (
            <LineChart entries={currentEntries} unit={unit} />
          )}
        </article>
        <article className="surface-card chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Composição</span>
              <h2>Participação</h2>
            </div>
          </div>
          <Donut channels={metrics.channels} />
        </article>
      </section>

      {/* Metrics Grid with Ticket Médio & Comandas */}
      <section className="metrics-grid">
        <article className="surface-card compact-metric">
          <span className="metric-icon icon-blue"><ShoppingBag size={19} /></span>
          <div>
            <span>Ticket Médio Geral</span>
            <strong>{averageTicket > 0 ? formatMoney(averageTicket) : "—"}</strong>
            <small>{totalSessions} comandas registradas</small>
          </div>
        </article>
        <article className="surface-card compact-metric">
          <span className="metric-icon icon-purple"><Rocket size={19} /></span>
          <div>
            <span>Projeção do mês</span>
            <strong>{formatMoney(metrics.projection)}</strong>
            <small className={metrics.projection >= unit.monthlyGoal ? "positive" : "negative"}>
              {metrics.projection >= unit.monthlyGoal ? "+" : "−"}{formatMoney(Math.abs(metrics.projection - unit.monthlyGoal))} vs. meta
            </small>
          </div>
        </article>
        <article className="surface-card compact-metric">
          <span className="metric-icon icon-blue"><Target size={19} /></span>
          <div>
            <span>Média necessária</span>
            <strong>{formatMoney(metrics.necessaryAverage)}<small>/dia</small></strong>
            <small>{metrics.remainingDays} dias restantes</small>
          </div>
        </article>
        <article className="surface-card compact-metric">
          <span className="metric-icon icon-green"><BarChart3 size={19} /></span>
          <div>
            <span>Média últimos 7 dias</span>
            <strong>{formatMoney(metrics.last7Average)}</strong>
            <Trend value={metrics.weeklyEvolution} />
          </div>
        </article>
      </section>

      {/* Bonus Preview */}
      <section className="bonus-preview surface-card">
        <div className="bonus-copy">
          <span className="metric-icon icon-amber"><CircleDollarSign size={20} /></span>
          <div>
            <span className="eyebrow">Minha bonificação</span>
            <h2>{formatMoney(bonus.conquered)} conquistados</h2>
            <p>Potencial total de {formatMoney(bonus.potential)}</p>
          </div>
        </div>
        <ProgressRing value={(bonus.conquered / bonus.potential) * 100} size={68} tone="warning" />
        <button className="secondary-button" onClick={() => onNavigate("profile")}>
          Ver detalhamento <ChevronRight size={16} />
        </button>
      </section>

      {/* AI Card */}
      <section className="ai-card">
        <div className="ai-glow" />
        <div className="ai-label"><Sparkles size={17} /> Insight House IA</div>
        <h2>{metrics.worstChannel.label} precisa de atenção</h2>
        <p>
          O canal está em {formatPercent(metrics.worstChannel.percentage)} da meta e é o principal desvio atual. A média necessária da unidade subiu para <strong>{formatMoney(metrics.necessaryAverage)}/dia</strong>.
        </p>
        <div className="ai-actions">
          <button className="ai-primary" onClick={() => onNavigate("ai")}>
            <Sparkles size={17} /> Ver análise completa
          </button>
          <button className="ai-secondary" onClick={() => onNavigate("ai")}>
            Gerar plano de ação
          </button>
        </div>
      </section>
    </div>
  );
}

function FreelancersModal({
  unit,
  freelancers,
  onSave,
  onDelete,
  onClose,
}: {
  unit: UnitConfig;
  freelancers: FreelancerEntry[];
  onSave: (entry: FreelancerEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(isoDate(currentDate));
  const [role, setRole] = useState("Chapeiro");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(120);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const unitFreelancers = freelancers.filter((f) => f.unitId === unit.id);
  const totalSpent = unitFreelancers.reduce((sum, f) => sum + f.amount, 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setSaving(true);
    try {
      const entry: FreelancerEntry = {
        id: `${unit.id}_${date}_${Date.now()}`,
        unitId: unit.id,
        date,
        month: date.slice(0, 7),
        role,
        name: name.trim() || undefined,
        amount,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(entry);
      setName("");
      setNotes("");
      setAmount(120);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-modal surface-card" style={{ maxWidth: 600 }}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <span className="modal-icon"><UsersRound size={24} /></span>
        <h2>Controle de Freelancers & Diaristas</h2>
        <p>Regra da House: Limite máximo de <b>R$ 1.500,00 no mês</b> para não bloquear o bônus do Salão.</p>

        <div className="freelancer-cap-bar" style={{ margin: "14px 0" }}>
          <div className="freelancer-cap-head">
            <span>Total gasto: <b>{formatMoney(totalSpent)}</b></span>
            <span>Teto: <b>R$ 1.500,00</b></span>
          </div>
          <div className="freelancer-cap-track">
            <div
              className="freelancer-cap-fill"
              style={{
                width: `${Math.min((totalSpent / 1500) * 100, 100)}%`,
                background: totalSpent <= 1200 ? "var(--success)" : totalSpent <= 1500 ? "var(--warning)" : "var(--danger)",
              }}
            />
          </div>
          {totalSpent > 1500 && (
            <small style={{ color: "var(--danger)", fontWeight: 700 }}>
              ⚠️ Limite ultrapassado em {formatMoney(totalSpent - 1500)}. Bônus do canal Salão bloqueado.
            </small>
          )}
        </div>

        <form onSubmit={handleSave} className="freelancer-form">
          <strong style={{ fontSize: 13 }}>Registrar nova diária</strong>
          <div className="freelancer-inputs">
            <label>
              <span>Data</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              <span>Função</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="Chapeiro">Chapeiro</option>
                <option value="Atendente">Atendente / Garçom</option>
                <option value="Motoboy">Motoboy</option>
                <option value="Auxiliar de Cozinha">Auxiliar de Cozinha</option>
                <option value="Caixa">Caixa</option>
              </select>
            </label>
            <label>
              <span>Nome (opcional)</span>
              <input type="text" placeholder="Nome do diarista" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span>Valor (R$)</span>
              <input type="number" min="0" step="10" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} required />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={saving || amount <= 0} style={{ width: "100%", justifyContent: "center" }}>
            <PlusCircle size={16} /> {saving ? "Salvando..." : "Adicionar Diária"}
          </button>
        </form>

        <div className="freelancer-list" style={{ maxHeight: 220, overflowY: "auto", marginTop: 12 }}>
          <strong style={{ fontSize: 12 }}>Histórico de diárias deste mês ({unitFreelancers.length})</strong>
          {unitFreelancers.length ? (
            unitFreelancers.map((item) => (
              <div className="freelancer-item" key={item.id}>
                <div>
                  <strong>{formatDateBR(item.date)} · {item.role} {item.name ? `(${item.name})` : ""}</strong>
                  <small>{item.notes || "Sem observação"}</small>
                </div>
                <div className="freelancer-item-right">
                  <strong>{formatMoney(item.amount)}</strong>
                  <button className="freelancer-del-btn" onClick={() => void onDelete(item.id)} title="Excluir lançamento">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Nenhuma diária lançada neste mês.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MoneyInput({ label, value, onChange, icon }: { label: string; value: number; onChange: (value: number) => void; icon: React.ReactNode }) {
  return (
    <label className="money-field">
      <span className="field-icon">{icon}</span>
      <span className="field-copy">
        <b>{label}</b>
        <small>Valor válido para a meta</small>
      </span>
      <span className="money-control">
        <i>R$</i>
        <input
          inputMode="decimal"
          value={value ? formatMoneyInput(value) : ""}
          placeholder="0,00"
          onChange={(event) => onChange(parseMoney(event.target.value))}
          aria-label={`Valor de ${label}`}
        />
      </span>
    </label>
  );
}

function LaunchScreen({
  unit,
  entries,
  onSave,
  onSync,
}: {
  unit: UnitConfig;
  entries: SalesEntry[];
  onSave: (entry: SalesEntry) => Promise<void>;
  onSync: (unitId: string, date: string) => Promise<SalesEntry>;
}) {
  const [date, setDate] = useState(isoDate(currentDate));
  const existing = entries.find((entry) => entry.unitId === unit.id && entry.date === date);
  const [salao, setSalao] = useState(existing?.salao || 0);
  const [delivery, setDelivery] = useState(existing?.delivery || 0);
  const [ifood, setIfood] = useState(existing?.ifood || 0);
  const [deliveryDetails, setDeliveryDetails] = useState<Record<string, number>>(existing?.deliveryDetails || {});
  const [ifoodDetails, setIfoodDetails] = useState<Record<string, number>>(existing?.ifoodDetails || {});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const total = salao + delivery + ifood;
  const [y, m, d] = date.split("-").map(Number);
  const dailyTarget = unit.dailyTargets[new Date(y, m - 1, d).getDay()];

  const changeDate = (nextDate: string) => {
    const found = entries.find((entry) => entry.unitId === unit.id && entry.date === nextDate);
    setDate(nextDate);
    setSalao(found?.salao || 0);
    setDelivery(found?.delivery || 0);
    setIfood(found?.ifood || 0);
    setDeliveryDetails(found?.deliveryDetails || {});
    setIfoodDetails(found?.ifoodDetails || {});
  };

  const persist = async () => {
    setSaving(true);
    await onSave({
      id: `${unit.id}_${date}`,
      unitId: unit.id,
      date,
      salao,
      delivery,
      ifood,
      deliveryDetails,
      ifoodDetails,
      createdBy: "gerente@house190.com.br",
      updatedAt: new Date().toISOString(),
    });
    setSaving(false);
  };

  const syncTakeat = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const entry = await onSync(unit.id, date);
      setSalao(entry.salao);
      setDelivery(entry.delivery);
      setIfood(entry.ifood);
      setDeliveryDetails(entry.deliveryDetails || {});
      setIfoodDetails(entry.ifoodDetails || {});
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar a Takeat.");
    } finally {
      setSyncing(false);
    }
  };

  // Sub-brand calculations
  const xtudoDelivery = deliveryDetails.xtudo || 0;
  const house190DeliveryRemaining = Math.max(delivery - xtudoDelivery, 0);
  const xtudoIfood = ifoodDetails.xtudo || 0;
  const house190IfoodRemaining = Math.max(ifood - xtudoIfood, 0);

  const frangoDelivery = deliveryDetails.frango || 0;
  const pizzaDelivery = deliveryDetails.pizza || 0;
  const burgerDeliveryRemaining = Math.max(delivery - frangoDelivery - pizzaDelivery, 0);
  const frangoIfood = ifoodDetails.frango || 0;
  const pizzaIfood = ifoodDetails.pizza || 0;

  return (
    <div className="screen-stack narrow-screen">
      <div className="page-title">
        <div>
          <span className="eyebrow">Lançamento diário</span>
          <h1>Vendas & Separação de Produtos</h1>
          <p>Os totais vêm da Takeat e você pode informar os valores do cardápio X-Tudo ou Frango/Pizza.</p>
        </div>
        <div className="date-picker">
          <CalendarDays size={17} />
          <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
        </div>
      </div>

      <section className="takeat-sync surface-card">
        <div>
          <span className="takeat-logo">T</span>
          <div>
            <strong>Integração Takeat</strong>
            <small>{existing?.source === "takeat" ? `Sincronizado · ${existing.sourceSummary?.sessions || 0} vendas` : "Importar Salão, Delivery e iFood"}</small>
          </div>
        </div>
        <button className="secondary-button" onClick={() => void syncTakeat()} disabled={syncing}>
          {syncing ? "Sincronizando..." : "Sincronizar agora"}
        </button>
        {syncError && <p className="sync-error">{syncError}</p>}
      </section>

      <section className="surface-card launch-card">
        <div className="launch-date">
          <span>{formatDateBR(date)}</span>
          <b>Meta do dia: {formatMoney(dailyTarget.total)}</b>
        </div>
        <div className="money-fields">
          <MoneyInput label="Salão" value={salao} onChange={setSalao} icon={<UtensilsCrossed size={21} />} />
          <MoneyInput label="Delivery próprio (Total)" value={delivery} onChange={setDelivery} icon={<Truck size={21} />} />
          <MoneyInput label="iFood (Total)" value={ifood} onChange={setIfood} icon={<ShoppingBag size={21} />} />
        </div>
        <div className="launch-total">
          <div>
            <span>Total do dia</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div>
            <span>Meta diária</span>
            <strong>{formatMoney(dailyTarget.total)}</strong>
          </div>
          <span className={`day-gap ${total >= dailyTarget.total ? "positive" : "negative"}`}>
            {total >= dailyTarget.total ? "+" : "−"}{formatMoney(Math.abs(total - dailyTarget.total))}
          </span>
        </div>
        <ProgressBar value={(total / dailyTarget.total) * 100} />
      </section>

      {/* SEPARAÇÃO DE PRODUTOS / SUB-MARCAS PARA METAS */}
      <section className="detail-section surface-card" style={{ padding: 20 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Separação de Produtos para Bonificação</span>
            <h2>{unit.type === "house190" ? "Faturamento X-Tudo (Opcional)" : "Faturamento Frango e Pizza (Opcional)"}</h2>
            <p>
              {unit.type === "house190"
                ? "Informe apenas o que for do cardápio X-Tudo. O restante do Delivery e iFood é atribuído automaticamente à House190!"
                : "Informe o valor vendido de Frango e Pizza. O restante do Delivery é atribuído automaticamente aos Lanches / Burger!"}
            </p>
          </div>
        </div>

        {unit.type === "house190" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label className="money-field">
                <span className="field-icon"><Truck size={20} /></span>
                <span className="field-copy">
                  <b>X-Tudo no Delivery Próprio</b>
                  <small>House190 Delivery fica: {formatMoney(houseDeliveryRemaining)}</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={xtudoDelivery ? formatMoneyInput(xtudoDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setDeliveryDetails({ ...deliveryDetails, xtudo: parseMoney(e.target.value) })}
                  />
                </span>
              </label>

              <label className="money-field">
                <span className="field-icon"><ShoppingBag size={20} /></span>
                <span className="field-copy">
                  <b>X-Tudo no iFood</b>
                  <small>House190 iFood fica: {formatMoney(houseIfoodRemaining)}</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={xtudoIfood ? formatMoneyInput(xtudoIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setIfoodDetails({ ...ifoodDetails, xtudo: parseMoney(e.target.value) })}
                  />
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label className="money-field">
                <span className="field-icon"><Truck size={20} /></span>
                <span className="field-copy">
                  <b>Frango Delivery</b>
                  <small>Vendas de Chicken</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={frangoDelivery ? formatMoneyInput(frangoDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setDeliveryDetails({ ...deliveryDetails, frango: parseMoney(e.target.value) })}
                  />
                </span>
              </label>

              <label className="money-field">
                <span className="field-icon"><ShoppingBag size={20} /></span>
                <span className="field-copy">
                  <b>Frango iFood</b>
                  <small>Vendas de Chicken</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={frangoIfood ? formatMoneyInput(frangoIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setIfoodDetails({ ...ifoodDetails, frango: parseMoney(e.target.value) })}
                  />
                </span>
              </label>

              <label className="money-field">
                <span className="field-icon"><Truck size={20} /></span>
                <span className="field-copy">
                  <b>Pizza Delivery</b>
                  <small>Vendas de Pizza</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={pizzaDelivery ? formatMoneyInput(pizzaDelivery) : ""}
                    placeholder="0,00"
                    onChange={(e) => setDeliveryDetails({ ...deliveryDetails, pizza: parseMoney(e.target.value) })}
                  />
                </span>
              </label>

              <label className="money-field">
                <span className="field-icon"><ShoppingBag size={20} /></span>
                <span className="field-copy">
                  <b>Pizza iFood</b>
                  <small>Vendas de Pizza</small>
                </span>
                <span className="money-control">
                  <i>R$</i>
                  <input
                    inputMode="decimal"
                    value={pizzaIfood ? formatMoneyInput(pizzaIfood) : ""}
                    placeholder="0,00"
                    onChange={(e) => setIfoodDetails({ ...ifoodDetails, pizza: parseMoney(e.target.value) })}
                  />
                </span>
              </label>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>
              Burger / Lanches Delivery restante: <b>{formatMoney(burgerDeliveryRemaining)}</b>
            </p>
          </div>
        )}
      </section>

      <div className="form-note">
        <ShieldCheck size={18} />
        <p>Frete, brindes, cancelamentos, estornos e receitas de terceiros não devem entrar nos valores.</p>
      </div>

      <button className="primary-button save-button" onClick={() => void persist()} disabled={saving || total <= 0}>
        <Save size={19} />
        {saving ? "Salvando..." : existing ? "Atualizar vendas" : "Salvar vendas"}
      </button>
    </div>
  );
}

function HistoryScreen({ unit, entries }: { unit: UnitConfig; entries: SalesEntry[] }) {
  const [period, setPeriod] = useState("month");
  const unitEntries = entries.filter((entry) => entry.unitId === unit.id).slice().reverse();
  const visible = period === "today" ? unitEntries.slice(0, 1) : period === "7" ? unitEntries.slice(0, 7) : unitEntries;
  const total = visible.reduce((sum, entry) => sum + entryTotal(entry), 0);

  return (
    <div className="screen-stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Histórico</span>
          <h1>Evolução das vendas</h1>
          <p>Entenda dias fortes, quedas e recuperação.</p>
        </div>
      </div>
      <div className="segmented-control" role="tablist">
        {[["today","Hoje"],["7","7 dias"],["month","Mês"]].map(([key,label]) => (
          <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>
      <section className="history-summary surface-card">
        <div>
          <span>Faturamento no período</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div>
          <span>Média por dia</span>
          <strong>{formatMoney(total / Math.max(visible.length, 1))}</strong>
        </div>
        <div>
          <span>Melhor dia</span>
          <strong>{visible.length ? formatMoney(Math.max(...visible.map(entryTotal))) : formatMoney(0)}</strong>
        </div>
      </section>
      <section className="surface-card history-list">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Lançamentos</span>
            <h2>{visible.length} dias registrados</h2>
          </div>
        </div>
        {visible.map((entry) => {
          const [year, month, day] = entry.date.split("-").map(Number);
          const target = unit.dailyTargets[new Date(year, month - 1, day).getDay()].total;
          const result = entryTotal(entry);
          const monthNames = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
          return (
            <article className="history-row" key={entry.id}>
              <div className="history-date">
                <strong>{day}</strong>
                <span>{monthNames[month - 1]}</span>
              </div>
              <div className="history-main">
                <div>
                  <strong>{formatMoney(result)}</strong>
                  <span>Meta {formatMoney(target)}</span>
                </div>
                <ProgressBar value={(result / target) * 100} />
                <small>Salão {formatMoney(entry.salao)} · Delivery {formatMoney(entry.delivery)} · iFood {formatMoney(entry.ifood)}</small>
              </div>
              <span className={`status-dot ${result >= target ? "green" : result >= target * 0.93 ? "yellow" : "red"}`} />
            </article>
          );
        })}
      </section>
    </div>
  );
}

type AIResult = { diagnostic: string; alert: string; numbers: string[]; actions: string[]; tomorrow: string; demo?: boolean };
function AIScreen({ unit, entries }: { unit: UnitConfig; entries: SalesEntry[] }) {
  const metrics = calculatePerformance(unit, entries, currentDate);
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("Analisar minha performance");

  const analyze = async (intent: string) => {
    setLoading(true);
    setPrompt(intent);
    const [salao, delivery, ifood] = metrics.channels;
    const payload = {
      solicitacao: intent,
      unidade: unit.name,
      metaMensal: unit.monthlyGoal,
      superMeta: unit.superGoal,
      faturamentoAtual: metrics.total,
      metaEsperadaAteHoje: metrics.expected,
      gap: metrics.gap,
      projecao: metrics.projection,
      diasRestantes: metrics.remainingDays,
      mediaNecessaria: metrics.necessaryAverage,
      tendencia7Dias: metrics.weeklyEvolution,
      salao: { label: salao.label, realizado: salao.realized, meta: salao.goal },
      delivery: { label: delivery.label, realizado: delivery.realized, meta: delivery.goal },
      ifood: { label: ifood.label, realizado: ifood.realized, meta: ifood.goal },
      regras: MANAGEMENT_RULES,
    };
    try {
      const data = await requestAiAnalysis(payload);
      setResult(data);
    } catch (err) {
      console.error("Erro na análise House IA:", err);
      setResult({
        diagnostic: "Não foi possível gerar a análise agora.",
        alert: "Verifique os dados da unidade e tente novamente.",
        numbers: [],
        actions: [],
        tomorrow: "Atualize os lançamentos diários e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-stack ai-screen">
      <div className="page-title">
        <div>
          <span className="eyebrow">House IA</span>
          <h1>Consultor de performance</h1>
          <p>Análises baseadas nos números reais e calculados pelo sistema.</p>
        </div>
      </div>
      <section className="ai-command-card">
        <div className="ai-orb"><Bot size={30} /></div>
        <div>
          <span className="ai-label"><Sparkles size={15} /> Analista de gestão</span>
          <h2>Qual decisão você precisa tomar?</h2>
          <p>A IA interpreta trajetória, canais, tendência, projeção e regras do programa.</p>
        </div>
      </section>
      <div className="ai-prompt-grid">
        {["Analisar minha performance", "Como recuperar minha meta?", "Gerar plano de ação", "Analisar últimos 7 dias", "O que está prejudicando minha meta?", "Como alcançar a supermeta?"].map((item) => (
          <button key={item} onClick={() => void analyze(item)}>
            <Lightbulb size={17} />
            <span>{item}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      {(loading || result) && (
        <section className="analysis-result surface-card">
          <div className="analysis-header">
            <div>
              <span className="eyebrow">Análise solicitada</span>
              <h2>{prompt}</h2>
            </div>
            {result?.demo && <span className="demo-badge">Modo demonstração</span>}
          </div>
          {loading ? (
            <div className="analysis-skeleton">{[1,2,3,4].map((item) => <div key={item}><i /><i /><i /></div>)}</div>
          ) : result && (
            <div className="analysis-sections">
              <article>
                <span className="analysis-number">01</span>
                <div>
                  <h3>Diagnóstico</h3>
                  <p>{result.diagnostic}</p>
                </div>
              </article>
              <article className="alert-section">
                <span className="analysis-number">02</span>
                <div>
                  <h3>Principal alerta</h3>
                  <p>{result.alert}</p>
                </div>
              </article>
              <article className="analysis-number-section">
                <span className="analysis-number">03</span>
                <div>
                  <h3>Números importantes</h3>
                  <ul>{result.numbers?.map((number) => <li key={number}>{number}</li>)}</ul>
                </div>
              </article>
              <article className="analysis-action-section">
                <span className="analysis-number">04</span>
                <div>
                  <h3>Plano de ação</h3>
                  <ol>{result.actions?.map((action, index) => <li key={action}><b>{index + 1}</b>{action}</li>)}</ol>
                </div>
              </article>
              <article className="focus-section">
                <span className="analysis-number"><Target size={18} /></span>
                <div>
                  <h3>Foco prioritário</h3>
                  <p>{result.tomorrow}</p>
                </div>
              </article>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProfileScreen({
  unit,
  entries,
  cmvRecords,
  freelancers,
  role,
  profile,
  onLogout,
  onOpenFreelancers,
  onOpenSubBrands,
}: {
  unit: UnitConfig;
  entries: SalesEntry[];
  cmvRecords: CmvEntry[];
  freelancers: FreelancerEntry[];
  role: UserRole;
  profile: { name: string; email: string };
  onLogout: () => void;
  onOpenFreelancers: () => void;
  onOpenSubBrands: () => void;
}) {
  const currentMonthPrefix = isoDate(currentDate).slice(0, 7);
  const liveRevenue = (record: CmvEntry) => {
    const hasLoadedPeriod = entries.some((sale) => sale.unitId === record.unitId && sale.date >= record.weekStart && sale.date <= record.weekEnd);
    return hasLoadedPeriod ? revenueForPeriod(entries, record.unitId, record.weekStart, record.weekEnd) : record.revenue;
  };
  const liveCmvRecords = cmvRecords.map((r) => ({ ...r, revenue: liveRevenue(r) }));
  const monthCmvMetrics = monthlyCmv(liveCmvRecords, unit, currentMonthPrefix);

  const freelancerSpend = freelancers.filter((f) => f.unitId === unit.id).reduce((sum, f) => sum + f.amount, 0);
  const [operating, setOperating] = useState<OperatingInputs>({
    cmvPercent: monthCmvMetrics.weeks > 0 ? monthCmvMetrics.percentage : 32.8,
    freelancerSpend,
  });

  useEffect(() => {
    setOperating({
      cmvPercent: monthCmvMetrics.weeks > 0 ? monthCmvMetrics.percentage : 32.8,
      freelancerSpend,
    });
  }, [monthCmvMetrics.percentage, freelancerSpend, monthCmvMetrics.weeks]);

  const bonus = calculateBonus(unit, entries.filter((entry) => entry.unitId === unit.id), operating);

  return (
    <div className="screen-stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Performance e perfil</span>
          <h1>Minha bonificação</h1>
          <p>Regras aplicadas automaticamente à apuração.</p>
        </div>
        <button className="primary-button" onClick={onOpenSubBrands}>
          <Utensils size={16} /> Lançar X-Tudo / Frango
        </button>
      </div>

      <section className="bonus-hero surface-card">
        <div>
          <span className="eyebrow">Bônus conquistado</span>
          <strong>{formatMoney(bonus.conquered)}</strong>
          <p>de {formatMoney(bonus.potential)} possíveis</p>
        </div>
        <ProgressRing value={(bonus.conquered / bonus.potential) * 100} size={104} tone="warning" />
      </section>

      {(bonus.cmvBlocked || bonus.minimumBlocked) && (
        <div className="blocking-alert">
          <ShieldCheck size={20} />
          <div>
            <strong>Bonificação bloqueada</strong>
            <p>{bonus.cmvBlocked ? "O CMV está acima do limite de 35%." : "É necessário atingir pelo menos duas categorias."}</p>
          </div>
        </div>
      )}

      <section className="bonus-list surface-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Categorias</span>
            <h2>Progresso da apuração</h2>
          </div>
          <button className="secondary-button" onClick={onOpenSubBrands}>
            <PlusCircle size={15} /> Ajustar X-Tudo / Frango
          </button>
        </div>
        {bonus.categories.map((category) => (
          <article key={category.label}>
            <div className="bonus-status">
              <span className={category.unlocked ? "done" : category.percentage >= 80 ? "near" : "far"}>
                {category.unlocked ? "✓" : Math.round(category.percentage) + "%"}
              </span>
              <div>
                <strong>{category.label}</strong>
                <small>{formatMoney(category.realized)} de {formatMoney(category.goal)}</small>
              </div>
            </div>
            <div className="bonus-amount">
              <span>{category.unlocked ? "Conquistado" : "Potencial"}</span>
              <strong>{formatMoney(category.bonus)}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="surface-card operating-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Critérios operacionais</span>
            <h2>CMV e freelancers</h2>
          </div>
          <button className="secondary-button" onClick={onOpenFreelancers}>
            <UsersRound size={15} /> Gerenciar Diaristas
          </button>
        </div>
        <div className="operating-inputs">
          <label>
            <span>CMV do mês</span>
            <div>
              <input type="number" step="0.1" value={operating.cmvPercent} onChange={(event) => setOperating({ ...operating, cmvPercent: Number(event.target.value) })} />
              <i>%</i>
            </div>
            <small>Máximo permitido: 35%</small>
          </label>
          <label>
            <span>Freelancers</span>
            <div>
              <i>R$</i>
              <input type="number" value={operating.freelancerSpend} onChange={(event) => setOperating({ ...operating, freelancerSpend: Number(event.target.value) })} />
            </div>
            <small>Limite: R$ 1.500</small>
          </label>
        </div>
      </section>

      <section className="surface-card profile-card">
        <div className="avatar-large">
          {profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <strong>{profile.name || "Usuário House"}</strong>
          <span>{profile.email}</span>
          <small>{role === "admin" ? "Acesso a todas as unidades" : unit.name}</small>
        </div>
        <span className="profile-role">{role === "admin" ? "Administrador" : "Gerente"}</span>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={17} /> Sair da conta
        </button>
      </section>
    </div>
  );
}

function AdminScreen({
  entries,
  units,
  onUnit,
  onSaveGoals,
}: {
  entries: SalesEntry[];
  units: UnitConfig[];
  onUnit: (unit: UnitConfig) => void;
  onSaveGoals: (unit: UnitConfig) => Promise<void>;
}) {
  const cards = units.map((unit) => ({ unit, metrics: calculatePerformance(unit, entries, currentDate) })).sort((a, b) => b.metrics.trajectoryPercentage - a.metrics.trajectoryPercentage);
  return (
    <div className="screen-stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h1>Visão geral das unidades</h1>
          <p>Compare performance, risco e distância da trajetória.</p>
        </div>
        <button className="secondary-button"><UsersRound size={17} /> Gerenciar equipe</button>
      </div>
      <section className="admin-overview">
        <article className="surface-card">
          <span>Faturamento consolidado</span>
          <strong>{formatMoney(cards.reduce((sum, card) => sum + card.metrics.total, 0))}</strong>
          <Trend value={2.8} />
        </article>
        <article className="surface-card">
          <span>Unidades no ritmo</span>
          <strong>{cards.filter((card) => card.metrics.health === "green").length} de 3</strong>
          <small>Atualizado hoje</small>
        </article>
        <article className="surface-card">
          <span>Bonificação potencial</span>
          <strong>{formatMoney(9000)}</strong>
          <small>Máximo das três unidades</small>
        </article>
      </section>
      <section className="unit-admin-grid">
        {cards.map(({ unit, metrics }, index) => (
          <button className="unit-admin-card surface-card" key={unit.id} onClick={() => onUnit(unit)}>
            <div className="unit-rank">#{index + 1}</div>
            <div className="unit-card-head">
              <span className="unit-logo"><Building2 size={21} /></span>
              <div>
                <strong>{unit.name}</strong>
                <span className={`status-badge status-${metrics.health === "green" ? "success" : "warning"}`}>
                  {metrics.healthLabel}
                </span>
              </div>
            </div>
            <div className="unit-main-metric">
              <span>Realizado</span>
              <strong>{formatMoney(metrics.total)}</strong>
            </div>
            <ProgressBar value={metrics.percentage} expected={(metrics.expected / unit.monthlyGoal) * 100} />
            <div className="unit-stats">
              <div>
                <span>Trajetória</span>
                <strong>{formatPercent(metrics.trajectoryPercentage)}</strong>
              </div>
              <div>
                <span>Gap</span>
                <strong className={metrics.gap >= 0 ? "positive" : "negative"}>
                  {metrics.gap >= 0 ? "+" : "−"}{formatMoney(Math.abs(metrics.gap))}
                </strong>
              </div>
              <div>
                <span>Projeção</span>
                <strong>{formatMoney(metrics.projection)}</strong>
              </div>
            </div>
            <span className="unit-open">Abrir unidade <ChevronRight size={16} /></span>
          </button>
        ))}
      </section>
      <AdminGoalEditor units={units} onSave={onSaveGoals} />
    </div>
  );
}

function AppNavigation({
  view,
  setView,
  role,
  profile,
  onLogout,
}: {
  view: View;
  setView: (view: View) => void;
  role: UserRole;
  profile: { name: string; email: string };
  onLogout: () => void;
}) {
  const items: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Início", icon: <Home size={19} /> },
    { key: "launch", label: "Sub-marcas", icon: <Utensils size={19} /> },
    { key: "history", label: "Histórico", icon: <History size={19} /> },
    { key: "cmv", label: "CMV", icon: <CircleDollarSign size={19} /> },
    { key: "ai", label: "House IA", icon: <Sparkles size={19} /> },
    { key: "profile", label: "Perfil", icon: <UserRound size={19} /> },
  ];
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BarChart3 size={23} /></span>
          <div>
            <strong>HOUSE GESTÃO</strong>
            <small>Central de Metas</small>
          </div>
        </div>
        <nav>
          {role === "admin" && (
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Building2 size={20} /><span>Visão geral</span></button>
          )}
          {items.map((item) => (
            <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
              {item.icon}
              <span>{item.label === "Início" ? "Dashboard" : item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button><Settings size={19} /> Configurações</button>
          <div className="sidebar-user">
            <div className="avatar">
              {profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{profile.name || "Usuário House"}</strong>
              <span>{role === "admin" ? "Administrador" : "Gerente"}</span>
            </div>
            <button className="logout-icon" onClick={onLogout} aria-label="Sair da conta"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <nav className="bottom-nav">
        {items.map((item) => (
          <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => Promise<void>; error: string; loading: boolean }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark"><BarChart3 size={26} /></span>
          <div>
            <strong>HOUSE GESTÃO</strong>
            <small>Central de Metas e Performance</small>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Acesso seguro</span>
          <h1>Bem-vindo de volta</h1>
          <p>Entre para acompanhar a performance da sua unidade.</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void onLogin(email, password); }}>
          <label>
            <span>E-mail</span>
            <input type="email" required autoComplete="email" placeholder="seuemail@house190.com.br" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Senha</span>
            <input type="password" required autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar no HOUSE GESTÃO"}</button>
        </form>
        <div className="login-safe">
          <ShieldCheck size={16} />
          <span>Seus dados são protegidos pelo Firebase Authentication.</span>
        </div>
      </section>
      <aside className="login-visual">
        <div className="login-glow" />
        <span className="ai-label"><Sparkles size={15} /> Gestão que antecipa decisões</span>
        <h2>Transforme números diários em crescimento.</h2>
        <p>Trajetória, canais, projeção, bonificação e plano de ação em um único lugar.</p>
        <div className="login-mock">
          <div>
            <span>Meta no ritmo</span>
            <strong>106,7%</strong>
          </div>
          <ProgressBar value={68} expected={63} />
          <small>Resultado acima da trajetória esperada</small>
        </div>
      </aside>
    </main>
  );
}

export default function HomePage() {
  const [view, setView] = useState<View>("dashboard");
  const [role, setRole] = useState<UserRole>("manager");
  const [units, setUnits] = useState<UnitConfig[]>(UNITS);
  const [unit, setUnit] = useState<UnitConfig>(UNITS[0]);
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [cmvRecords, setCmvRecords] = useState<CmvEntry[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerEntry[]>([]);
  const [freelancersModalOpen, setFreelancersModalOpen] = useState(false);
  const [subBrandModalOpen, setSubBrandModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [toast, setToast] = useState<string | null>(null);
  const [unitMenu, setUnitMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "signedout" | "signedin">(firebaseConfigured ? "checking" : "signedout");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "As vendas do mês serão buscadas automaticamente." });
  const [permittedUnits, setPermittedUnits] = useState<string[]>([]);

  async function synchronizeMonth(unitIds: string[]) {
    if (!unitIds.length) return;
    setSyncStatus({ state: "syncing", message: "Buscando Salão, Delivery e iFood desde o primeiro dia do mês..." });
    const [{ syncTakeatSale }, { saveDailySale }] = await Promise.all([import("@/lib/takeat-service"), import("@/lib/firestore-service")]);
    const dates = monthDatesUntil(currentDate), synchronized: SalesEntry[] = [], failures: string[] = [];
    let importedSessions = 0, ignoredSessions = 0;
    for (const unitId of unitIds) {
      for (let index = 0; index < dates.length; index += 3) {
        const batchDates = dates.slice(index, index + 3);
        const batch = await Promise.allSettled(batchDates.map((date) => syncTakeatSale(unitId, date)));
        for (const result of batch) {
          if (result.status === "fulfilled") {
            synchronized.push(result.value);
            const summary = result.value.sourceSummary;
            importedSessions += summary?.sessions ?? 0;
            ignoredSessions += summary?.ignored ?? 0;
            if (firebaseConfigured) void saveDailySale(result.value).catch(console.error);
          } else {
            failures.push(result.reason instanceof Error ? result.reason.message : "Erro");
          }
        }
      }
    }
    setEntries((current) => {
      const byId = new Map(current.map((e) => [`${e.unitId}_${e.date}`, e]));
      synchronized.forEach((e) => byId.set(`${e.unitId}_${e.date}`, e));
      return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
    setSyncStatus({
      state: "success",
      message: `${dates.length} dias atualizados • ${importedSessions} vendas válidas da Takeat sincronizadas.`,
    });
  }

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setLoaded(true);
      const saved = window.localStorage.getItem("house-theme") as Theme | null;
      if (saved) setTheme(saved);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem("house-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme, loaded]);

  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(null), 3200);
      return () => window.clearTimeout(id);
    }
  }, [toast]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let unsubscribe: undefined | (() => void);
    void (async () => {
      const [{ auth }, { onAuthStateChanged }, { loadUserProfile, loadUnitSales, loadCmvEntries, loadUnitGoals, loadFreelancerEntries }] = await Promise.all([
        import("@/lib/firebase"),
        import("firebase/auth"),
        import("@/lib/firestore-service"),
      ]);
      if (!auth) return setAuthState("signedout");
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setEntries([]);
          setCmvRecords([]);
          setFreelancers([]);
          setProfile({ name: "", email: "" });
          setAuthState("signedout");
          return;
        }
        const userProfile = await loadUserProfile(user.uid);
        if (!userProfile?.role) {
          setLoginError("Seu perfil ainda não foi liberado pelo administrador.");
          setAuthState("signedout");
          return;
        }
        setRole(userProfile.role);
        setProfile({ name: userProfile.name || user.email || "Usuário House", email: userProfile.email || user.email || "" });
        const monthPrefix = isoDate(currentDate).slice(0, 7);
        const permitted = userProfile.role === "admin" ? UNITS.map((item) => item.id) : userProfile.unitId ? [userProfile.unitId] : [];
        const [goalOverrides, storedCmv, storedFreelancers] = await Promise.all([
          loadUnitGoals(permitted).catch(() => []),
          loadCmvEntries(permitted).catch(() => []),
          loadFreelancerEntries(permitted, monthPrefix).catch(() => []),
        ]);
        const effectiveUnits = UNITS.map((base) => {
          const override = goalOverrides.find((item) => item.id === base.id);
          return override ? { ...base, ...override } : base;
        });
        setUnits(effectiveUnits);
        setCmvRecords(storedCmv);
        setFreelancers(storedFreelancers);
        if (userProfile.role === "admin") {
          const adminDefaultUnit = effectiveUnits.find((item) => item.id === "house190-teixeira") || effectiveUnits[0];
          setUnit(adminDefaultUnit);
          const salesByUnit = await Promise.all(effectiveUnits.map((item) => loadUnitSales(item.id, monthPrefix)));
          setEntries(salesByUnit.flat());
          setView("admin");
        } else if (userProfile.unitId) {
          const assigned = effectiveUnits.find((item) => item.id === userProfile.unitId);
          if (assigned) {
            setUnit(assigned);
            setEntries(await loadUnitSales(assigned.id, monthPrefix));
          }
        }
        setAuthState("signedin");
        const automaticUnits = userProfile.role === "admin" ? effectiveUnits.map((u) => u.id) : permitted;
        setPermittedUnits(permitted);
        void synchronizeMonth(automaticUnits).catch((error) =>
          setSyncStatus({ state: "error", message: error instanceof Error ? error.message : "Erro ao sincronizar Takeat" })
        );
      });
    })();
    return () => unsubscribe?.();
  }, []);

  const login = async (email: string, password: string) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([import("@/lib/firebase"), import("firebase/auth")]);
      if (!auth) throw new Error();
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setLoginError("E-mail ou senha inválidos. Confira os dados e tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    const [{ auth }, { signOut }] = await Promise.all([import("@/lib/firebase"), import("firebase/auth")]);
    if (auth) await signOut(auth);
    setEntries([]);
    setCmvRecords([]);
    setFreelancers([]);
    setPermittedUnits([]);
    setUnits(UNITS);
    setView("dashboard");
    setUnit(UNITS[0]);
  };

  const save = async (entry: SalesEntry) => {
    const normalized = { ...entry, source: entry.source || "manual" } as SalesEntry;
    if (firebaseConfigured) {
      const { saveDailySale } = await import("@/lib/firestore-service");
      await saveDailySale(normalized);
    }
    setEntries((current) => [...current.filter((item) => !(item.unitId === normalized.unitId && item.date === normalized.date)), normalized].sort((a, b) => a.date.localeCompare(b.date)));
    setToast(`Vendas de ${formatDateBR(normalized.date)} registradas.`);
  };

  const syncTakeat = async (unitId: string, date: string) => {
    const [{ syncTakeatSale }, { saveDailySale }] = await Promise.all([import("@/lib/takeat-service"), import("@/lib/firestore-service")]);
    const entry = await syncTakeatSale(unitId, date);
    await saveDailySale(entry);
    setEntries((current) => [...current.filter((item) => !(item.unitId === entry.unitId && item.date === entry.date)), entry].sort((a, b) => a.date.localeCompare(b.date)));
    setToast(`Takeat sincronizada: ${formatMoney(entryTotal(entry))} em ${formatDateBR(entry.date)}.`);
    return entry;
  };

  const saveCmv = async (entry: CmvEntry) => {
    if (firebaseConfigured) {
      const { saveCmvEntry } = await import("@/lib/firestore-service");
      await saveCmvEntry(entry);
    }
    setCmvRecords((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
    setToast(`CMV de ${formatDateBR(entry.weekStart)} a ${formatDateBR(entry.weekEnd)} salvo.`);
  };

  const saveFreelancer = async (entry: FreelancerEntry) => {
    if (firebaseConfigured) {
      const { saveFreelancerEntry } = await import("@/lib/firestore-service");
      await saveFreelancerEntry(entry);
    }
    setFreelancers((current) => [entry, ...current.filter((f) => f.id !== entry.id)].sort((a, b) => b.date.localeCompare(a.date)));
    setToast(`Diária de ${entry.role} (${formatMoney(entry.amount)}) registrada.`);
  };

  const deleteFreelancer = async (id: string) => {
    if (firebaseConfigured) {
      const { deleteFreelancerEntry } = await import("@/lib/firestore-service");
      await deleteFreelancerEntry(id);
    }
    setFreelancers((current) => current.filter((f) => f.id !== id));
    setToast("Lançamento de diarista removido.");
  };

  const saveGoals = async (updated: UnitConfig) => {
    if (role !== "admin") throw new Error("Apenas administradores podem editar metas.");
    if (firebaseConfigured) {
      const { saveUnitGoals } = await import("@/lib/firestore-service");
      await saveUnitGoals(updated);
    }
    setUnits((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setUnit((current) => (current.id === updated.id ? updated : current));
    setToast(`Metas de ${updated.shortName} foram atualizadas.`);
  };

  const switchTheme = () => setTheme((current) => (current === "system" ? "light" : current === "light" ? "dark" : "system"));
  const pickUnit = (next: UnitConfig) => {
    setUnit(next);
    setUnitMenu(false);
    setView("dashboard");
    if (role === "admin") void synchronizeMonth([next.id]);
  };

  if (authState === "checking") return <div className="app-loading"><span className="brand-mark"><BarChart3 size={25} /></span><div><i /><i /><i /></div></div>;
  if (authState === "signedout") return <LoginScreen onLogin={login} error={loginError} loading={loginLoading} />;

  return (
    <div className="app-shell">
      <AppNavigation view={view} setView={setView} role={role} profile={profile} onLogout={() => void logout()} />
      <main className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><BarChart3 size={20} /></span>
            <strong>HOUSE GESTÃO</strong>
          </div>
          <div className="unit-selector-wrap">
            <button className="unit-selector" onClick={() => role === "admin" && setUnitMenu(!unitMenu)}>
              <span className="unit-mini-logo"><Store size={18} /></span>
              <div>
                <small>Unidade atual</small>
                <strong>{unit.name}</strong>
              </div>
              {role === "admin" && <ChevronDown size={17} />}
            </button>
            {unitMenu && (
              <div className="unit-menu">
                {units.map((item) => (
                  <button key={item.id} className={item.id === unit.id ? "active" : ""} onClick={() => pickUnit(item)}>
                    <span><Building2 size={17} /></span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatMoney(item.monthlyGoal)} de meta</small>
                    </div>
                    {item.id === unit.id && <i>✓</i>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={switchTheme} aria-label="Alternar tema">
              {theme === "dark" ? <Moon size={19} /> : theme === "light" ? <Sun size={19} /> : <Activity size={19} />}
            </button>
            <button className="avatar-button" aria-label="Abrir perfil" onClick={() => setView("profile")}>
              <span>{profile.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "GC"}</span>
              <i />
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {view === "dashboard" && (
            <Dashboard
              unit={unit}
              units={units}
              entries={entries}
              cmvRecords={cmvRecords}
              freelancers={freelancers}
              onNavigate={setView}
              syncStatus={syncStatus}
              onSync={() => void synchronizeMonth(role === "admin" ? units.map((u) => u.id) : permittedUnits)}
              onOpenFreelancers={() => setFreelancersModalOpen(true)}
              onOpenSubBrands={() => setSubBrandModalOpen(true)}
            />
          )}
          {view === "launch" && (
            <LaunchScreen
              unit={unit}
              entries={entries}
              onSave={save}
              onSync={syncTakeat}
            />
          )}
          {view === "history" && <HistoryScreen unit={unit} entries={entries} />}
          {view === "cmv" && (
            <CmvScreen
              unit={unit}
              units={role === "admin" ? units : units.filter((item) => item.id === unit.id)}
              sales={entries}
              records={cmvRecords}
              role={role}
              onSave={saveCmv}
            />
          )}
          {view === "ai" && <AIScreen unit={unit} entries={entries} />}
          {view === "profile" && (
            <ProfileScreen
              unit={unit}
              entries={entries}
              cmvRecords={cmvRecords}
              freelancers={freelancers}
              role={role}
              profile={profile}
              onLogout={() => void logout()}
              onOpenFreelancers={() => setFreelancersModalOpen(true)}
              onOpenSubBrands={() => setSubBrandModalOpen(true)}
            />
          )}
          {view === "admin" && (
            <AdminScreen entries={entries} units={units} onUnit={pickUnit} onSaveGoals={saveGoals} />
          )}
        </div>
      </main>

      {/* MODAL DE SUB-MARCAS (X-TUDO / FRANGO / PIZZA) */}
      {subBrandModalOpen && (
        <SubBrandModal
          unit={unit}
          entries={entries}
          onSave={save}
          onClose={() => setSubBrandModalOpen(false)}
        />
      )}

      {/* MODAL DE FREELANCERS */}
      {freelancersModalOpen && (
        <FreelancersModal
          unit={unit}
          freelancers={freelancers}
          onSave={saveFreelancer}
          onDelete={deleteFreelancer}
          onClose={() => setFreelancersModalOpen(false)}
        />
      )}

      {toast && (
        <div className="toast">
          <span>✓</span>
          <div>
            <strong>Atualização concluída</strong>
            <p>{toast}</p>
          </div>
          <button onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
