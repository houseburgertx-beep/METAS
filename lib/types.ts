export type UnitType = "house190" | "foodpark";
export type UserRole = "admin" | "manager";

export type DailyTarget = {
  salao: number;
  delivery: number;
  ifood: number;
  total: number;
};

export type DetailGoal = {
  key: string;
  label: string;
  goal?: number;
  bonus?: number;
};

export type UnitConfig = {
  id: string;
  name: string;
  shortName: string;
  type: UnitType;
  monthlyGoal: number;
  superGoal: number;
  superBonus: number;
  cmvTargetPercent: number;
  channels: {
    salao: { label: string; goal: number; bonus: number };
    delivery: { label: string; goal: number; details: DetailGoal[] };
    ifood: { label: string; goal: number; details: DetailGoal[] };
  };
  dailyTargets: Record<number, DailyTarget>;
};

export type CmvCosts = {
  rawMaterials: number;
  productionCenter: number;
  beverages: number;
  packaging: number;
};

export type CmvEntry = CmvCosts & {
  id: string;
  unitId: string;
  weekStart: string;
  weekEnd: string;
  referenceMonth: string;
  revenue: number;
  targetPercent: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt: string;
};

export type CmvMetrics = CmvCosts & {
  totalCost: number;
  revenue: number;
  percentage: number;
  targetPercent: number;
  variancePoints: number;
  status: "healthy" | "attention" | "critical" | "no-revenue";
};

export type SalesEntry = {
  id: string;
  unitId: string;
  date: string;
  salao: number;
  delivery: number;
  ifood: number;
  deliveryDetails: Record<string, number>;
  ifoodDetails: Record<string, number>;
  createdBy?: string;
  updatedAt?: string;
  source?: "manual" | "takeat";
  sourceSummary?: {
    sessions: number;
    ignored: number;
    channels: string[];
  };
};

export type OperatingInputs = {
  cmvPercent: number;
  freelancerSpend: number;
};

export type ChannelPerformance = {
  key: "salao" | "delivery" | "ifood";
  label: string;
  realized: number;
  goal: number;
  percentage: number;
  gap: number;
  trend: number;
};

export type PerformanceMetrics = {
  total: number;
  percentage: number;
  missing: number;
  expected: number;
  trajectoryPercentage: number;
  gap: number;
  gapPercentage: number;
  elapsedDays: number;
  remainingDays: number;
  dailyAverage: number;
  necessaryAverage: number;
  projection: number;
  last3Average: number;
  last7Average: number;
  weeklyEvolution: number;
  trend: "up" | "down" | "stable";
  health: "green" | "yellow" | "red";
  healthLabel: string;
  channels: ChannelPerformance[];
  bestChannel: ChannelPerformance;
  worstChannel: ChannelPerformance;
  bestDay?: SalesEntry;
  worstDay?: SalesEntry;
};
