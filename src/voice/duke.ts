import { Conversation } from '@elevenlabs/client';

type VoiceStatus = 'offline' | 'connected' | 'speaking' | 'listening';
type StatusHandler = (status: VoiceStatus) => void;

let conversation: Conversation | null = null;

export async function connectDuke(agentId: string, onStatus: StatusHandler): Promise<void> {
  if (conversation) return;
  conversation = await Conversation.startSession({
    agentId,
    connectionType: 'webrtc',
    onConnect: () => onStatus('connected'),
    onDisconnect: () => {
      onStatus('offline');
      conversation = null;
    },
    onError: (err) => {
      console.error('[duke]', err);
    },
    onModeChange: (mode: { mode: string }) => {
      if (mode.mode === 'speaking') onStatus('speaking');
      else if (mode.mode === 'listening') onStatus('listening');
      else onStatus('connected');
    },
    onMessage: (m: { source: string; message: string }) => {
      console.log('[duke]', m.source, m.message);
    },
  });
}

export function disconnectDuke() {
  conversation?.endSession();
  conversation = null;
}

export function sendGameEvent(text: string) {
  if (!conversation) return;
  try {
    const c = conversation as unknown as {
      sendContextualUpdate?: (t: string) => void;
    };
    if (typeof c.sendContextualUpdate === 'function') {
      c.sendContextualUpdate(text);
    }
  } catch (e) {
    console.warn('sendGameEvent failed:', e);
  }
}

export function isVoiceConnected(): boolean {
  return conversation !== null;
}
