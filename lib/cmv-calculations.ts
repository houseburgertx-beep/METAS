import type { CmvCosts, CmvEntry, CmvMetrics, SalesEntry, UnitConfig } from "./types";

export const emptyCmvCosts = (): CmvCosts => ({
  rawMaterials: 0,
  productionCenter: 0,
  beverages: 0,
  packaging: 0,
});

const parseLocalDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const isoLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function weekFromDate(iso: string) {
  const selected = parseLocalDate(iso);
  const start = new Date(selected);
  start.setDate(selected.getDate() - selected.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: isoLocalDate(start), weekEnd: isoLocalDate(end) };
}

export const revenueForPeriod = (entries: SalesEntry[], unitId: string, start: string, end: string) =>
  entries
    .filter((entry) => entry.unitId === unitId && entry.date >= start && entry.date <= end)
    .reduce((sum, entry) => sum + entry.salao + entry.delivery + entry.ifood, 0);

export function calculateCmv(costs: CmvCosts, revenue: number, targetPercent: number): CmvMetrics {
  const totalCost = costs.rawMaterials + costs.productionCenter + costs.beverages + costs.packaging;
  const percentage = revenue > 0 ? (totalCost / revenue) * 100 : 0;
  const variancePoints = percentage - targetPercent;
  const status: CmvMetrics["status"] = revenue <= 0
    ? "no-revenue"
    : percentage <= targetPercent
      ? "healthy"
      : percentage <= targetPercent + 3
        ? "attention"
        : "critical";
  return { ...costs, totalCost, revenue, percentage, targetPercent, variancePoints, status };
}

export function monthlyCmv(records: CmvEntry[], unit: UnitConfig, month: string) {
  const selected = records.filter((record) => record.unitId === unit.id && record.referenceMonth === month);
  const costs = selected.reduce<CmvCosts>((sum, record) => ({
    rawMaterials: sum.rawMaterials + record.rawMaterials,
    productionCenter: sum.productionCenter + record.productionCenter,
    beverages: sum.beverages + record.beverages,
    packaging: sum.packaging + record.packaging,
  }), emptyCmvCosts());
  return { ...calculateCmv(costs, selected.reduce((sum, record) => sum + record.revenue, 0), unit.cmvTargetPercent), weeks: selected.length };
}
