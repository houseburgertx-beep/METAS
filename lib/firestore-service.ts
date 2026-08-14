import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SalesEntry } from "./types";

export async function loadUserProfile(uid: string) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() as { role: "admin" | "manager"; unitId?: string; name?: string } : null;
}

export async function saveDailySale(entry: SalesEntry) {
  if (!db) throw new Error("Firebase não configurado");
  const id = `${entry.unitId}_${entry.date}`;
  await setDoc(doc(db, "dailySales", id), { ...entry, id }, { merge: true });
}

export async function loadUnitSales(unitId: string, monthPrefix: string) {
  if (!db) return [];
  const end = `${monthPrefix}-31`;
  const snapshot = await getDocs(
    query(
      collection(db, "dailySales"),
      where("unitId", "==", unitId),
      where("date", ">=", `${monthPrefix}-01`),
      where("date", "<=", end),
      orderBy("date", "asc"),
    ),
  );
  return snapshot.docs.map((item) => item.data() as SalesEntry);
}
