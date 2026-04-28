import './style.css';
import { play, preloadSfx } from './audio/sfx';
import { cardsToString } from './poker/cards';
import {
  applyAction,
  createInitialState,
  isHandOver,
  legalActions,
  startHand,
} from './poker/engine';
import type { Action, GameState, Street } from './poker/types';
import { makePublicView } from './strategy/publicView';
import { decide } from './strategy/strategy';
import { recordHand } from './game/history';
import { preflopStrength } from './strategy/handStrength';
import { getRead, recordHandEvent } from './strategy/opponentTracker';
import { renderControls } from './ui/controls';
import { initHistoryUI } from './ui/history';
import { renderGame, setConnectButton, setVoiceStatus } from './ui/render';
import { connectDuke, disconnectDuke, sendGameEvent } from './voice/duke';

let state: GameState = createInitialState();
state = startHand(state);

let lastRecordedHand = 0;
let heroThisHand = { shovedPreflop: false, foldedPreflop: false, raisedPreflop: false };

initHistoryUI();
preloadSfx();
play('cardDeal');
announceHandStart();
render();

function render() {
  renderGame(state);
  renderControls(state, onHeroAction);

  if (state.toAct === 1 && !isHandOver(state)) {
    window.setTimeout(dukeTurn, 700);
  }

  if (isHandOver(state) && state.handNumber !== lastRecordedHand) {
    lastRecordedHand = state.handNumber;
    announceHandEnd();
    recordHand(state);
    recordHandEvent({
      heroShovedPreflop: heroThisHand.shovedPreflop,
      heroFoldedPreflop: heroThisHand.foldedPreflop,
      heroRaisedPreflop: heroThisHand.raisedPreflop,
    });
    heroThisHand = { shovedPreflop: false, foldedPreflop: false, raisedPreflop: false };
  }
}

function onHeroAction(action: Action) {
  const streetBefore = state.street;
  if (streetBefore === 'preflop') {
    if (action.type === 'allIn') heroThisHand.shovedPreflop = true;
    else if (action.type === 'fold') heroThisHand.foldedPreflop = true;
    else if (action.type === 'raise') heroThisHand.raisedPreflop = true;
  }
  state = applyAction(state, action);
  playActionSfx(action, streetBefore, state.street);
  const last = state.log[state.log.length - 1];
  if (last) sendGameEvent(`[GAME] ${last}. Pot $${state.pot + sumStreet()}.`);
  render();
}

function strengthTier(strength: number): string {
  if (strength >= 85) return 'MONSTER';
  if (strength >= 65) return 'STRONG';
  if (strength >= 45) return 'MEDIUM';
  if (strength >= 25) return 'WEAK';
  return 'TRASH';
}

function dukeTurn() {
  if (state.toAct !== 1 || isHandOver(state)) return;
  const view = makePublicView(state, 1);
  const legal = legalActions(state);
  const { action, intent, strength } = decide(view, legal);

  const street = state.street.toUpperCase();
  const tier = strengthTier(strength);
  const boardTxt = state.board.length ? cardsToString(state.board) : 'none';
  const toCall = state.currentBet - state.players[1].streetContribution;

  const read = getRead();
  let readLine = '';
  if (read.handsSeen >= 2) {
    if (read.read === 'maniac') {
      readLine = ` Opponent read: MANIAC — ${read.shoveCount} all-ins in last ${read.handsSeen} hands.`;
    } else if (read.read === 'nit') {
      readLine = ` Opponent read: NIT — folding too much.`;
    } else if (read.read === 'aggressive') {
      readLine = ` Opponent read: aggressive — raises often.`;
    }
  }

  sendGameEvent(
    `[GAME] ${street}. Board: ${boardTxt}. Pot $${state.pot + sumStreet()}. ` +
      `To call: $${toCall}. Your stack: $${state.players[1].stack}. ` +
      `Your hand strength: ${tier} (${Math.round(strength)}/100). ` +
      `Intent: ${intent}. About to ${describeAction(action)}.${readLine}`
  );

  const streetBefore = state.street;
  state = applyAction(state, action);
  playActionSfx(action, streetBefore, state.street);
  render();
}

function playActionSfx(action: Action, streetBefore: Street, streetAfter: Street) {
  if (action.type === 'allIn') {
    play('allIn');
  } else if (
    action.type === 'call' ||
    action.type === 'bet' ||
    action.type === 'raise'
  ) {
    play('chipSlide');
  }
  if (
    streetBefore !== streetAfter &&
    (streetAfter === 'flop' || streetAfter === 'turn' || streetAfter === 'river')
  ) {
    window.setTimeout(() => play('cardDeal'), 180);
  }
}

function describeAction(a: Action): string {
  switch (a.type) {
    case 'fold': return 'fold';
    case 'check': return 'check';
    case 'call': return 'call';
    case 'bet': return `bet $${a.amount}`;
    case 'raise': return `raise to $${a.amount}`;
    case 'allIn': return 'move all-in';
  }
}

function sumStreet(): number {
  return state.players[0].streetContribution + state.players[1].streetContribution;
}

function announceHandStart() {
  const myPosition = state.button === 1 ? 'SB/button' : 'BB';
  const s = preflopStrength(state.players[1].holeCards!);
  const tier = strengthTier(s);
  sendGameEvent(
    `[GAME] --- New Hand ${state.handNumber} --- You are ${myPosition}. ` +
      `Preflop hand strength: ${tier}. ` +
      `Stacks: you $${state.players[1].stack}, opponent $${state.players[0].stack}. Blinds $${state.blinds.smallBlind}/$${state.blinds.bigBlind}.`
  );
}

function announceHandEnd() {
  const dukeStack = state.players[1].stack;
  const heroStack = state.players[0].stack;
  let outcome = '';
  if (state.winner === 1) outcome = 'You won the pot.';
  else if (state.winner === 0) outcome = 'Opponent won the pot.';
  else if (state.winner === 'split') outcome = 'Pot was split.';

  let showdownLine = '';
  if (state.showdownInfo) {
    const dukeCat = state.showdownInfo.p1!.category;
    const heroCat = state.showdownInfo.p0!.category;
    showdownLine = ` Showdown: you had category ${dukeCat}, opponent had ${heroCat}.`;
  }

  sendGameEvent(
    `[GAME] Hand over. ${outcome}${showdownLine} Your stack: $${dukeStack}. Opponent: $${heroStack}.`
  );
}

function newHand() {
  if (state.players[0].stack <= 0 || state.players[1].stack <= 0) {
    const busted = state.players[0].stack <= 0 ? 'You busted' : 'Duke busted';
    alert(`${busted}. Resetting stacks.`);
    state = createInitialState();
  }
  state = startHand(state);
  play('cardDeal');
  announceHandStart();
  render();
}

const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
nextBtn.addEventListener('click', newHand);

let voiceConnected = false;
const connectBtn = document.getElementById('btn-connect') as HTMLButtonElement;
connectBtn.addEventListener('click', async () => {
  if (voiceConnected) {
    disconnectDuke();
    voiceConnected = false;
    setConnectButton('Connect voice', false);
    setVoiceStatus('offline');
    return;
  }
  const agentId = import.meta.env.VITE_DUKE_AGENT_ID as string | undefined;
  if (!agentId) {
    alert(
      'VITE_DUKE_AGENT_ID is missing. Run `npx tsx --env-file=.env.local scripts/createDukeAgent.ts` and restart the dev server.'
    );
    return;
  }
  setConnectButton('Connecting...', true);
  try {
    await connectDuke(agentId, (s) => setVoiceStatus(s));
    voiceConnected = true;
    setConnectButton('Disconnect', false);

    announceHandStart();
  } catch (e) {
    console.error(e);
    setConnectButton('Connect voice', false);
    alert('Could not connect Duke. Check console.');
  }
});

setVoiceStatus('offline');
