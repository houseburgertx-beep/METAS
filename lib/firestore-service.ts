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

export async function saveDailySale(entry: SalesEntry) {
  if (!db) throw new Error("Firebase não configurado");
  const id = `${entry.unitId}_${entry.date}`;
  await setDoc(doc(db, "dailySales", id), { ...entry, id }, { merge: true });
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
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveCmvEntry(entry: CmvEntry) {
  if (!db) throw new Error("Firebase não configurado");
  await setDoc(doc(db, "cmvEntries", entry.id), entry, { merge: true });
}

export async function loadCmvEntries(unitIds: string[]) {
  if (!db || !unitIds.length) return [];
  const snapshots = await Promise.all(unitIds.map((unitId) =>
    getDocs(query(collection(db, "cmvEntries"), where("unitId", "==", unitId))),
  ));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.data() as CmvEntry))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function saveUnitGoals(unit: UnitConfig) {
  if (!db) throw new Error("Firebase não configurado");
  await setDoc(doc(db, "goals", unit.id), { ...unit, unitId: unit.id, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function loadUnitGoals(unitIds: string[]) {
  if (!db || !unitIds.length) return [];
  const snapshots = await Promise.all(unitIds.map((unitId) => getDocs(query(collection(db, "goals"), where("unitId", "==", unitId)))));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.data() as UnitConfig));
}
