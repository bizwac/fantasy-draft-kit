// Synthesized via Web Audio rather than an audio file so the time's-up
// alert works fully offline with zero asset weight, matching the rest of
// this local-first app.
export function playTimesUpAlert(): void {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const beepAt = (startOffset: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      const startTime = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.25);
    };
    beepAt(0);
    beepAt(0.3);
    setTimeout(() => void ctx.close(), 700);
  } catch {
    // Web Audio unavailable/blocked — the visual "Time's up" badge still
    // shows, so this is a silent no-op rather than something to surface.
  }
}
