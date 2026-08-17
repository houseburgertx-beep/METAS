import type {
  ChannelPerformance,
  OperatingInputs,
  PerformanceMetrics,
  SalesEntry,
  UnitConfig,
} from "./types";

const totalOf = (entry: SalesEntry) => entry.salao + entry.delivery + entry.ifood;
const safePercent = (value: number, goal: number) => (goal > 0 ? (value / goal) * 100 : 0);

const sumRange = (items: SalesEntry[]) => items.reduce((sum, item) => sum + totalOf(item), 0);

const monthlyEntries = (entries: SalesEntry[], unitId: string, date: Date) => {
  const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return entries
    .filter((entry) => entry.unitId === unitId && entry.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export function expectedToDate(unit: UnitConfig, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  let expected = 0;
  for (let d = 1; d <= day; d += 1) {
    expected += unit.dailyTargets[new Date(year, month, d).getDay()].total;
  }
  return Math.min(expected, unit.monthlyGoal);
}

function channelTrend(entries: SalesEntry[], key: "salao" | "delivery" | "ifood") {
  if (entries.length < 4) return 0;
  const last = entries.slice(-3).reduce((sum, entry) => sum + entry[key], 0) / Math.min(3, entries.length);
  const prior = entries.slice(-6, -3);
  const previous = prior.length ? prior.reduce((sum, entry) => sum + entry[key], 0) / prior.length : last;
  return previous > 0 ? ((last - previous) / previous) * 100 : 0;
}

export function calculatePerformance(unit: UnitConfig, allEntries: SalesEntry[], now = new Date()): PerformanceMetrics {
  const entries = monthlyEntries(allEntries, unit.id, now);
  const total = sumRange(entries);
  const expected = expectedToDate(unit, now);
  const gap = total - expected;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedDays = Math.max(now.getDate(), 1);
  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);
  const dailyAverage = total / elapsedDays;
  const missing = Math.max(unit.monthlyGoal - total, 0);
  const necessaryAverage = remainingDays ? missing / remainingDays : missing;
  const projection = total + dailyAverage * remainingDays;
  const recent3 = entries.slice(-3);
  const recent7 = entries.slice(-7);
  const previous7 = entries.slice(-14, -7);
  const last3Average = recent3.length ? sumRange(recent3) / recent3.length : 0;
  const last7Average = recent7.length ? sumRange(recent7) / recent7.length : 0;
  const previous7Average = previous7.length ? sumRange(previous7) / previous7.length : last7Average;
  const weeklyEvolution = previous7Average ? ((last7Average - previous7Average) / previous7Average) * 100 : 0;
  const trend: PerformanceMetrics["trend"] = weeklyEvolution > 2 ? "up" : weeklyEvolution < -2 ? "down" : "stable";

  const channelDefinitions = [
    ["salao", unit.channels.salao.label, unit.channels.salao.goal],
    ["delivery", unit.channels.delivery.label, unit.channels.delivery.goal],
    ["ifood", unit.channels.ifood.label, unit.channels.ifood.goal],
  ] as const;

  const channels: ChannelPerformance[] = channelDefinitions.map(([key, label, goal]) => {
    const realized = entries.reduce((sum, item) => sum + item[key], 0);
    return { key, label, goal, realized, percentage: safePercent(realized, goal), gap: realized - goal, trend: channelTrend(entries, key) };
  });
  const sortedChannels = [...channels].sort((a, b) => b.percentage - a.percentage);
  const trajectoryPercentage = safePercent(total, expected);
  const projectedPercentage = safePercent(projection, unit.monthlyGoal);
  const health: PerformanceMetrics["health"] =
    trajectoryPercentage >= 100 && projectedPercentage >= 100
      ? "green"
      : trajectoryPercentage >= 93 && projectedPercentage >= 94 && trend !== "down"
        ? "yellow"
        : "red";

  return {
    total,
    percentage: safePercent(total, unit.monthlyGoal),
    missing,
    expected,
    trajectoryPercentage,
    gap,
    gapPercentage: expected ? (gap / expected) * 100 : 0,
    elapsedDays,
    remainingDays,
    dailyAverage,
    necessaryAverage,
    projection,
    last3Average,
    last7Average,
    weeklyEvolution,
    trend,
    health,
    healthLabel: health === "green" ? "Meta no ritmo" : health === "yellow" ? "Atenção ao ritmo" : "Meta em risco",
    channels,
    bestChannel: sortedChannels[0],
    worstChannel: sortedChannels[sortedChannels.length - 1],
    bestDay: [...entries].sort((a, b) => totalOf(b) - totalOf(a))[0],
    worstDay: [...entries].sort((a, b) => totalOf(a) - totalOf(b))[0],
  };
}

export function calculateBonus(
  unit: UnitConfig,
  entries: SalesEntry[],
  operating: OperatingInputs,
) {
  const relevant = entries.filter((entry) => entry.unitId === unit.id);
  const salao = relevant.reduce((sum, entry) => sum + entry.salao, 0);
  const totalDelivery = relevant.reduce((sum, entry) => sum + entry.delivery, 0);
  const totalIfood = relevant.reduce((sum, entry) => sum + entry.ifood, 0);

  const sumDetail = (channel: "deliveryDetails" | "ifoodDetails", key: string) =>
    relevant.reduce((sum, entry) => sum + (entry[channel]?.[key] || 0), 0);

  let categories: Array<{ label: string; realized: number; goal: number; bonus: number }> = [];

  if (unit.type === "house190") {
    const xtudoDelivery = sumDetail("deliveryDetails", "xtudo");
    const house190Delivery = Math.max(totalDelivery - xtudoDelivery, 0);
    const xtudoIfood = sumDetail("ifoodDetails", "xtudo");
    const house190Ifood = Math.max(totalIfood - xtudoIfood, 0);

    categories = [
      { label: "Salão", realized: salao, goal: unit.channels.salao.goal, bonus: unit.channels.salao.bonus },
      { label: "House190 Delivery", realized: house190Delivery, goal: 70000, bonus: 500 },
      { label: "X-Tudo Delivery", realized: xtudoDelivery, goal: 10000, bonus: 250 },
      { label: "House190 iFood", realized: house190Ifood, goal: 45000, bonus: 500 },
      { label: "X-Tudo iFood", realized: xtudoIfood, goal: 5000, bonus: 250 },
    ];
  } else {
    // House Food Park
    const frangoDelivery = sumDetail("deliveryDetails", "frango");
    const pizzaDelivery = sumDetail("deliveryDetails", "pizza");
    const burgerDelivery = Math.max(totalDelivery - frangoDelivery - pizzaDelivery, 0);
    const frangoIfood = sumDetail("ifoodDetails", "frango");
    const pizzaIfood = sumDetail("ifoodDetails", "pizza");

    categories = [
      { label: "Salão", realized: salao, goal: unit.channels.salao.goal, bonus: unit.channels.salao.bonus },
      { label: "Burger / Lanches Delivery", realized: burgerDelivery, goal: 40000, bonus: 500 },
      { label: "Frango (Delivery + iFood)", realized: frangoDelivery + frangoIfood, goal: 20000, bonus: 250 },
      { label: "Pizza (Delivery + iFood)", realized: pizzaDelivery + pizzaIfood, goal: 30000, bonus: 250 },
    ];
  }

  const reached = categories.filter((category) => category.realized >= category.goal);
  const cmvBlocked = operating.cmvPercent > 35;
  const minimumBlocked = reached.length < 2;
  const rows = categories.map((category) => {
    const freelancerBlocked = category.label === "Salão" && operating.freelancerSpend > 1500;
    const unlocked = category.realized >= category.goal && !cmvBlocked && !minimumBlocked && !freelancerBlocked;
    return { ...category, percentage: safePercent(category.realized, category.goal), unlocked, freelancerBlocked };
  });
  const total = relevant.reduce((sum, entry) => sum + totalOf(entry), 0);
  const superBonus = total >= unit.superGoal && !cmvBlocked && reached.length >= 2 ? unit.superBonus : 0;
  return {
    categories: rows,
    conquered: rows.reduce((sum, row) => sum + (row.unlocked ? row.bonus : 0), 0) + superBonus,
    potential: rows.reduce((sum, row) => sum + row.bonus, 0) + unit.superBonus,
    superBonus,
    cmvBlocked,
    minimumBlocked,
  };
}

export const validateDetails = (total: number, details: Record<string, number>) => {
  const sum = Object.values(details).reduce((acc, value) => acc + value, 0);
  return { sum, difference: total - sum, matches: Math.abs(total - sum) < 0.01 };
};
