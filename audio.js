/* =========================================================================
   BioDota: Синтезатор звуковых эффектов Web Audio API
   ========================================================================= */

let isAudioEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!isAudioEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

function playTone(type) {
  if (!isAudioEnabled || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'eat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'divide') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'clash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.05);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'tower_fire') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'die') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.14);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
      osc.start(now); osc.stop(now + 0.14);
    } else if (type === 'victory') {
      const chords = [
        { f: 261.63, t: 0.00, d: 0.75, type: 'sawtooth', vol: 0.05 },
        { f: 329.63, t: 0.08, d: 0.70, type: 'triangle', vol: 0.05 },
        { f: 392.00, t: 0.16, d: 0.80, type: 'sawtooth', vol: 0.06 },
        { f: 523.25, t: 0.28, d: 0.95, type: 'triangle', vol: 0.07 },
        { f: 659.25, t: 0.40, d: 1.10, type: 'triangle', vol: 0.08 },
        { f: 783.99, t: 0.52, d: 1.40, type: 'sawtooth', vol: 0.09 },
        { f: 1046.5, t: 0.65, d: 1.60, type: 'sine',     vol: 0.08 }
      ];
      chords.forEach(c => {
        const chordOsc = audioCtx.createOscillator();
        const chordGain = audioCtx.createGain();
        chordOsc.type = c.type;
        chordOsc.frequency.setValueAtTime(c.f, now + c.t);
        chordOsc.connect(chordGain);
        chordGain.connect(audioCtx.destination);
        chordGain.gain.setValueAtTime(0.001, now + c.t);
        chordGain.gain.exponentialRampToValueAtTime(c.vol, now + c.t + 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, now + c.t + c.d);
        chordOsc.start(now + c.t); chordOsc.stop(now + c.t + c.d);
      });
    }
  } catch (e) {}
}