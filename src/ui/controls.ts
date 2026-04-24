import { legalActions, isHandOver } from '../poker/engine';
import type { Action, GameState, LegalAction } from '../poker/types';

function hasType(legal: LegalAction[], type: Action['type']): LegalAction | undefined {
  return legal.find((a) => a.type === type);
}

export function renderControls(
  state: GameState,
  onAction: (a: Action) => void
) {
  const row = document.getElementById('controls-row')!;
  const postHand = document.getElementById('post-hand')!;
  row.innerHTML = '';

  if (isHandOver(state)) {
    postHand.classList.remove('hidden');
    return;
  }
  postHand.classList.add('hidden');

  if (state.toAct !== 0) {
    const waiting = document.createElement('div');
    waiting.className = 'showdown-label';
    waiting.textContent = "Duke's move...";
    row.appendChild(waiting);
    return;
  }

  const legal = legalActions(state);
  if (legal.length === 0) return;

  const fold = hasType(legal, 'fold');
  const check = hasType(legal, 'check');
  const call = hasType(legal, 'call');
  const bet = hasType(legal, 'bet');
  const raise = hasType(legal, 'raise');
  const allIn = hasType(legal, 'allIn');

  if (fold) row.appendChild(btn('Fold', 'btn-danger', () => onAction({ type: 'fold' })));
  if (check) row.appendChild(btn('Check', '', () => onAction({ type: 'check' })));
  if (call) {
    const amt = call.minAmount ?? 0;
    row.appendChild(btn(`Call $${amt}`, '', () => onAction({ type: 'call' })));
  }
  if (bet) {
    row.appendChild(
      betSlider('Bet', bet, state, 'bet', (amount) => onAction({ type: 'bet', amount }))
    );
  }
  if (raise) {
    row.appendChild(
      betSlider('Raise', raise, state, 'raise', (amount) =>
        onAction({ type: 'raise', amount })
      )
    );
  }
  if (allIn) {
    const amt = state.players[0].stack + state.players[0].streetContribution;
    row.appendChild(
      btn(`All-In $${amt}`, 'btn-allin', () => onAction({ type: 'allIn' }))
    );
  }
}

function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function betSlider(
  label: string,
  legal: LegalAction,
  state: GameState,
  kind: 'bet' | 'raise',
  onSubmit: (amount: number) => void
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bet-slider-wrap';

  const pot =
    state.pot + state.players[0].streetContribution + state.players[1].streetContribution;
  const min = legal.minAmount ?? 0;
  const max = legal.maxAmount ?? min;

  const amtDisplay = document.createElement('span');
  amtDisplay.className = 'bet-amount';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '1';

  const defaultValue =
    kind === 'bet'
      ? Math.max(min, Math.round(pot * 0.66))
      : Math.max(min, Math.round(state.currentBet * 2.5));
  slider.value = String(Math.min(max, defaultValue));

  const updateDisplay = () => {
    amtDisplay.textContent = `$${slider.value}`;
  };
  updateDisplay();
  slider.addEventListener('input', updateDisplay);

  const presets = document.createElement('div');
  presets.className = 'bet-presets';
  const makePreset = (text: string, amount: number) => {
    const p = document.createElement('button');
    p.type = 'button';
    p.className = 'preset';
    p.textContent = text;
    p.addEventListener('click', () => {
      const clamped = Math.min(max, Math.max(min, Math.round(amount)));
      slider.value = String(clamped);
      updateDisplay();
    });
    return p;
  };

  if (kind === 'bet') {
    presets.appendChild(makePreset('½', pot * 0.5));
    presets.appendChild(makePreset('¾', pot * 0.75));
    presets.appendChild(makePreset('POT', pot));
  } else {
    const currentBet = state.currentBet;
    const potRaise = pot + 2 * currentBet;
    presets.appendChild(makePreset('MIN', min));
    presets.appendChild(makePreset('2.5×', currentBet * 2.5));
    presets.appendChild(makePreset('3×', currentBet * 3));
    presets.appendChild(makePreset('POT', potRaise));
  }

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn-primary';
  submit.textContent = label;
  submit.addEventListener('click', () => {
    const amount = parseInt(slider.value, 10);
    onSubmit(amount);
  });

  wrap.appendChild(amtDisplay);
  wrap.appendChild(slider);
  wrap.appendChild(presets);
  wrap.appendChild(submit);
  return wrap;
}
