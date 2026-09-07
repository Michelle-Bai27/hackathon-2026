import { useSyncExternalStore } from "react";
import type { AppData } from "./types";
import { emptyData, loadData, saveData } from "./store";

type Listener = () => void;

let snapshot: AppData = emptyData();
const listeners = new Set<Listener>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  snapshot = loadData();
  hydrated = true;
}

export function getAppSnapshot() {
  hydrate();
  return snapshot;
}

export function subscribeApp(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAppSnapshot(next: AppData) {
  snapshot = next;
  if (typeof window !== "undefined") saveData(snapshot);
  listeners.forEach((l) => l());
}

const EMPTY: AppData = emptyData();

export function useAppSnapshot() {
  return useSyncExternalStore(subscribeApp, getAppSnapshot, () => EMPTY);
}
