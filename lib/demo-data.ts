import { UNITS } from "./config";
import type { SalesEntry } from "./types";

const unitFactors: Record<string, number> = {
  "house190-eunapolis": 0.93,
  "house190-teixeira": 1.04,
  "house-food-park": 0.86,
};

const month = "2026-08";
const pattern = [
  [3050, 3060, 1120], [3400, 3250, 1250], [3900, 4140, 1900], [2200, 2360, 900],
  [2300, 2470, 980], [2510, 2780, 1180], [2710, 3150, 1370], [3340, 3700, 1900],
  [4100, 4300, 2600], [2060, 2230, 780], [2140, 2290, 820], [2360, 2500, 1070],
  [2520, 2750, 1190], [2750, 2910, 1260],
];

export const DEMO_ENTRIES: SalesEntry[] = UNITS.flatMap((unit) =>
  pattern.map(([salaoBase, deliveryBase, ifoodBase], index) => {
    const factor = unitFactors[unit.id];
    const salao = Math.round(salaoBase * factor * (unit.type === "foodpark" ? 1.12 : 1));
    const delivery = Math.round(deliveryBase * factor * (unit.type === "foodpark" ? 0.72 : 1));
    const ifood = Math.round(ifoodBase * factor * (unit.type === "foodpark" ? 0.7 : 1));
    const deliveryDetails = unit.type === "house190"
      ? { house190: Math.round(delivery * 0.87), xtudo: delivery - Math.round(delivery * 0.87) }
      : { burger: Math.round(delivery * 0.38), pizza: Math.round(delivery * 0.4), frango: delivery - Math.round(delivery * 0.78) };
    const ifoodDetails = unit.type === "house190"
      ? { house190: Math.round(ifood * 0.9), xtudo: ifood - Math.round(ifood * 0.9) }
      : { pizza: Math.round(ifood * 0.58), frango: ifood - Math.round(ifood * 0.58) };
    return {
      id: `${unit.id}-${index + 1}`,
      unitId: unit.id,
      date: `${month}-${String(index + 1).padStart(2, "0")}`,
      salao,
      delivery,
      ifood,
      deliveryDetails,
      ifoodDetails,
      createdBy: "gerente@house190.com.br",
    };
  }),
);
