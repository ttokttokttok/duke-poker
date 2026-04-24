import type { Card } from '../poker/types';
import { evaluate7 } from '../poker/handEvaluator';
import { HAND_CATEGORY_NAMES, HandCategory } from '../poker/types';

export function preflopStrength(hole: [Card, Card]): number {
  const [a, b] = [...hole].sort((x, y) => y.rank - x.rank);
  const high = a.rank;
  const low = b.rank;
  const pair = high === low;
  const suited = a.suit === b.suit;
  const gap = high - low;

  if (pair) {
    if (high >= 13) return 95;
    if (high === 12) return 88;
    if (high === 11) return 82;
    if (high === 10) return 75;
    if (high >= 8) return 65;
    if (high >= 5) return 55;
    return 48;
  }

  if (high === 14) {
    if (low === 13) return suited ? 92 : 85;
    if (low === 12) return suited ? 78 : 70;
    if (low === 11) return suited ? 72 : 60;
    if (low === 10) return suited ? 65 : 52;
    if (suited) return 48 + (low - 2) * 1.5;
    return 32 + (low - 2) * 1.2;
  }

  if (high === 13) {
    if (low === 12) return suited ? 68 : 58;
    if (low === 11) return suited ? 60 : 48;
    if (low === 10) return suited ? 55 : 42;
    if (low === 9) return suited ? 45 : 30;
    return suited ? 30 + low : 15 + low;
  }

  if (high === 12) {
    if (low === 11) return suited ? 58 : 46;
    if (low === 10) return suited ? 52 : 40;
    if (low === 9) return suited ? 42 : 28;
    return suited ? 28 + low : 12 + low;
  }

  if (high === 11) {
    if (low === 10) return suited ? 52 : 42;
    if (low === 9) return suited ? 42 : 30;
    return suited ? 26 + low : 10 + low;
  }

  if (suited && gap === 1) return 42 + low;
  if (suited && gap === 2) return 34 + low;
  if (gap === 1) return 26 + low;

  return Math.max(8, 18 - gap * 2 + low);
}

export interface PostflopStrength {
  category: HandCategory;
  categoryName: string;
  strength: number;
  hasFlushDraw: boolean;
  hasStraightDraw: boolean;
  overcards: number;
}

const CATEGORY_BASE: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 5,
  [HandCategory.OnePair]: 30,
  [HandCategory.TwoPair]: 60,
  [HandCategory.ThreeOfAKind]: 75,
  [HandCategory.Straight]: 85,
  [HandCategory.Flush]: 90,
  [HandCategory.FullHouse]: 96,
  [HandCategory.FourOfAKind]: 99,
  [HandCategory.StraightFlush]: 100,
};

export function postflopStrength(hole: [Card, Card], board: Card[]): PostflopStrength {
  const all = [...hole, ...board];
  const evalSource = all.length === 7 ? all : padForEval(all);
  const evald = evaluate7(evalSource);

  let strength = CATEGORY_BASE[evald.category];

  if (evald.category === HandCategory.OnePair) {
    const pairRank = evald.ranks[0];
    const boardRanks = board.map((c) => c.rank);
    const topBoardRank = Math.max(...boardRanks, 0);
    if (pairRank > topBoardRank) strength += 10;
    else if (pairRank === topBoardRank) strength += 6;
    else strength -= 8;
    if (hole.some((c) => c.rank === pairRank) && hole[0].rank === hole[1].rank) {
      strength += 12;
    }
  }

  if (evald.category === HandCategory.TwoPair) {
    const [hi, lo] = evald.ranks;
    const boardRanks = board.map((c) => c.rank);
    const fromBoardOnly =
      boardRanks.filter((r) => r === hi).length >= 2 &&
      boardRanks.filter((r) => r === lo).length >= 2;
    if (fromBoardOnly) strength -= 25;
  }

  const hasFlushDraw = detectFlushDraw(all);
  const hasStraightDraw = detectOpenEndedStraightDraw(all);
  if (hasFlushDraw && evald.category < HandCategory.Flush) strength += 10;
  if (hasStraightDraw && evald.category < HandCategory.Straight) strength += 8;

  const boardRanks = board.map((c) => c.rank);
  const topBoardRank = Math.max(...boardRanks, 0);
  const overcards = hole.filter((c) => c.rank > topBoardRank).length;
  if (evald.category === HandCategory.HighCard && overcards === 2) strength += 8;

  return {
    category: evald.category,
    categoryName: HAND_CATEGORY_NAMES[evald.category] ?? 'Unknown',
    strength: Math.min(100, Math.max(0, strength)),
    hasFlushDraw,
    hasStraightDraw,
    overcards,
  };
}

function padForEval(cards: Card[]): Card[] {
  if (cards.length >= 7) return cards.slice(0, 7);
  const used = new Set(cards.map((c) => `${c.rank}${c.suit}`));
  const pad: Card[] = [];
  const filler: Card[] = [
    { rank: 2, suit: 'c' },
    { rank: 2, suit: 'd' },
    { rank: 2, suit: 'h' },
    { rank: 2, suit: 's' },
    { rank: 3, suit: 'c' },
    { rank: 3, suit: 'd' },
    { rank: 3, suit: 'h' },
  ];
  for (const c of filler) {
    if (cards.length + pad.length >= 7) break;
    const key = `${c.rank}${c.suit}`;
    if (!used.has(key)) {
      pad.push(c);
      used.add(key);
    }
  }
  return [...cards, ...pad];
}

function detectFlushDraw(cards: Card[]): boolean {
  if (cards.length < 4) return false;
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
  return [...counts.values()].some((n) => n === 4);
}

function detectOpenEndedStraightDraw(cards: Card[]): boolean {
  if (cards.length < 4) return false;
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  for (let i = 0; i <= ranks.length - 4; i++) {
    if (
      ranks[i + 1] === ranks[i] + 1 &&
      ranks[i + 2] === ranks[i] + 2 &&
      ranks[i + 3] === ranks[i] + 3
    ) {
      if (ranks[i] > 2 && ranks[i] + 3 < 14) return true;
    }
  }
  return false;
}
