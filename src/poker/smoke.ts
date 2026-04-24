import { cardsToString } from './cards';
import { categoryName } from './handEvaluator';
import {
  applyAction,
  createInitialState,
  currentPlayer,
  isHandOver,
  legalActions,
  startHand,
} from './engine';
import type { Action, GameState } from './types';

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function printState(s: GameState) {
  console.log(`\n[${s.street}] pot=$${s.pot} currentBet=$${s.currentBet}`);
  for (const p of s.players) {
    const hole = p.holeCards ? cardsToString(p.holeCards) : '??';
    const tags = [
      p.folded ? 'FOLDED' : '',
      p.allIn ? 'ALL-IN' : '',
      p.id === s.button ? 'BTN/SB' : 'BB',
      p.id === s.toAct && !isHandOver(s) ? '← to act' : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `  ${p.name.padEnd(6)} stack=$${p.stack} street=$${p.streetContribution} total=$${p.totalContribution} [${hole}] ${tags}`
    );
  }
  if (s.board.length) console.log(`  board: ${cardsToString(s.board)}`);
}

function act(s: GameState, action: Action, label: string): GameState {
  const actor = currentPlayer(s).name;
  console.log(`\n>>> ${actor}: ${label}`);
  const legal = legalActions(s).map((a) => a.type);
  console.log(`    legal: [${legal.join(', ')}]`);
  const next = applyAction(s, action);
  const lastLog = next.log[next.log.length - 1];
  console.log(`    → ${lastLog}`);
  return next;
}

function runScenario(title: string, seed: number, play: (s: GameState) => GameState) {
  console.log('\n' + '='.repeat(60));
  console.log('SCENARIO: ' + title);
  console.log('='.repeat(60));
  const rng = mulberry32(seed);
  let s = createInitialState();
  s = startHand(s, rng);
  printState(s);
  s = play(s);
  printState(s);
  console.log('\n--- EVENT LOG ---');
  for (const line of s.log) console.log('  ' + line);
  if (s.showdownInfo) {
    console.log('\n--- SHOWDOWN ---');
    console.log(
      `  ${s.players[0].name}: ${categoryName(s.showdownInfo.p0!.category)} [${s.showdownInfo.p0!.ranks.join(',')}]`
    );
    console.log(
      `  ${s.players[1].name}: ${categoryName(s.showdownInfo.p1!.category)} [${s.showdownInfo.p1!.ranks.join(',')}]`
    );
  }
  const stacksOk =
    s.players[0].stack + s.players[1].stack + s.pot === 400;
  console.log(
    `\n  Stack check: $${s.players[0].stack} + $${s.players[1].stack} + pot $${s.pot} = $${s.players[0].stack + s.players[1].stack + s.pot} ${stacksOk ? '✓' : '✗ CHIP LEAK'}`
  );
}

runScenario('SB limps, BB checks, play through to showdown', 1, (s0) => {
  let s = s0;
  s = act(s, { type: 'call' }, 'limp call $1');
  s = act(s, { type: 'check' }, 'check option');
  s = act(s, { type: 'check' }, 'flop check');
  s = act(s, { type: 'check' }, 'flop check back');
  s = act(s, { type: 'check' }, 'turn check');
  s = act(s, { type: 'check' }, 'turn check back');
  s = act(s, { type: 'check' }, 'river check');
  s = act(s, { type: 'check' }, 'river check back');
  return s;
});

runScenario('SB raises, BB 3bets, SB folds', 2, (s0) => {
  let s = s0;
  s = act(s, { type: 'raise', amount: 6 }, 'open to $6');
  s = act(s, { type: 'raise', amount: 18 }, '3bet to $18');
  s = act(s, { type: 'fold' }, 'fold');
  return s;
});

runScenario('Open, call, bet, raise, call, check-check, bet, call (river)', 3, (s0) => {
  let s = s0;
  s = act(s, { type: 'raise', amount: 6 }, 'open to $6');
  s = act(s, { type: 'call' }, 'call');
  s = act(s, { type: 'check' }, 'flop check');
  s = act(s, { type: 'bet', amount: 8 }, 'flop bet $8');
  s = act(s, { type: 'raise', amount: 24 }, 'flop raise to $24');
  s = act(s, { type: 'call' }, 'call');
  s = act(s, { type: 'check' }, 'turn check');
  s = act(s, { type: 'check' }, 'turn check back');
  s = act(s, { type: 'bet', amount: 40 }, 'river bet $40');
  s = act(s, { type: 'call' }, 'call');
  return s;
});

runScenario('SB jams preflop, BB calls off', 4, (s0) => {
  let s = s0;
  s = act(s, { type: 'allIn' }, 'shove');
  s = act(s, { type: 'call' }, 'call all-in');
  return s;
});

console.log('\n✓ All smoke scenarios completed.');
