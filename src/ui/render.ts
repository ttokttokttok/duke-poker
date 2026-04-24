import type { Card, GameState, Suit } from '../poker/types';
import { isHandOver } from '../poker/engine';
import { describeHand } from '../poker/handEvaluator';

const SUIT_SYMBOL: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const SUIT_COLOR: Record<Suit, 'red' | 'black'> = { c: 'black', d: 'red', h: 'red', s: 'black' };
const RANK_STR: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

function q(sel: string): HTMLElement {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el as HTMLElement;
}

function cardHTML(c: Card, faceDown = false, isBoard = false): string {
  if (faceDown) return `<div class="card back"></div>`;
  const cls = `card ${SUIT_COLOR[c.suit]}${isBoard ? ' board-card' : ''}`;
  const rankClass = c.rank === 10 ? 'rank rank-10' : 'rank';
  return `<div class="${cls}"><div class="${rankClass}">${RANK_STR[c.rank]}</div><div class="suit">${SUIT_SYMBOL[c.suit]}</div></div>`;
}

export function renderGame(state: GameState) {
  const duke = state.players[1];
  const hero = state.players[0];

  q('#hand-number').textContent = state.handNumber > 0 ? `Hand ${state.handNumber}` : 'Hand —';
  q('#street-label').textContent = state.street.replace('_', ' ').toUpperCase();

  q('#duke-stack').textContent = `$${duke.stack}`;
  q('#hero-stack').textContent = `$${hero.stack}`;

  const dukeBet = q('#duke-bet');
  const heroBet = q('#hero-bet');
  dukeBet.textContent = duke.streetContribution > 0 ? `$${duke.streetContribution}` : '';
  heroBet.textContent = hero.streetContribution > 0 ? `$${hero.streetContribution}` : '';
  dukeBet.classList.toggle('has-bet', duke.streetContribution > 0);
  heroBet.classList.toggle('has-bet', hero.streetContribution > 0);

  const reveal = state.showdownInfo !== null || isHandOver(state);

  const dukeCardsEl = q('#duke-cards');
  dukeCardsEl.innerHTML = duke.holeCards
    ? duke.holeCards.map((c) => cardHTML(c, !reveal)).join('')
    : '';

  const heroCardsEl = q('#hero-cards');
  heroCardsEl.innerHTML = hero.holeCards
    ? hero.holeCards.map((c) => cardHTML(c, false)).join('')
    : '';

  const dukeBadge = q('#duke-badge');
  const heroBadge = q('#hero-badge');
  dukeBadge.textContent = state.button === 1 ? 'SB/BTN' : 'BB';
  heroBadge.textContent = state.button === 0 ? 'SB/BTN' : 'BB';
  dukeBadge.classList.toggle('visible', state.street !== 'ended');
  heroBadge.classList.toggle('visible', state.street !== 'ended');

  q('#seat-duke').classList.toggle('active', state.toAct === 1 && !isHandOver(state));
  q('#seat-hero').classList.toggle('active', state.toAct === 0 && !isHandOver(state));

  q('#board').innerHTML = state.board.map((c) => cardHTML(c, false, true)).join('');
  q('#pot').textContent = `$${state.pot + duke.streetContribution + hero.streetContribution}`;

  const lastLine = state.log[state.log.length - 1] ?? '';
  q('#last-action').textContent = lastLine;

  const result = q('#hand-result');
  if (isHandOver(state) && state.winner !== null) {
    result.classList.remove('hidden');
    const heroWon = state.winner === 0;
    const split = state.winner === 'split';
    result.classList.toggle('win', heroWon);
    result.classList.toggle('loss', !heroWon && !split);
    const title = heroWon ? 'YOU WIN' : split ? 'SPLIT POT' : 'DUKE WINS';

    const amountLine = winnings(state);

    let detail = '';
    if (state.showdownInfo) {
      const hero = state.showdownInfo.p0!;
      const duke = state.showdownInfo.p1!;
      const heroDesc = describeHand(hero.category, hero.ranks);
      const dukeDesc = describeHand(duke.category, duke.ranks);
      detail = `You: ${heroDesc}<br>Duke: ${dukeDesc}`;
    } else {
      const folder = state.players[0].folded ? 'You folded' : 'Duke folded';
      detail = folder;
    }

    result.innerHTML = `${title}${amountLine ? ' · ' + amountLine : ''}<span class="detail">${detail}</span>`;
  } else {
    result.classList.add('hidden');
  }
}

function winnings(state: GameState): string {
  const match = /wins pot of \$(\d+)/.exec(state.log.slice(-3).join(' ')) || [];
  return match[1] ? `$${match[1]}` : '';
}

export function setVoiceStatus(status: 'offline' | 'connected' | 'speaking' | 'listening') {
  const el = q('#voice-status');
  el.textContent = status;
  el.className = 'status ' + (status === 'offline' ? '' : status);
}

export function setConnectButton(text: string, disabled: boolean) {
  const btn = q('#btn-connect') as HTMLButtonElement;
  btn.textContent = text;
  btn.disabled = disabled;
}
