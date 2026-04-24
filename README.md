# Duke

**Heads-up no-limit Texas Hold'em against an AI you can actually talk to.**

Play real poker against Duke — a weathered Vegas pro who reads the board, sizes his bets, bluffs when it suits him, and trash-talks you in real time over your microphone. Powered by [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai), Anthropic's Claude Sonnet, and a split-brains architecture that separates *what Duke does* from *what Duke says*.

Built for the ElevenLabs hackathon.

---

## What makes it interesting

- **Split-brains AI.** Duke's *actions* come from a rules-based heads-up strategy module — real poker logic (range-weighted opens, c-bets, pot-odds calls, value vs bluff mixing). His *voice* is a separate ElevenLabs agent that gets fed game state as context and can lie freely about his hand. You might hear him sigh "alright, alright" right before he shoves a full house on you.
- **Opponent modeling.** Duke tracks your last 5 hands. Shove three times in a row from the button and he *will* call lighter. He'll tell you about it too.
- **Fair info only.** Duke sees exactly what a human opponent would — his own hand, the board, the betting. He never peeks at your hole cards. The voice prompt can only talk about what the strategy view allows.
- **Three ElevenLabs products used.** Conversational AI for Duke's voice + reasoning, Sound Generation for the card/chip/all-in SFX, Text-to-Speech (via the agent) for dynamic responses.

---

## How to play

1. Click **Connect voice** (top-right). Grant mic permission.
2. Duke greets you, you're in. Button alternates every hand, $1/$2 blinds, $200 stacks.
3. Make your action with the buttons (fold / check / call / bet / raise / all-in).
4. Talk to him whenever — during the hand, after a showdown, while he's thinking. Ask what he has, needle him, whatever. He'll answer in character and probably lie.
5. Click **Continue** between hands. Pop the **History** panel to see every hand's results and hole cards.

---

## Setup

### Prerequisites

- Node 20+ (tested on Node 24)
- An [ElevenLabs](https://elevenlabs.io) account + API key
- A modern Chromium-based browser (for mic + WebRTC)

### Install & configure

```bash
git clone https://github.com/ttokttokttok/duke-poker
cd duke-poker
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your ElevenLabs API key:

```
ELEVENLABS_API_KEY=sk_your_key_here
VITE_DUKE_AGENT_ID=
```

### Create the Duke agent

This script creates a Conversational AI agent on your ElevenLabs account configured with Duke's persona and voice, and writes the resulting agent ID back to `.env.local`:

```bash
npx tsx --env-file=.env.local scripts/createDukeAgent.ts
```

You'll see something like `✓ Created agent: agent_xxxx` and the ID will be appended to your `.env.local` as `VITE_DUKE_AGENT_ID`.

### Generate sound effects

Pre-generates three MP3s (card deal, chip slide, all-in stinger) into `public/sfx/`. Idempotent — skips files that already exist:

```bash
npx tsx --env-file=.env.local scripts/generateSfx.ts
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **Connect voice**, and play.

---

## Project layout

```
src/
├── poker/          # Engine: cards, betting rules, hand evaluator, streets, showdown
├── strategy/       # Duke's brain: hand strength, decision logic, opponent tracker
├── voice/          # ElevenLabs client wrapper + contextual update bridge
├── audio/          # SFX playback
├── game/           # Session hand history
├── ui/             # Vanilla-TS renderer, controls, history panel
├── style.css       # Felt table, cards, gold trim
└── main.ts         # Orchestrates the loop
scripts/
├── createDukeAgent.ts   # One-off: provisions the agent via ElevenLabs API
└── generateSfx.ts       # One-off: generates the 3 SFX via sound-generation API
```

The engine is pure — `applyAction(state, action) → newState`. Easy to unit-test, easy to bolt onto a UI. The two `smoke.ts` files run with `tsx` if you want to sanity-check the engine or strategy headlessly.

---

## Tech stack

| | |
|---|---|
| Engine + UI | TypeScript, Vite (vanilla-ts) |
| Voice | [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai) + Claude Sonnet 4.6 LLM |
| TTS | ElevenLabs Turbo v2 |
| SFX | ElevenLabs [Sound Generation](https://elevenlabs.io/docs/api-reference/sound-generation) |

---

## Known quirks

- First sound may be silent — browser autoplay policy blocks audio until a user interaction. Any click unblocks it.
- Duke's voice and his action are independent. He can sound scared and call, or sound confident and fold. That's a feature.
- Duke never sees your hole cards. If you ask him what you have, he genuinely doesn't know.
