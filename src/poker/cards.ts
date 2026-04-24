import type { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['c', 'd', 'h', 's'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RANK_CHARS: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const SUIT_CHARS: Record<Suit, string> = {
  c: '♣', d: '♦', h: '♥', s: '♠',
};

export function cardToString(c: Card): string {
  return `${RANK_CHARS[c.rank]}${SUIT_CHARS[c.suit]}`;
}

export function cardsToString(cards: Card[]): string {
  return cards.map(cardToString).join(' ');
}
