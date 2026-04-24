import { clearHistory, formatCards, getHistory, subscribeHistory } from '../game/history';
import type { HandRecord } from '../game/history';

function recordHTML(r: HandRecord): string {
  const result =
    r.winner === 'hero'
      ? `<span class="pill win">+$${r.amount}</span>`
      : r.winner === 'duke'
        ? `<span class="pill loss">-$${r.amount}</span>`
        : `<span class="pill">split</span>`;

  const showdownLine = r.heroDescription
    ? `<div class="hand-mini">You: <b>${r.heroDescription}</b></div><div class="hand-mini">Duke: <b>${r.dukeDescription}</b></div>`
    : `<div class="hand-mini muted">${r.folder === 'hero' ? 'You folded' : 'Duke folded'}</div>`;

  const cardsLine =
    r.heroCards.length && r.dukeCards.length
      ? `<div class="hand-cards">You: <code>${formatCards(r.heroCards)}</code> · Duke: <code>${formatCards(r.dukeCards)}</code></div>`
      : '';

  const boardLine = r.board.length
    ? `<div class="hand-cards muted">Board: <code>${formatCards(r.board)}</code></div>`
    : '';

  return `
    <div class="hand-row">
      <div class="hand-row-head">
        <span class="hand-label">#${r.handNumber}</span>
        ${result}
      </div>
      ${cardsLine}
      ${boardLine}
      ${showdownLine}
    </div>
  `;
}

export function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const rows = getHistory();
  if (rows.length === 0) {
    list.innerHTML = '<div class="history-empty">No hands played yet.</div>';
    return;
  }
  list.innerHTML = rows
    .slice()
    .reverse()
    .map(recordHTML)
    .join('');
}

export function initHistoryUI() {
  const panel = document.getElementById('history-panel')!;
  const toggleBtn = document.getElementById('btn-history')!;
  const closeBtn = document.getElementById('btn-close-history')!;
  const clearBtn = document.getElementById('btn-clear-history')!;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('closed');
    renderHistory();
  });
  closeBtn.addEventListener('click', () => panel.classList.add('closed'));
  clearBtn.addEventListener('click', () => {
    clearHistory();
    renderHistory();
  });

  subscribeHistory(renderHistory);
  renderHistory();
}
