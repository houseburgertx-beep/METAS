import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CmvEntry, SalesEntry, UnitConfig } from "./types";

export async function loadUserProfile(uid: string) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() as { role: "admin" | "manager"; unitId?: string; name?: string; email?: string; active?: boolean } : null;
}

function cleanData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = cleanData(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export async function saveDailySale(entry: SalesEntry) {
  if (!db) throw new Error("Firebase não configurado");
  const id = `${entry.unitId}_${entry.date}`;
  await setDoc(doc(db, "dailySales", id), cleanData({ ...entry, id }), { merge: true });
}

export async function loadUnitSales(unitId: string, monthPrefix: string) {
  if (!db) return [];
  const start = `${monthPrefix}-01`;
  const end = `${monthPrefix}-31`;
  const snapshot = await getDocs(
    query(collection(db, "dailySales"), where("unitId", "==", unitId)),
  );
  return snapshot.docs
    .map((item) => item.data() as SalesEntry)
    .filter((entry) => (entry as SalesEntry & { recordType?: string }).recordType !== "cmv")
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveCmvEntry(entry: CmvEntry) {
  if (!db) throw new Error("Firebase não configurado");
  const cleaned = cleanData(entry);
  try {
    await setDoc(doc(db, "cmvEntries", entry.id), cleaned, { merge: true });
  } catch (error) {
    console.warn("Falha ao salvar em cmvEntries, tentando fallback em dailySales:", error);
    const code = (error as { code?: string }).code || "";
    if (code.includes("permission-denied")) {
      await setDoc(doc(db, "dailySales", `cmv_${entry.id}`), cleanData({
        id: `cmv_${entry.id}`,
        unitId: entry.unitId,
        date: entry.weekStart,
        recordType: "cmv",
        cmv: cleaned,
        updatedAt: entry.updatedAt,
      }), { merge: true });
    } else {
      throw error;
    }
  }
}

export async function loadCmvEntries(unitIds: string[]) {
  if (!db || !unitIds.length) return [];
  const records = await Promise.all(unitIds.map(async (unitId) => {
    const fallbackSnapshot = await getDocs(query(collection(db, "dailySales"), where("unitId", "==", unitId)));
    const fallback = fallbackSnapshot.docs
      .map((item) => item.data() as { recordType?: string; cmv?: CmvEntry })
      .filter((item) => item.recordType === "cmv" && item.cmv)
      .map((item) => item.cmv as CmvEntry);
    try {
      const primarySnapshot = await getDocs(query(collection(db, "cmvEntries"), where("unitId", "==", unitId)));
      return [...fallback, ...primarySnapshot.docs.map((item) => item.data() as CmvEntry)];
    } catch (error) {
      const code = (error as { code?: string }).code || "";
      if (!code.includes("permission-denied")) throw error;
      return fallback;
    }
  }));
  const byId = new Map(records.flat().map((entry) => [entry.id, entry]));
  return [...byId.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function saveUnitGoals(unit: UnitConfig) {
  if (!db) throw new Error("Firebase não configurado");
  await setDoc(doc(db, "goals", unit.id), cleanData({ ...unit, unitId: unit.id, updatedAt: new Date().toISOString() }), { merge: true });
}

export async function loadUnitGoals(unitIds: string[]) {
  if (!db || !unitIds.length) return [];
  const snapshots = await Promise.all(unitIds.map((unitId) => getDocs(query(collection(db, "goals"), where("unitId", "==", unitId)))));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.data() as UnitConfig));
}
