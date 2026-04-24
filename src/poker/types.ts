export type Suit = 'c' | 'd' | 'h' | 's';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';
export type PlayerId = 0 | 1;

export interface Player {
  id: PlayerId;
  name: string;
  stack: number;
  holeCards: [Card, Card] | null;
  folded: boolean;
  allIn: boolean;
  streetContribution: number;
  totalContribution: number;
  hasActedThisStreet: boolean;
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'allIn' };

export interface LegalAction {
  type: Action['type'];
  minAmount?: number;
  maxAmount?: number;
}

export interface Blinds {
  smallBlind: number;
  bigBlind: number;
}

export interface GameState {
  players: [Player, Player];
  button: PlayerId;
  street: Street;
  board: Card[];
  deck: Card[];
  pot: number;
  currentBet: number;
  lastRaiseSize: number;
  toAct: PlayerId;
  canReopen: boolean;
  blinds: Blinds;
  handNumber: number;
  winner: PlayerId | 'split' | null;
  showdownInfo: {
    p0: { ranks: number[]; category: number } | null;
    p1: { ranks: number[]; category: number } | null;
  } | null;
  log: string[];
}

export const HandCategory = {
  HighCard: 1,
  OnePair: 2,
  TwoPair: 3,
  ThreeOfAKind: 4,
  Straight: 5,
  Flush: 6,
  FullHouse: 7,
  FourOfAKind: 8,
  StraightFlush: 9,
} as const;

export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export const HAND_CATEGORY_NAMES: Record<number, string> = {
  1: 'HighCard',
  2: 'OnePair',
  3: 'TwoPair',
  4: 'ThreeOfAKind',
  5: 'Straight',
  6: 'Flush',
  7: 'FullHouse',
  8: 'FourOfAKind',
  9: 'StraightFlush',
};

export interface EvaluatedHand {
  category: HandCategory;
  ranks: number[];
  cards: Card[];
}
