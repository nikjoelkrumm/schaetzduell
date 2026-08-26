// Real offline queueing for guesses — the design's prototype simulated this
// with a debug toggle; here it's driven by the actual browser online/offline
// events. A queued item carries its own idempotency key so a retry after
// reconnecting can never be scored twice, matching submit_attempt /
// submit_duel_guess's idem_key handling in the backend.

export type QueuedAction =
  | { kind: "attempt"; questionId: number; guess: number; idemKey: string; queuedAt: number }
  | { kind: "duelGuess"; roundId: string; guess: number; idemKey: string; queuedAt: number };

const KEY = "sd:offline-queue:v1";

export function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private mode / quota) — queue just won't survive a reload
  }
}

export function enqueue(action: QueuedAction) {
  writeQueue([...readQueue(), action]);
}

export function removeFromQueue(idemKey: string) {
  writeQueue(readQueue().filter((a) => a.idemKey !== idemKey));
}

export function makeIdemKey(): string {
  return crypto.randomUUID();
}
