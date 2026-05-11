/**
 * @file sounds.svelte.ts — minimal UI sound effects (REQ-UI: audio cues).
 *
 * - WebAudio synth (no external assets) so we stay PWA-self-contained
 * - User-toggleable via localStorage('dwight.sound')
 * - Lazy-initializes AudioContext on first call (user-gesture required by
 *   most browsers)
 */
type SoundType = 'bet' | 'live' | 'win' | 'lose' | 'drink';

let ctx: AudioContext | null = null;
let enabled = $state(true);

function loadPref() {
	if (typeof localStorage === 'undefined') return;
	const v = localStorage.getItem('dwight.sound');
	if (v === '0') enabled = false;
}
loadPref();

export function isSoundEnabled(): boolean {
	return enabled;
}
export function setSoundEnabled(on: boolean): void {
	enabled = on;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('dwight.sound', on ? '1' : '0');
	}
}

function ensureCtx(): AudioContext | null {
	if (!enabled) return null;
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const C = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
		if (!C) return null;
		ctx = new C();
	}
	return ctx;
}

function blip(freqs: number[], durMs: number, type: OscillatorType = 'sine', gain = 0.05) {
	const c = ensureCtx();
	if (!c) return;
	const now = c.currentTime;
	const g = c.createGain();
	g.gain.value = gain;
	g.gain.setValueAtTime(gain, now);
	g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
	g.connect(c.destination);
	for (const f of freqs) {
		const o = c.createOscillator();
		o.type = type;
		o.frequency.value = f;
		o.connect(g);
		o.start(now);
		o.stop(now + durMs / 1000);
	}
}

export function playSound(t: SoundType): void {
	switch (t) {
		case 'bet':
			blip([660], 80, 'square', 0.04);
			break;
		case 'live':
			blip([440, 660], 220, 'triangle', 0.06);
			break;
		case 'win':
			blip([523, 659, 784], 350, 'triangle', 0.08);
			break;
		case 'lose':
			blip([220, 165], 300, 'sawtooth', 0.05);
			break;
		case 'drink':
			blip([880, 1175], 120, 'sine', 0.05);
			break;
	}
}
