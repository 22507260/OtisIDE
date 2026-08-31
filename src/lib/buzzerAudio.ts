/**
 * The noise a buzzer makes.
 *
 * The simulation says which buzzers are sounding and at what pitch; this turns
 * that into something audible. One oscillator per buzzer, kept alive while it
 * sounds so a steady tone stays steady, and retuned rather than restarted when
 * the frequency changes — restarting on every tick would turn a note into a
 * stutter.
 *
 * A square wave, because that is what a piezo driven off a digital pin actually
 * sounds like. Loud, so the gain is kept deliberately low.
 */

export type BuzzerVoice = {
  id: string;
  frequency: number;
  /** 0-1, how hard the part is being driven. */
  volume: number;
};

/** Square waves carry, so full drive is still quiet in absolute terms. */
const MAX_GAIN = 0.06;
/** Long enough to kill the click, short enough not to smear a short beep. */
const RAMP_SECONDS = 0.008;

type Voice = {
  oscillator: OscillatorNode;
  gain: GainNode;
  frequency: number;
};

let context: AudioContext | null = null;
let contextUnavailable = false;
const voices = new Map<string, Voice>();

function getContext(): AudioContext | null {
  if (contextUnavailable) return null;
  if (context) return context;

  // Tests run in Node, and a browser that has locked audio down should cost the
  // caller nothing more than silence.
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;

  if (!Ctor) {
    contextUnavailable = true;
    return null;
  }

  try {
    context = new Ctor();
    return context;
  } catch {
    contextUnavailable = true;
    return null;
  }
}

function releaseVoice(id: string): void {
  const voice = voices.get(id);
  if (!voice) return;
  voices.delete(id);

  const ctx = context;
  if (!ctx) return;

  const now = ctx.currentTime;
  try {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
    voice.oscillator.stop(now + RAMP_SECONDS * 2);
  } catch {
    // A voice already torn down by the context closing is nothing to report.
  }
}

/**
 * Makes the world sound like `next` and nothing else: buzzers not in the list
 * stop, ones already sounding are retuned in place.
 */
export function applyBuzzerVoices(next: readonly BuzzerVoice[]): void {
  const wanted = new Map(next.filter((voice) => voice.volume > 0).map((voice) => [voice.id, voice]));

  for (const id of [...voices.keys()]) {
    if (!wanted.has(id)) releaseVoice(id);
  }

  if (wanted.size === 0) return;

  const ctx = getContext();
  if (!ctx) return;

  // Started from a click on Start, so this is allowed to wake the device.
  if (ctx.state === 'suspended') void ctx.resume();

  for (const [id, request] of wanted) {
    const frequency = Math.max(20, Math.min(20000, request.frequency));
    const target = Math.min(MAX_GAIN, Math.max(0, request.volume) * MAX_GAIN);
    const now = ctx.currentTime;
    const existing = voices.get(id);

    if (existing) {
      if (existing.frequency !== frequency) {
        existing.oscillator.frequency.setValueAtTime(frequency, now);
        existing.frequency = frequency;
      }
      existing.gain.gain.cancelScheduledValues(now);
      existing.gain.gain.setValueAtTime(existing.gain.gain.value, now);
      existing.gain.gain.linearRampToValueAtTime(target, now + RAMP_SECONDS);
      continue;
    }

    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(target, now + RAMP_SECONDS);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      voices.set(id, { oscillator, gain, frequency });
    } catch {
      // No audio for this one; the canvas still shows it sounding.
      return;
    }
  }
}

/** Silence, for when the simulation stops or the canvas goes away. */
export function stopAllBuzzers(): void {
  for (const id of [...voices.keys()]) releaseVoice(id);
}
