import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY not set. Run with: npx tsx --env-file=.env.local scripts/generateSfx.ts');
  process.exit(1);
}

interface SfxSpec {
  filename: string;
  prompt: string;
  durationSeconds: number;
  promptInfluence?: number;
}

const sfx: SfxSpec[] = [
  {
    filename: 'card_deal.mp3',
    prompt:
      'Single crisp poker card sliding across green felt table. Soft swoosh then light paper-on-paper slap. Close-mic, clean, no music, no voice.',
    durationSeconds: 0.6,
    promptInfluence: 0.7,
  },
  {
    filename: 'chip_slide.mp3',
    prompt:
      'A small stack of clay poker chips being pushed forward on felt, followed by a soft clack as they settle. Close-mic, dry, no music, no voice.',
    durationSeconds: 0.9,
    promptInfluence: 0.7,
  },
  {
    filename: 'all_in.mp3',
    prompt:
      'Dramatic deep cinematic stinger. Low sub-bass boom, rising tension swell, subtle metallic shimmer. Poker all-in moment. No voice.',
    durationSeconds: 2.0,
    promptInfluence: 0.6,
  },
];

const outDir = path.resolve(process.cwd(), 'public', 'sfx');
fs.mkdirSync(outDir, { recursive: true });

for (const s of sfx) {
  const outPath = path.join(outDir, s.filename);
  if (fs.existsSync(outPath)) {
    console.log(`↪ ${s.filename} already exists, skipping`);
    continue;
  }

  console.log(`→ Generating ${s.filename}...`);
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: s.prompt,
      duration_seconds: s.durationSeconds,
      prompt_influence: s.promptInfluence ?? 0.5,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`✗ ${s.filename}: ${response.status} ${err}`);
    process.exit(1);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ ${s.filename} saved (${buffer.byteLength} bytes)`);
}

console.log(`\n✓ All SFX ready in public/sfx/`);
