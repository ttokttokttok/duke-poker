import { cardsToString } from '../poker/cards';
import {
  applyAction,
  createInitialState,
  isHandOver,
  legalActions,
  startHand,
} from '../poker/engine';
import type { Action, GameState, PlayerId } from '../poker/types';
import { makePublicView } from './publicView';
import { decide } from './strategy';

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function scriptedHero(s: GameState): Action {
  const legal = legalActions(s);
  const types = new Set(legal.map((a) => a.type));
  const toCall = s.currentBet - s.players[0].streetContribution;
  const pot = s.pot + s.players[0].streetContribution + s.players[1].streetContribution;

  if (toCall === 0 && types.has('check')) return { type: 'check' };
  if (toCall > 0 && toCall <= Math.max(4, pot * 0.4)) {
    if (types.has('call')) return { type: 'call' };
  }
  if (types.has('fold')) return { type: 'fold' };
  return { type: 'check' };
}

function playHand(
  initial: GameState,
  rng: () => number,
  label: string,
  verbose = true
): GameState {
  let s = startHand(initial, rng);
  if (verbose) {
    console.log(`\n=== ${label} ===`);
    console.log(
      `  Hero hole: ${cardsToString(s.players[0].holeCards!)}  Duke hole: ${cardsToString(s.players[1].holeCards!)}`
    );
  }

  let safety = 0;
  while (!isHandOver(s) && safety++ < 200) {
    const actingId = s.toAct as PlayerId;
    if (actingId === 0) {
      s = applyAction(s, scriptedHero(s));
    } else {
      const view = makePublicView(s, 1);
      const legal = legalActions(s);
      const { action, intent, strength } = decide(view, legal);
      if (verbose) {
        console.log(
          `  Duke decides: ${action.type}${
            'amount' in action ? ` $${action.amount}` : ''
          } (intent=${intent}, strength=${strength.toFixed(0)})`
        );
      }
      s = applyAction(s, action);
    }
  }

  if (verbose) {
    console.log('  Log:');
    for (const line of s.log) console.log('    ' + line);
    if (s.showdownInfo) {
      console.log(
        `  Showdown: Hero cat=${s.showdownInfo.p0!.category} vs Duke cat=${s.showdownInfo.p1!.category}`
      );
    }
    console.log(
      `  Stacks: Hero=$${s.players[0].stack} Duke=$${s.players[1].stack} (conserved: ${
        s.players[0].stack + s.players[1].stack === 400 ? '✓' : '✗'
      })`
    );
  }

  return s;
}

const rng = mulberry32(42);
let state = createInitialState();

console.log('Running 20 hands of Duke vs scripted passive Hero...');
let handsPlayed = 0;
let chipLeak = false;

for (let i = 0; i < 20; i++) {
  if (state.players[0].stack <= 0 || state.players[1].stack <= 0) {
    console.log(`\nBust at hand ${i + 1}. Stacks: ${state.players[0].stack}/${state.players[1].stack}`);
    break;
  }
  state = playHand(state, rng, `Hand ${i + 1}`, i < 3 || i === 19);
  handsPlayed++;
  if (state.players[0].stack + state.players[1].stack !== 400) {
    console.log(`!!! CHIP LEAK at hand ${i + 1}`);
    chipLeak = true;
    break;
  }
}

console.log(
  `\n✓ Completed ${handsPlayed} hands. Final stacks: Hero=$${state.players[0].stack} Duke=$${state.players[1].stack}.`
);
if (!chipLeak) console.log('  No chip leaks detected across all hands.');
