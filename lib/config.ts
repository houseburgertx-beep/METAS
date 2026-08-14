import type { DailyTarget, UnitConfig } from "./types";

const house190Targets: Record<number, DailyTarget> = {
  0: { salao: 3500, delivery: 4000, ifood: 2500, total: 10000 },
  1: { salao: 2100, delivery: 2100, ifood: 800, total: 5000 },
  2: { salao: 2100, delivery: 2100, ifood: 800, total: 5000 },
  3: { salao: 2300, delivery: 2400, ifood: 1300, total: 6000 },
  4: { salao: 2500, delivery: 2700, ifood: 1300, total: 6500 },
  5: { salao: 2800, delivery: 3200, ifood: 1500, total: 7500 },
  6: { salao: 3000, delivery: 3500, ifood: 2000, total: 8500 },
};

const foodParkTargets: Record<number, DailyTarget> = {
  0: { salao: 4900, delivery: 2800, ifood: 1300, total: 9000 },
  1: { salao: 1800, delivery: 1600, ifood: 600, total: 4000 },
  2: { salao: 1800, delivery: 1600, ifood: 600, total: 4000 },
  3: { salao: 1800, delivery: 1600, ifood: 600, total: 4000 },
  4: { salao: 1800, delivery: 1600, ifood: 600, total: 4000 },
  5: { salao: 2800, delivery: 2400, ifood: 800, total: 6000 },
  6: { salao: 4500, delivery: 2800, ifood: 1300, total: 8600 },
};

const makeHouse190 = (id: string, name: string, shortName: string): UnitConfig => ({
  id,
  name,
  shortName,
  type: "house190",
  monthlyGoal: 200000,
  superGoal: 210000,
  superBonus: 1000,
  channels: {
    salao: { label: "Salão", goal: 70000, bonus: 500 },
    delivery: {
      label: "Delivery próprio",
      goal: 80000,
      details: [
        { key: "house190", label: "House190 Delivery", goal: 70000, bonus: 500 },
        { key: "xtudo", label: "X-Tudo Delivery", goal: 10000, bonus: 250 },
      ],
    },
    ifood: {
      label: "iFood",
      goal: 50000,
      details: [
        { key: "house190", label: "House190 iFood", goal: 45000, bonus: 500 },
        { key: "xtudo", label: "X-Tudo iFood", goal: 5000, bonus: 250 },
      ],
    },
  },
  dailyTargets: house190Targets,
});

export const UNITS: UnitConfig[] = [
  makeHouse190("house190-eunapolis", "House190 Eunápolis", "Eunápolis"),
  makeHouse190("house190-teixeira", "House190 Teixeira de Freitas", "Teixeira"),
  {
    id: "house-food-park",
    name: "House Food Park",
    shortName: "Food Park",
    type: "foodpark",
    monthlyGoal: 180000,
    superGoal: 190000,
    superBonus: 1000,
    channels: {
      salao: { label: "Salão", goal: 90000, bonus: 500 },
      delivery: {
        label: "Delivery próprio",
        goal: 60000,
        details: [
          { key: "burger", label: "Burger" },
          { key: "pizza", label: "Pizza" },
          { key: "frango", label: "Frango" },
        ],
      },
      ifood: {
        label: "iFood",
        goal: 30000,
        details: [
          { key: "pizza", label: "Pizza" },
          { key: "frango", label: "Frango" },
        ],
      },
    },
    dailyTargets: foodParkTargets,
  },
];

export const MANAGEMENT_RULES = [
  "Mínimo de duas categorias atingidas para liberar a bonificação",
  "CMV máximo de 35%; acima disso, toda a bonificação é bloqueada",
  "Freelancers limitados a R$ 1.500; acima disso, o bônus do Salão é bloqueado",
  "Frete, brindes, cancelamentos, estornos e receitas de terceiros não entram nas metas",
  "Desconto de 20% para colaboradores não entra na apuração",
  "Promoções do iFood devem permanecer dentro dos 25% previstos na precificação",
];
