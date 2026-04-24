import type { Action, LegalAction } from '../poker/types';
import { postflopStrength, preflopStrength } from './handStrength';
import type { PublicGameView } from './publicView';
import { recentShoveRate } from './opponentTracker';

export interface StrategyDecision {
  action: Action;
  intent: DukeIntent;
  strength: number;
}

export type DukeIntent =
  | 'value_bet'
  | 'value_raise'
  | 'bluff'
  | 'semi_bluff'
  | 'trap'
  | 'pot_control'
  | 'call_for_value'
  | 'call_drawing'
  | 'call_pot_odds'
  | 'fold_weak'
  | 'fold_to_strength'
  | 'check_pot_control'
  | 'open_raise'
  | 'continuation_bet';

function clampAmount(amount: number, legal: LegalAction): number {
  const min = legal.minAmount ?? amount;
  const max = legal.maxAmount ?? amount;
  return Math.max(min, Math.min(max, amount));
}

function pickLegal<T extends Action['type']>(
  legal: LegalAction[],
  type: T
): LegalAction | undefined {
  return legal.find((a) => a.type === type);
}

function potOddsEquityNeeded(toCall: number, pot: number): number {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall + toCall);
}

function rng() {
  return Math.random();
}

export function decide(view: PublicGameView, legal: LegalAction[]): StrategyDecision {
  if (view.street === 'preflop') return decidePreflop(view, legal);
  return decidePostflop(view, legal);
}

function decidePreflop(view: PublicGameView, legal: LegalAction[]): StrategyDecision {
  const strength = preflopStrength(view.myHoleCards);
  const bb = view.blinds.bigBlind;
  const toCall = view.currentBet - view.myStreetContribution;
  const raiseLegal = pickLegal(legal, 'raise');
  const callLegal = pickLegal(legal, 'call');
  const checkLegal = pickLegal(legal, 'check');

  const noRaiseYet = view.currentBet === bb;
  const facingOpen = toCall > 0 && view.currentBet <= 4 * bb;
  const facing3bet = toCall > 0 && view.currentBet > 4 * bb && view.currentBet <= 12 * bb;
  const facing4betPlus = toCall > 0 && view.currentBet > 12 * bb;

  if (view.iAmButton && noRaiseYet) {
    if (strength >= 40 && raiseLegal) {
      const size = clampAmount(3 * bb, raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'open_raise', strength };
    }
    if (callLegal) {
      return { action: { type: 'call' }, intent: 'call_drawing', strength };
    }
    if (checkLegal) {
      return { action: { type: 'check' }, intent: 'check_pot_control', strength };
    }
    return { action: { type: 'fold' }, intent: 'fold_weak', strength };
  }

  if (!view.iAmButton && noRaiseYet && checkLegal) {
    if (strength >= 60 && raiseLegal) {
      const size = clampAmount(4 * bb, raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
    }
    if (strength >= 40 && raiseLegal && rng() < 0.4) {
      const size = clampAmount(3 * bb, raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
    }
    return { action: { type: 'check' }, intent: 'check_pot_control', strength };
  }

  if (facingOpen) {
    if (strength >= 82 && raiseLegal) {
      const size = clampAmount(Math.round(view.currentBet * 3.2), raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
    }
    if (strength >= 60 && callLegal) {
      return { action: { type: 'call' }, intent: 'call_for_value', strength };
    }
    if (strength >= 45 && callLegal && rng() < 0.5) {
      return { action: { type: 'call' }, intent: 'call_drawing', strength };
    }
    return { action: { type: 'fold' }, intent: 'fold_weak', strength };
  }

  if (facing3bet) {
    if (strength >= 90 && raiseLegal) {
      const size = clampAmount(Math.round(view.currentBet * 2.6), raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
    }
    if (strength >= 75 && callLegal) {
      return { action: { type: 'call' }, intent: 'call_for_value', strength };
    }
    return { action: { type: 'fold' }, intent: 'fold_to_strength', strength };
  }

  if (facing4betPlus) {
    const shoveAdjustment = recentShoveRate() * 45;
    const callThreshold = 93 - shoveAdjustment;
    if (strength >= callThreshold && callLegal) {
      return { action: { type: 'call' }, intent: 'call_for_value', strength };
    }
    return { action: { type: 'fold' }, intent: 'fold_to_strength', strength };
  }

  if (checkLegal) return { action: { type: 'check' }, intent: 'check_pot_control', strength };
  if (callLegal) return { action: { type: 'call' }, intent: 'call_pot_odds', strength };
  return { action: { type: 'fold' }, intent: 'fold_weak', strength };
}

function decidePostflop(view: PublicGameView, legal: LegalAction[]): StrategyDecision {
  const { strength, hasFlushDraw, hasStraightDraw } = postflopStrength(
    view.myHoleCards,
    view.board
  );
  const pot = view.pot + view.myStreetContribution + view.opponentStreetContribution;
  const toCall = view.currentBet - view.myStreetContribution;
  const raiseLegal = pickLegal(legal, 'raise');
  const betLegal = pickLegal(legal, 'bet');
  const callLegal = pickLegal(legal, 'call');
  const checkLegal = pickLegal(legal, 'check');

  const hasDraw = hasFlushDraw || hasStraightDraw;

  if (toCall === 0) {
    if (strength >= 85 && betLegal && rng() < 0.3) {
      return {
        action: { type: 'check' },
        intent: 'trap',
        strength,
      };
    }
    if (strength >= 65 && betLegal) {
      const size = clampAmount(Math.round(pot * 0.75), betLegal);
      return { action: { type: 'bet', amount: size }, intent: 'value_bet', strength };
    }
    if (strength >= 45 && betLegal && rng() < 0.55) {
      const size = clampAmount(Math.round(pot * 0.55), betLegal);
      return { action: { type: 'bet', amount: size }, intent: 'value_bet', strength };
    }
    if (hasDraw && betLegal && rng() < 0.6) {
      const size = clampAmount(Math.round(pot * 0.6), betLegal);
      return { action: { type: 'bet', amount: size }, intent: 'semi_bluff', strength };
    }
    const bluffChance = view.street === 'river' ? 0.22 : 0.30;
    if (strength < 35 && betLegal && rng() < bluffChance) {
      const size = clampAmount(Math.round(pot * 0.6), betLegal);
      return { action: { type: 'bet', amount: size }, intent: 'bluff', strength };
    }
    if (checkLegal) return { action: { type: 'check' }, intent: 'check_pot_control', strength };
  }

  if (toCall > 0) {
    const equityNeeded = potOddsEquityNeeded(toCall, pot);
    const myEquity = strength / 100;

    if (strength >= 88 && raiseLegal) {
      const size = clampAmount(view.currentBet * 3, raiseLegal);
      return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
    }
    if (strength >= 72 && callLegal && toCall < view.myStack * 0.5) {
      if (raiseLegal && rng() < 0.35) {
        const size = clampAmount(view.currentBet * 2.5, raiseLegal);
        return { action: { type: 'raise', amount: size }, intent: 'value_raise', strength };
      }
      return { action: { type: 'call' }, intent: 'call_for_value', strength };
    }
    if (myEquity >= equityNeeded * 1.15 && callLegal) {
      return { action: { type: 'call' }, intent: 'call_pot_odds', strength };
    }
    if (hasDraw && callLegal && toCall < pot * 0.5) {
      return { action: { type: 'call' }, intent: 'call_drawing', strength };
    }
    return { action: { type: 'fold' }, intent: 'fold_to_strength', strength };
  }

  if (checkLegal) return { action: { type: 'check' }, intent: 'check_pot_control', strength };
  if (callLegal) return { action: { type: 'call' }, intent: 'call_pot_odds', strength };
  return { action: { type: 'fold' }, intent: 'fold_weak', strength };
}
