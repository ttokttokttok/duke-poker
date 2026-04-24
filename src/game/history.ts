import { cardsToString } from '../poker/cards';
import { describeHand } from '../poker/handEvaluator';
import type { Card, GameState } from '../poker/types';

export interface HandRecord {
  handNumber: number;
  winner: 'hero' | 'duke' | 'split';
  amount: number;
  heroCards: Card[];
  dukeCards: Card[];
  board: Card[];
  heroDescription?: string;
  dukeDescription?: string;
  endedAt: 'fold' | 'showdown';
  folder?: 'hero' | 'duke';
  heroStackAfter: number;
  dukeStackAfter: number;
}

const records: HandRecord[] = [];
const listeners = new Set<() => void>();

export function recordHand(state: GameState): void {
  if (state.winner === null) return;
  const hero = state.players[0];
  const duke = state.players[1];

  const winnings = extractWinnings(state);
  const winner: HandRecord['winner'] =
    state.winner === 0 ? 'hero' : state.winner === 1 ? 'duke' : 'split';

  const record: HandRecord = {
    handNumber: state.handNumber,
    winner,
    amount: winnings,
    heroCards: hero.holeCards ? [...hero.holeCards] : [],
    dukeCards: duke.holeCards ? [...duke.holeCards] : [],
    board: [...state.board],
    endedAt: state.showdownInfo ? 'showdown' : 'fold',
    heroStackAfter: hero.stack,
    dukeStackAfter: duke.stack,
  };

  if (state.showdownInfo) {
    record.heroDescription = describeHand(
      state.showdownInfo.p0!.category,
      state.showdownInfo.p0!.ranks
    );
    record.dukeDescription = describeHand(
      state.showdownInfo.p1!.category,
      state.showdownInfo.p1!.ranks
    );
  } else {
    record.folder = hero.folded ? 'hero' : 'duke';
  }

  records.push(record);
  for (const l of listeners) l();
}

export function getHistory(): HandRecord[] {
  return records;
}

export function clearHistory(): void {
  records.length = 0;
  for (const l of listeners) l();
}

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function formatCards(cards: Card[]): string {
  return cards.length ? cardsToString(cards) : '—';
}

function extractWinnings(state: GameState): number {
  const m = /wins pot of \$(\d+)/.exec(state.log.slice(-3).join(' ') ?? '');
  return m ? parseInt(m[1], 10) : 0;
}
