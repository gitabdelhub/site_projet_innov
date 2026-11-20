/** Short synthesized sounds (no audio file to download). */
type Kind = 'move' | 'capture' | 'notify' | 'low-time' | 'end';

let ctx: AudioContext | null = null;
const audio = () => {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

const tone = (a: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') => {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
};

export const playSound = (kind: Kind) => {
  const a = audio();
  if (!a) return;
  switch (kind) {
    case 'move':
      tone(a, 520, 0, 0.07, 0.18, 'triangle');
      break;
    case 'capture':
      tone(a, 300, 0, 0.09, 0.25, 'square');
      tone(a, 180, 0.03, 0.08, 0.15, 'triangle');
      break;
    case 'notify':
      tone(a, 660, 0, 0.12, 0.15);
      tone(a, 880, 0.12, 0.16, 0.15);
      break;
    case 'low-time':
      tone(a, 990, 0, 0.08, 0.12);
      break;
    case 'end':
      tone(a, 523, 0, 0.18, 0.15);
      tone(a, 659, 0.15, 0.18, 0.15);
      tone(a, 784, 0.3, 0.3, 0.15);
      break;
  }
};
