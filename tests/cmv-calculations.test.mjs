import assert from "node:assert/strict";
import test from "node:test";
import { calculateCmv, monthlyCmv, revenueForPeriod, weekFromDate } from "../lib/cmv-calculations.ts";

test("normaliza qualquer data para a semana de domingo a sábado", () => {
  assert.deepEqual(weekFromDate("2026-08-12"), { weekStart: "2026-08-09", weekEnd: "2026-08-15" });
  assert.deepEqual(weekFromDate("2026-08-09"), { weekStart: "2026-08-09", weekEnd: "2026-08-15" });
});

test("usa somente o faturamento Takeat da unidade e do período", () => {
  const entries = [
    { unitId: "a", date: "2026-08-09", salao: 100, delivery: 50, ifood: 50 },
    { unitId: "a", date: "2026-08-15", salao: 200, delivery: 0, ifood: 0 },
    { unitId: "a", date: "2026-08-16", salao: 999, delivery: 0, ifood: 0 },
    { unitId: "b", date: "2026-08-10", salao: 999, delivery: 0, ifood: 0 },
  ];
  assert.equal(revenueForPeriod(entries, "a", "2026-08-09", "2026-08-15"), 400);
});

test("calcula CMV e consolida o mês por unidade sem média de percentuais", () => {
  const costs = { rawMaterials: 200, productionCenter: 50, beverages: 30, packaging: 20 };
  assert.equal(calculateCmv(costs, 1000, 35).percentage, 30);
  const unit = { id: "a", cmvTargetPercent: 35 };
  const records = [
    { id: "1", unitId: "a", referenceMonth: "2026-08", revenue: 1000, targetPercent: 35, ...costs },
    { id: "2", unitId: "a", referenceMonth: "2026-08", revenue: 3000, targetPercent: 35, rawMaterials: 900, productionCenter: 100, beverages: 50, packaging: 50 },
    { id: "3", unitId: "a", referenceMonth: "2026-07", revenue: 9999, targetPercent: 35, ...costs },
  ];
  const result = monthlyCmv(records, unit, "2026-08");
  assert.equal(result.revenue, 4000);
  assert.equal(result.totalCost, 1400);
  assert.equal(result.percentage, 35);
  assert.equal(result.weeks, 2);
});
