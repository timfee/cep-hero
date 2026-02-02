import { ActivityEntry } from "@/types/activity";

let entries: ActivityEntry[] = [];
const listeners = new Set<() => void>();

export const activityStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return entries;
  },
  addEntry(entry: ActivityEntry) {
    entries = [entry, ...entries].slice(0, 50);
    listeners.forEach((l) => l());
  },
};
