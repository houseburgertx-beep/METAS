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
  const totalCost = (costs.rawMaterials || 0) + (costs.productionCenter || 0) + (costs.beverages || 0) + (costs.packaging || 0);
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
    rawMaterials: sum.rawMaterials + (record.rawMaterials || 0),
    productionCenter: sum.productionCenter + (record.productionCenter || 0),
    beverages: sum.beverages + (record.beverages || 0),
    packaging: sum.packaging + (record.packaging || 0),
  }), emptyCmvCosts());
  const totalRevenue = selected.reduce((sum, record) => sum + (record.revenue || 0), 0);
  return { ...calculateCmv(costs, totalRevenue, unit.cmvTargetPercent), weeks: selected.length };
}

export function weeksInMonth(monthIso: string): Array<{ weekStart: string; weekEnd: string; label: string; weekNumber: number }> {
  const [year, month] = monthIso.split("-").map(Number);
  const weeks: Array<{ weekStart: string; weekEnd: string; label: string; weekNumber: number }> = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Find the Sunday of the week containing firstDay
  const current = new Date(firstDay);
  current.setDate(firstDay.getDate() - firstDay.getDay());

  let weekNum = 1;
  while (current <= lastDay || (current.getMonth() === month - 1)) {
    const start = new Date(current);
    const end = new Date(current);
    end.setDate(start.getDate() + 6);

    const endMonth = end.getMonth() + 1;
    const endYear = end.getFullYear();
    const endMonthIso = `${endYear}-${String(endMonth).padStart(2, "0")}`;

    if (endMonthIso === monthIso || (start.getMonth() + 1 === month && start.getFullYear() === year)) {
      weeks.push({
        weekStart: isoLocalDate(start),
        weekEnd: isoLocalDate(end),
        label: `Semana ${weekNum}`,
        weekNumber: weekNum,
      });
      weekNum++;
    }

    current.setDate(current.getDate() + 7);
    if (current > lastDay && end.getMonth() !== month - 1) break;
  }
  return weeks;
}
