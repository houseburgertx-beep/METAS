import type { SalesEntry } from "./types";
import { auth } from "./firebase";

const TAKEAT_SYNC_URL = "https://house-gestao-ia.gleucedias1.workers.dev/takeat/sync";

export type TakeatSyncResult = SalesEntry & {
  source: "takeat";
  sourceSummary?: {
    sessions: number;
    ignored: number;
    channels: string[];
  };
};

export async function syncTakeatSale(unitId: string, date: string): Promise<TakeatSyncResult> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Faça login novamente para sincronizar a Takeat.");
  const token = await user.getIdToken();
  const response = await fetch(TAKEAT_SYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ unitId, date }),
  });
  const data = await response.json() as TakeatSyncResult & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar a Takeat.");
  return data;
}
