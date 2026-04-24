import type { Card, EvaluatedHand } from './types';
import { HAND_CATEGORY_NAMES, HandCategory } from './types';

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const recurse = (start: number) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

function checkStraight(ranksDesc: number[]): number {
  const unique = [...new Set(ranksDesc)].sort((a, b) => b - a);
  if (unique.length < 5) return 0;
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  if (
    unique.includes(14) &&
    unique.includes(5) &&
    unique.includes(4) &&
    unique.includes(3) &&
    unique.includes(2)
  ) {
    return 5;
  }
  return 0;
}

function evaluate5(cards: Card[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);

  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const straightHigh = checkStraight(ranks);

  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const groups = [...freq.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0]
  );

  if (isFlush && straightHigh) {
    return { category: HandCategory.StraightFlush, ranks: [straightHigh], cards: sorted };
  }
  if (groups[0][1] === 4) {
    return {
      category: HandCategory.FourOfAKind,
      ranks: [groups[0][0], groups[1][0]],
      cards: sorted,
    };
  }
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    return {
      category: HandCategory.FullHouse,
      ranks: [groups[0][0], groups[1][0]],
      cards: sorted,
    };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, ranks, cards: sorted };
  }
  if (straightHigh) {
    return { category: HandCategory.Straight, ranks: [straightHigh], cards: sorted };
  }
  if (groups[0][1] === 3) {
    return {
      category: HandCategory.ThreeOfAKind,
      ranks: [groups[0][0], groups[1][0], groups[2][0]],
      cards: sorted,
    };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    return {
      category: HandCategory.TwoPair,
      ranks: [groups[0][0], groups[1][0], groups[2][0]],
      cards: sorted,
    };
  }
  if (groups[0][1] === 2) {
    return {
      category: HandCategory.OnePair,
      ranks: [groups[0][0], groups[1][0], groups[2][0], groups[3][0]],
      cards: sorted,
    };
  }
  return { category: HandCategory.HighCard, ranks, cards: sorted };
}

export function evaluate7(cards: Card[]): EvaluatedHand {
  if (cards.length !== 7) throw new Error(`evaluate7 needs 7 cards, got ${cards.length}`);
  const combos = combinations(cards, 5);
  return combos.map(evaluate5).reduce((best, h) => (compareHands(h, best) > 0 ? h : best));
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < a.ranks.length; i++) {
    if (a.ranks[i] !== b.ranks[i]) return a.ranks[i] - b.ranks[i];
  }
  return 0;
}

export function categoryName(c: HandCategory | number): string {
  return (HAND_CATEGORY_NAMES[c] ?? 'Unknown').replace(/([A-Z])/g, ' $1').trim();
}

const RANK_SINGULAR: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
const RANK_PLURAL: Record<number, string> = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};
const RANK_SHORT: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export function describeHand(category: number, ranks: number[]): string {
  const sing = (r: number) => RANK_SINGULAR[r] ?? '?';
  const plur = (r: number) => RANK_PLURAL[r] ?? '?';
  const short = (r: number) => RANK_SHORT[r] ?? '?';

  switch (category) {
    case 9:
      return ranks[0] === 14 ? 'Royal Flush' : `Straight Flush, ${sing(ranks[0])}-high`;
    case 8:
      return `Four ${plur(ranks[0])}`;
    case 7:
      return `${plur(ranks[0])} full of ${plur(ranks[1])}`;
    case 6:
      return `Flush, ${sing(ranks[0])}-high`;
    case 5:
      return `Straight, ${sing(ranks[0])}-high`;
    case 4:
      return `Three ${plur(ranks[0])} (${short(ranks[1])} kicker)`;
    case 3:
      return `Two Pair, ${plur(ranks[0])} & ${plur(ranks[1])} (${short(ranks[2])} kicker)`;
    case 2:
      return `Pair of ${plur(ranks[0])} (${short(ranks[1])} kicker)`;
    case 1:
      return `${sing(ranks[0])}-high`;
    default:
      return 'Unknown';
  }
}
