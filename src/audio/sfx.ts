type SoundName = 'cardDeal' | 'chipSlide' | 'allIn';

const URLS: Record<SoundName, string> = {
  cardDeal: '/sfx/card_deal.mp3',
  chipSlide: '/sfx/chip_slide.mp3',
  allIn: '/sfx/all_in.mp3',
};

const VOLUMES: Record<SoundName, number> = {
  cardDeal: 0.55,
  chipSlide: 0.45,
  allIn: 0.7,
};

let muted = false;

export function play(name: SoundName): void {
  if (muted) return;
  try {
    const audio = new Audio(URLS[name]);
    audio.volume = VOLUMES[name];
    audio.play().catch(() => {
      /* autoplay blocked — ignore silently */
    });
  } catch {
    /* swallow */
  }
}

export function preloadSfx(): void {
  for (const url of Object.values(URLS)) {
    const a = new Audio(url);
    a.preload = 'auto';
    a.volume = 0;
    a.load();
  }
}

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}
