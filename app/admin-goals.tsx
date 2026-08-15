"use client";

import { ChevronDown, Save, Settings2, Target, X } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { DailyTarget, UnitConfig } from "@/lib/types";

const days = [[0, "Dom"], [1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"]] as const;
const cloneUnit = (unit: UnitConfig): UnitConfig => JSON.parse(JSON.stringify(unit)) as UnitConfig;

function NumericGoal({ label, value, onChange, suffix = "R$" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return <label className="goal-field"><span>{label}</span><div><i>{suffix}</i><input min="0" step={suffix === "%" ? "0.1" : "1"} type="number" value={value} onChange={(event) => onChange(Math.max(Number(event.target.value), 0))} /></div></label>;
}

export function AdminGoalEditor({ units, onSave }: { units: UnitConfig[]; onSave: (unit: UnitConfig) => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(units[0]?.id || "");
  const selected = units.find((unit) => unit.id === selectedId) || units[0];
  const [draft, setDraft] = useState<UnitConfig>(() => cloneUnit(selected));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!selected) return null;

  const selectUnit = (unitId: string) => {
    const next = units.find((unit) => unit.id === unitId) || units[0];
    setSelectedId(unitId);
    setDraft(cloneUnit(next));
    setSaved(false);
  };

  const updateDaily = (day: number, key: keyof DailyTarget, value: number) => setDraft({ ...draft, dailyTargets: { ...draft.dailyTargets, [day]: { ...draft.dailyTargets[day], [key]: value } } });
  const persist = async () => { setSaving(true); await onSave(draft); setSaving(false); setSaved(true); };

  return <section className="surface-card goal-admin-card">
    <button className="goal-admin-trigger" onClick={() => setOpen(!open)} aria-expanded={open}><span className="metric-icon icon-purple"><Settings2 size={19} /></span><div><span className="eyebrow">Configuração administrativa</span><h2>Editar todas as metas</h2><p>Metas mensais, canais, bonificações, CMV e metas diárias.</p></div><ChevronDown className={open ? "rotate" : ""} size={20} /></button>
    {open && <div className="goal-editor">
      <div className="goal-editor-top"><label><span>Unidade</span><select value={selectedId} onChange={(event) => selectUnit(event.target.value)}>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label><button className="ghost-button" onClick={() => setDraft(cloneUnit(selected))}><X size={15} /> Descartar alterações</button></div>
      <div className="goal-section"><div><Target size={17} /><strong>Metas gerais</strong></div><div className="goal-grid"><NumericGoal label="Meta mensal" value={draft.monthlyGoal} onChange={(monthlyGoal) => setDraft({ ...draft, monthlyGoal })} /><NumericGoal label="Supermeta" value={draft.superGoal} onChange={(superGoal) => setDraft({ ...draft, superGoal })} /><NumericGoal label="Superbônus" value={draft.superBonus} onChange={(superBonus) => setDraft({ ...draft, superBonus })} /><NumericGoal label="Meta máxima de CMV" suffix="%" value={draft.cmvTargetPercent} onChange={(cmvTargetPercent) => setDraft({ ...draft, cmvTargetPercent })} /></div></div>
      <div className="goal-section"><div><Target size={17} /><strong>Metas por canal e bônus</strong></div><div className="goal-grid"><NumericGoal label={draft.channels.salao.label} value={draft.channels.salao.goal} onChange={(goal) => setDraft({ ...draft, channels: { ...draft.channels, salao: { ...draft.channels.salao, goal } } })} /><NumericGoal label="Bônus do Salão" value={draft.channels.salao.bonus} onChange={(bonus) => setDraft({ ...draft, channels: { ...draft.channels, salao: { ...draft.channels.salao, bonus } } })} /><NumericGoal label={draft.channels.delivery.label} value={draft.channels.delivery.goal} onChange={(goal) => setDraft({ ...draft, channels: { ...draft.channels, delivery: { ...draft.channels.delivery, goal } } })} /><NumericGoal label={draft.channels.ifood.label} value={draft.channels.ifood.goal} onChange={(goal) => setDraft({ ...draft, channels: { ...draft.channels, ifood: { ...draft.channels.ifood, goal } } })} /></div>
        <div className="detail-goals">{(["delivery", "ifood"] as const).flatMap((channel) => draft.channels[channel].details.map((detail, index) => <div key={`${channel}-${detail.key}`}><span>{detail.label}</span><NumericGoal label="Meta" value={detail.goal || 0} onChange={(goal) => { const details = [...draft.channels[channel].details]; details[index] = { ...detail, goal }; setDraft({ ...draft, channels: { ...draft.channels, [channel]: { ...draft.channels[channel], details } } }); }} /><NumericGoal label="Bônus" value={detail.bonus || 0} onChange={(bonus) => { const details = [...draft.channels[channel].details]; details[index] = { ...detail, bonus }; setDraft({ ...draft, channels: { ...draft.channels, [channel]: { ...draft.channels[channel], details } } }); }} /></div>))}</div>
      </div>
      <div className="goal-section daily-goals"><div><Target size={17} /><strong>Metas diárias — domingo a sábado</strong></div><div className="daily-goal-table"><div className="daily-goal-head"><b>Dia</b><b>Salão</b><b>Delivery</b><b>iFood</b><b>Total</b></div>{days.map(([day, label]) => <div className="daily-goal-row" key={day}><b>{label}</b>{(["salao", "delivery", "ifood", "total"] as const).map((key) => <label key={key}><span>{key}</span><input min="0" type="number" value={draft.dailyTargets[day][key]} onChange={(event) => updateDaily(day, key, Math.max(Number(event.target.value), 0))} /></label>)}</div>)}</div></div>
      <div className="goal-save-bar"><div><span>Meta mensal configurada</span><strong>{formatMoney(draft.monthlyGoal)}</strong>{saved && <small>Configuração salva com sucesso.</small>}</div><button className="primary-button" onClick={() => void persist()} disabled={saving}><Save size={17} /> {saving ? "Salvando..." : "Salvar todas as metas"}</button></div>
    </div>}
  </section>;
}
