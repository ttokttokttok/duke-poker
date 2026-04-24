import { cardsToString, makeDeck, shuffle } from './cards';
import { compareHands, evaluate7 } from './handEvaluator';
import type {
  Action,
  Blinds,
  GameState,
  LegalAction,
  Player,
  PlayerId,
} from './types';

export interface EngineConfig {
  startingStack: number;
  blinds: Blinds;
  p0Name?: string;
  p1Name?: string;
  rng?: () => number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  startingStack: 200,
  blinds: { smallBlind: 1, bigBlind: 2 },
  p0Name: 'Hero',
  p1Name: 'Duke',
};

function makePlayer(id: PlayerId, name: string, stack: number): Player {
  return {
    id,
    name,
    stack,
    holeCards: null,
    folded: false,
    allIn: false,
    streetContribution: 0,
    totalContribution: 0,
    hasActedThisStreet: false,
  };
}

export function createInitialState(config: Partial<EngineConfig> = {}): GameState {
  const c = { ...DEFAULT_CONFIG, ...config };
  return {
    players: [
      makePlayer(0, c.p0Name ?? 'Hero', c.startingStack),
      makePlayer(1, c.p1Name ?? 'Duke', c.startingStack),
    ],
    button: 0,
    street: 'ended',
    board: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    toAct: 0,
    canReopen: true,
    blinds: c.blinds,
    handNumber: 0,
    winner: null,
    showdownInfo: null,
    log: [],
  };
}

export function startHand(state: GameState, rng: () => number = Math.random): GameState {
  const s = structuredClone(state);

  if (s.handNumber > 0) {
    s.button = (1 - s.button) as PlayerId;
  }
  s.handNumber += 1;

  for (const p of s.players) {
    p.holeCards = null;
    p.folded = false;
    p.allIn = false;
    p.streetContribution = 0;
    p.totalContribution = 0;
    p.hasActedThisStreet = false;
  }

  s.board = [];
  s.pot = 0;
  s.winner = null;
  s.showdownInfo = null;
  s.street = 'preflop';
  s.canReopen = true;
  s.log = [`--- Hand ${s.handNumber} --- Button: ${s.players[s.button].name}`];

  s.deck = shuffle(makeDeck(), rng);

  const sbId = s.button;
  const bbId = (1 - s.button) as PlayerId;
  const sb = s.players[sbId];
  const bb = s.players[bbId];

  sb.holeCards = [s.deck.pop()!, s.deck.pop()!];
  bb.holeCards = [s.deck.pop()!, s.deck.pop()!];

  const sbAmount = Math.min(s.blinds.smallBlind, sb.stack);
  sb.stack -= sbAmount;
  sb.streetContribution = sbAmount;
  sb.totalContribution = sbAmount;
  if (sb.stack === 0) sb.allIn = true;

  const bbAmount = Math.min(s.blinds.bigBlind, bb.stack);
  bb.stack -= bbAmount;
  bb.streetContribution = bbAmount;
  bb.totalContribution = bbAmount;
  if (bb.stack === 0) bb.allIn = true;

  s.currentBet = s.blinds.bigBlind;
  s.lastRaiseSize = s.blinds.bigBlind;
  s.toAct = sbId;

  s.log.push(
    `${sb.name} posts SB $${sbAmount}, ${bb.name} posts BB $${bbAmount}`
  );

  return s;
}

export function currentPlayer(s: GameState): Player {
  return s.players[s.toAct];
}

export function opponent(s: GameState, id: PlayerId): Player {
  return s.players[1 - id];
}

export function legalActions(s: GameState): LegalAction[] {
  if (s.street === 'ended' || s.street === 'showdown') return [];
  const p = currentPlayer(s);
  if (p.folded || p.allIn) return [];

  const toCall = s.currentBet - p.streetContribution;
  const actions: LegalAction[] = [];

  if (toCall === 0) {
    actions.push({ type: 'check' });
    actions.push({ type: 'fold' });
    if (s.canReopen && p.stack > 0) {
      const minBet = Math.min(s.blinds.bigBlind, p.stack);
      actions.push({
        type: 'bet',
        minAmount: minBet,
        maxAmount: p.stack,
      });
      actions.push({ type: 'allIn' });
    }
  } else {
    actions.push({ type: 'fold' });
    const callAmount = Math.min(toCall, p.stack);
    actions.push({ type: 'call', minAmount: callAmount, maxAmount: callAmount });
    if (s.canReopen && p.stack > toCall) {
      const minRaiseTo = s.currentBet + s.lastRaiseSize;
      const maxRaiseTo = p.streetContribution + p.stack;
      if (maxRaiseTo >= minRaiseTo) {
        actions.push({
          type: 'raise',
          minAmount: minRaiseTo,
          maxAmount: maxRaiseTo,
        });
      }
      actions.push({ type: 'allIn' });
    } else if (p.stack > 0 && !s.canReopen) {
      actions.push({ type: 'allIn' });
    }
  }

  return actions;
}

function validateAction(s: GameState, action: Action): string | null {
  if (s.street === 'ended' || s.street === 'showdown') return 'Hand is over';
  const p = currentPlayer(s);
  const legal = legalActions(s);
  const match = legal.find((a) => a.type === action.type);
  if (!match) return `Action ${action.type} not legal`;

  if (action.type === 'bet' || action.type === 'raise') {
    const amt = action.amount;
    if (match.minAmount !== undefined && amt < match.minAmount) {
      return `${action.type} must be at least ${match.minAmount}`;
    }
    if (match.maxAmount !== undefined && amt > match.maxAmount) {
      return `${action.type} cannot exceed ${match.maxAmount}`;
    }
    if (action.type === 'bet' && p.streetContribution !== 0) {
      return 'Cannot bet when there is already a bet';
    }
  }

  return null;
}

function refundStreetOverage(s: GameState) {
  const [p0, p1] = s.players;
  if (p0.streetContribution === p1.streetContribution) return;
  const hi = p0.streetContribution > p1.streetContribution ? 0 : 1;
  const lo = 1 - hi;
  const diff = s.players[hi].streetContribution - s.players[lo].streetContribution;
  if (diff > 0) {
    s.players[hi].streetContribution -= diff;
    s.players[hi].stack += diff;
    s.players[hi].totalContribution -= diff;
    s.log.push(`Returned $${diff} uncalled to ${s.players[hi].name}`);
  }
}

function collectStreet(s: GameState) {
  refundStreetOverage(s);
  s.pot += s.players[0].streetContribution + s.players[1].streetContribution;
  s.players[0].streetContribution = 0;
  s.players[1].streetContribution = 0;
  s.currentBet = 0;
  s.lastRaiseSize = 0;
  s.canReopen = true;
  s.players[0].hasActedThisStreet = false;
  s.players[1].hasActedThisStreet = false;
}

function dealBoard(s: GameState, count: number) {
  s.deck.pop();
  for (let i = 0; i < count; i++) {
    s.board.push(s.deck.pop()!);
  }
}

function advanceStreet(s: GameState) {
  if (s.street === 'preflop') {
    s.street = 'flop';
    dealBoard(s, 3);
    s.log.push(`Flop: ${cardsToString(s.board)}`);
  } else if (s.street === 'flop') {
    s.street = 'turn';
    dealBoard(s, 1);
    s.log.push(`Turn: ${cardsToString(s.board)}`);
  } else if (s.street === 'turn') {
    s.street = 'river';
    dealBoard(s, 1);
    s.log.push(`River: ${cardsToString(s.board)}`);
  } else if (s.street === 'river') {
    s.street = 'showdown';
    return;
  }

  const bbId = (1 - s.button) as PlayerId;
  s.toAct = bbId;

  if (s.players[0].allIn || s.players[1].allIn) {
    runItOut(s);
  }
}

function runItOut(s: GameState) {
  while (s.street === 'flop' || s.street === 'turn' || s.street === 'river') {
    if (s.street === 'flop') {
      s.street = 'turn';
      dealBoard(s, 1);
      s.log.push(`Turn: ${cardsToString(s.board)}`);
    } else if (s.street === 'turn') {
      s.street = 'river';
      dealBoard(s, 1);
      s.log.push(`River: ${cardsToString(s.board)}`);
    } else if (s.street === 'river') {
      s.street = 'showdown';
      return;
    }
  }
}

function resolveShowdown(s: GameState) {
  const [p0, p1] = s.players;
  if (!p0.holeCards || !p1.holeCards) throw new Error('Missing hole cards at showdown');

  const h0 = evaluate7([...p0.holeCards, ...s.board]);
  const h1 = evaluate7([...p1.holeCards, ...s.board]);
  s.showdownInfo = {
    p0: { ranks: h0.ranks, category: h0.category },
    p1: { ranks: h1.ranks, category: h1.category },
  };

  const cmp = compareHands(h0, h1);
  if (cmp > 0) awardPot(s, 0);
  else if (cmp < 0) awardPot(s, 1);
  else {
    const half = Math.floor(s.pot / 2);
    p0.stack += half;
    p1.stack += s.pot - half;
    s.log.push(`Split pot: $${s.pot} → each gets ~$${half}`);
    s.winner = 'split';
    s.pot = 0;
  }
  s.street = 'ended';
}

function awardPot(s: GameState, winnerId: PlayerId) {
  s.players[winnerId].stack += s.pot;
  s.log.push(`${s.players[winnerId].name} wins pot of $${s.pot}`);
  s.winner = winnerId;
  s.pot = 0;
}

function isRoundClosed(s: GameState): boolean {
  const [p0, p1] = s.players;
  if (p0.folded || p1.folded) return true;
  if (p0.allIn && p1.allIn) return true;

  const matched = p0.streetContribution === p1.streetContribution;
  if (!matched) return false;

  if (p0.allIn || p1.allIn) {
    const active = p0.allIn ? p1 : p0;
    return active.hasActedThisStreet;
  }

  return p0.hasActedThisStreet && p1.hasActedThisStreet;
}

export function applyAction(state: GameState, action: Action): GameState {
  const err = validateAction(state, action);
  if (err) throw new Error(`Invalid action: ${err}`);

  const s = structuredClone(state);
  const p = s.players[s.toAct];
  const o = s.players[1 - s.toAct];
  const actingId = s.toAct;

  switch (action.type) {
    case 'fold': {
      p.folded = true;
      s.log.push(`${p.name} folds`);
      collectStreet(s);
      awardPot(s, o.id);
      s.street = 'ended';
      return s;
    }
    case 'check': {
      p.hasActedThisStreet = true;
      s.log.push(`${p.name} checks`);
      break;
    }
    case 'call': {
      const toCall = Math.min(s.currentBet - p.streetContribution, p.stack);
      p.stack -= toCall;
      p.streetContribution += toCall;
      p.totalContribution += toCall;
      if (p.stack === 0) p.allIn = true;
      p.hasActedThisStreet = true;
      s.log.push(`${p.name} calls $${toCall}${p.allIn ? ' (all-in)' : ''}`);
      break;
    }
    case 'bet': {
      const amount = action.amount;
      p.stack -= amount;
      p.streetContribution = amount;
      p.totalContribution += amount;
      s.currentBet = amount;
      s.lastRaiseSize = amount;
      s.canReopen = true;
      p.hasActedThisStreet = true;
      o.hasActedThisStreet = false;
      if (p.stack === 0) p.allIn = true;
      s.log.push(`${p.name} bets $${amount}${p.allIn ? ' (all-in)' : ''}`);
      break;
    }
    case 'raise': {
      const amount = action.amount;
      const delta = amount - p.streetContribution;
      p.stack -= delta;
      const increment = amount - s.currentBet;
      p.streetContribution = amount;
      p.totalContribution += delta;
      s.lastRaiseSize = increment;
      s.currentBet = amount;
      s.canReopen = true;
      p.hasActedThisStreet = true;
      o.hasActedThisStreet = false;
      if (p.stack === 0) p.allIn = true;
      s.log.push(`${p.name} raises to $${amount}${p.allIn ? ' (all-in)' : ''}`);
      break;
    }
    case 'allIn': {
      const putIn = p.stack;
      const newTotal = p.streetContribution + putIn;
      p.stack = 0;
      p.allIn = true;
      p.totalContribution += putIn;
      p.streetContribution = newTotal;
      p.hasActedThisStreet = true;

      if (newTotal > s.currentBet) {
        const increment = newTotal - s.currentBet;
        if (increment >= s.lastRaiseSize) {
          s.lastRaiseSize = increment;
          s.canReopen = true;
        } else {
          s.canReopen = false;
        }
        s.currentBet = newTotal;
        o.hasActedThisStreet = false;
      }
      s.log.push(`${p.name} all-in for $${putIn} (total $${newTotal})`);
      break;
    }
  }

  if (isRoundClosed(s)) {
    collectStreet(s);
    if (s.street === 'river') {
      s.street = 'showdown';
      resolveShowdown(s);
      return s;
    }
    advanceStreet(s);
    if (s.street === 'showdown') {
      resolveShowdown(s);
      return s;
    }
  } else {
    s.toAct = (1 - actingId) as PlayerId;
  }

  return s;
}

export function isHandOver(s: GameState): boolean {
  return s.street === 'ended';
}
