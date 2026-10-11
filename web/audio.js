// web/audio.js
// Sintetizador Web Audio API fiel para a APU 2A03 do NES (Super Mario Bros)
// Emula: Pulse 1 (Melodia), Pulse 2 (Harmonia/SFX), Triangle (Baixo) e Noise (Percussão/Impactos/Morte)

export class NESAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;

    // Estado do Canal Pulse 1 (Square 1)
    this.p1 = {
      osc: null,
      gain: null,
      timerLo: 0,
      timerHi: 0,
      volume: 0,
      decay: true,
      enabled: false,
    };

    // Estado do Canal Pulse 2 (Square 2)
    this.p2 = {
      osc: null,
      gain: null,
      timerLo: 0,
      timerHi: 0,
      volume: 0,
      decay: true,
      enabled: false,
    };

    // Estado do Canal Triangle (Bass)
    this.tri = {
      osc: null,
      gain: null,
      timerLo: 0,
      timerHi: 0,
      linearCounter: 0,
      enabled: false,
    };

    // Estado do Canal Noise (Ruído / Bateria / SFX)
    this.noise = {
      source: null,
      gain: null,
      filter: null,
      volume: 0,
      enabled: false,
    };

    // Tabela oficial de períodos do canal Noise do NES NTSC
    this.noisePeriods = [
      4, 8, 16, 32, 64, 96, 128, 160,
      202, 254, 380, 508, 762, 1016, 2034, 4068
    ];
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;

    // 1. Canal Pulse 1
    this.p1.osc = this.ctx.createOscillator();
    this.p1.osc.type = "square";
    this.p1.gain = this.ctx.createGain();
    this.p1.gain.gain.setValueAtTime(0, now);
    this.p1.osc.connect(this.p1.gain);
    this.p1.gain.connect(this.masterGain);
    this.p1.osc.start();

    // 2. Canal Pulse 2
    this.p2.osc = this.ctx.createOscillator();
    this.p2.osc.type = "square";
    this.p2.gain = this.ctx.createGain();
    this.p2.gain.gain.setValueAtTime(0, now);
    this.p2.osc.connect(this.p2.gain);
    this.p2.gain.connect(this.masterGain);
    this.p2.osc.start();

    // 3. Canal Triangle
    this.tri.osc = this.ctx.createOscillator();
    this.tri.osc.type = "triangle";
    this.tri.gain = this.ctx.createGain();
    this.tri.gain.gain.setValueAtTime(0, now);
    this.tri.osc.connect(this.tri.gain);
    this.tri.gain.connect(this.masterGain);
    this.tri.osc.start();

    // 4. Canal Noise (Buffer de ruído pseudo-aleatório NES com filtro passa-faixa)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.noise.source = this.ctx.createBufferSource();
    this.noise.source.buffer = noiseBuffer;
    this.noise.source.loop = true;

    this.noise.filter = this.ctx.createBiquadFilter();
    this.noise.filter.type = "bandpass";
    this.noise.filter.frequency.setValueAtTime(1000, now);

    this.noise.gain = this.ctx.createGain();
    this.noise.gain.gain.setValueAtTime(0, now);

    this.noise.source.connect(this.noise.filter);
    this.noise.filter.connect(this.noise.gain);
    this.noise.gain.connect(this.masterGain);
    this.noise.source.start();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Intercepta e processa escritas de hardware nos registradores da APU ($4000 - $4015)
  handleRegisterWrite(addr, val) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const CPU_CLOCK = 1789773;

    switch (addr) {
      // --- CANAL PULSE 1 ---
      case 0x4000: {
        this.p1.volume = (val & 0x0F) / 15.0;
        this.p1.decay = (val & 0x10) === 0;
        this.updatePulse1Gain();
        break;
      }
      case 0x4002: {
        this.p1.timerLo = val;
        this.updatePulse1Freq();
        break;
      }
      case 0x4003: {
        this.p1.timerHi = val & 0x07;
        this.updatePulse1Freq();
        this.updatePulse1Gain();
        break;
      }

      // --- CANAL PULSE 2 ---
      case 0x4004: {
        this.p2.volume = (val & 0x0F) / 15.0;
        this.p2.decay = (val & 0x10) === 0;
        this.updatePulse2Gain();
        break;
      }
      case 0x4006: {
        this.p2.timerLo = val;
        this.updatePulse2Freq();
        break;
      }
      case 0x4007: {
        this.p2.timerHi = val & 0x07;
        this.updatePulse2Freq();
        this.updatePulse2Gain();
        break;
      }

      // --- CANAL TRIANGLE (Baixo / Linha de Bass) ---
      case 0x4008: {
        this.tri.linearCounter = val & 0x7F;
        this.updateTriangleGain();
        break;
      }
      case 0x400A: {
        this.tri.timerLo = val;
        this.updateTriangleFreq();
        break;
      }
      case 0x400B: {
        this.tri.timerHi = val & 0x07;
        this.updateTriangleFreq();
        this.updateTriangleGain();
        break;
      }

      // --- CANAL NOISE (Percussão / Pulos / Blocos) ---
      case 0x400C: {
        this.noise.volume = (val & 0x0F) / 15.0;
        this.updateNoiseGain();
        break;
      }
      case 0x400E: {
        const periodIdx = val & 0x0F;
        const period = this.noisePeriods[periodIdx] || 16;
        const cutoff = Math.min(CPU_CLOCK / period, 16000);
        this.noise.filter.frequency.setTargetAtTime(cutoff, now, 0.005);
        break;
      }

      // --- REGISTRADOR DE HABILITAÇÃO DOS CANAIS ($4015) ---
      case 0x4015: {
        this.p1.enabled = (val & 0x01) !== 0;
        this.p2.enabled = (val & 0x02) !== 0;
        this.tri.enabled = (val & 0x04) !== 0;
        this.noise.enabled = (val & 0x08) !== 0;

        this.updatePulse1Gain();
        this.updatePulse2Gain();
        this.updateTriangleGain();
        this.updateNoiseGain();
        break;
      }
    }
  }

  updatePulse1Freq() {
    const period = this.p1.timerLo | (this.p1.timerHi << 8);
    if (period >= 8) {
      const freq = 1789773 / (16 * (period + 1));
      this.p1.osc.frequency.setTargetAtTime(Math.min(freq, 4000), this.ctx.currentTime, 0.004);
    }
  }

  updatePulse1Gain() {
    const period = this.p1.timerLo | (this.p1.timerHi << 8);
    const target = (this.p1.enabled && period >= 8 && this.p1.volume > 0) ? (this.p1.volume * 0.14) : 0;
    this.p1.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.006);
  }

  updatePulse2Freq() {
    const period = this.p2.timerLo | (this.p2.timerHi << 8);
    if (period >= 8) {
      const freq = 1789773 / (16 * (period + 1));
      this.p2.osc.frequency.setTargetAtTime(Math.min(freq, 4000), this.ctx.currentTime, 0.004);
    }
  }

  updatePulse2Gain() {
    const period = this.p2.timerLo | (this.p2.timerHi << 8);
    const target = (this.p2.enabled && period >= 8 && this.p2.volume > 0) ? (this.p2.volume * 0.14) : 0;
    this.p2.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.006);
  }

  updateTriangleFreq() {
    const period = this.tri.timerLo | (this.tri.timerHi << 8);
    if (period >= 4) {
      const freq = 1789773 / (32 * (period + 1));
      this.tri.osc.frequency.setTargetAtTime(Math.min(freq, 3000), this.ctx.currentTime, 0.004);
    }
  }

  updateTriangleGain() {
    const period = this.tri.timerLo | (this.tri.timerHi << 8);
    const target = (this.tri.enabled && period >= 4 && this.tri.linearCounter > 0) ? 0.18 : 0;
    this.tri.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.006);
  }

  updateNoiseGain() {
    const target = (this.noise.enabled && this.noise.volume > 0) ? (this.noise.volume * 0.10) : 0;
    this.noise.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.006);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.22, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}
