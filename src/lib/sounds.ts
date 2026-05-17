/**
 * Tiny sound utility — Web Audio API, no file dependencies.
 * Falls back silently when audio is unavailable (SSR, blocked autoplay, etc.)
 */

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

/** Short click/tick — used on copy and outcome confirmation. */
export function playTick() {
  const ac = ctx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.09);
  } catch { /* no-op */ }
}

/** Gentle success chime — used when marking an invoice paid. */
export function playSuccess() {
  const ac = ctx();
  if (!ac) return;
  try {
    [[523, 0], [659, 0.08], [784, 0.16]].forEach(([freq, delay]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.09, ac.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.25);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + 0.26);
    });
  } catch { /* no-op */ }
}
