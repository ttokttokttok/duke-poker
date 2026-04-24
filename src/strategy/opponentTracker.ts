export interface HandEvent {
  heroShovedPreflop: boolean;
  heroFoldedPreflop: boolean;
  heroRaisedPreflop: boolean;
}

const WINDOW = 5;
const recent: HandEvent[] = [];

export function recordHandEvent(e: HandEvent): void {
  recent.push(e);
  if (recent.length > WINDOW) recent.shift();
}

export function clearTracker(): void {
  recent.length = 0;
}

export function recentShoveCount(): number {
  return recent.filter((h) => h.heroShovedPreflop).length;
}

export function recentShoveRate(): number {
  if (recent.length === 0) return 0;
  return recentShoveCount() / recent.length;
}

export function recentFoldRate(): number {
  if (recent.length === 0) return 0;
  return recent.filter((h) => h.heroFoldedPreflop).length / recent.length;
}

export function recentHandsCount(): number {
  return recent.length;
}

export interface ReadSummary {
  handsSeen: number;
  shoveCount: number;
  shoveRate: number;
  foldRate: number;
  read: 'nothing' | 'maniac' | 'nit' | 'aggressive';
}

export function getRead(): ReadSummary {
  const handsSeen = recent.length;
  const shoveCount = recentShoveCount();
  const shoveRate = recentShoveRate();
  const foldRate = recentFoldRate();

  let read: ReadSummary['read'] = 'nothing';
  if (handsSeen >= 2) {
    if (shoveCount >= 2) read = 'maniac';
    else if (foldRate >= 0.6) read = 'nit';
    else if (recent.filter((h) => h.heroRaisedPreflop).length / handsSeen >= 0.6)
      read = 'aggressive';
  }
  return { handsSeen, shoveCount, shoveRate, foldRate, read };
}
