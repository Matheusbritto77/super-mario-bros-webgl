// web/app.js
// Ponto de entrada do runtime: orquestra CPU Recompilada, PPU WebGL, APU e Controles (Gamepad, Teclado, Mouse)

import { PRG_ROM, CHR_ROM } from "./rom_data.js";
import { NESBus } from "./nes_bus.js";
import { RecompiledSMB } from "./recompiled_smb.js";
import { PPU } from "./ppu.js";
import { WebGLRenderer } from "./webgl_renderer.js";
import { NESAudio } from "./audio.js";

// Inicializa componentes do sistema
const canvas = document.getElementById("gameCanvas");
const renderer = new WebGLRenderer(canvas);
const bus = new NESBus(PRG_ROM, CHR_ROM);
const ppu = new PPU(bus);
const cpu = new RecompiledSMB(bus);
const audio = new NESAudio();

bus.onAudioWrite = (addr, val) => {
  audio.handleRegisterWrite(addr, val);
};

// Ativa áudio no primeiro toque do usuário
let audioUnlocked = false;
function unlockAudio() {
  if (!audioUnlocked) {
    audio.init();
    audio.resume();
    audioUnlocked = true;
  } else {
    audio.resume();
  }
}

// Inicializa o vetor de RESET da ROM ($8000)
cpu.reset();

// Executa a sequência de boot completa do SMB1 (limpeza de memória e espera de VBlanks até 0x8057)
let bootSteps = 0;
while (bootSteps < 30000) {
  if (bootSteps === 100 || bootSteps === 400) {
    bus.ppuStatus |= 0x80;
  }
  cpu.stepInstruction();
  bootSteps++;
  if (cpu.PC === 0x8057) {
    break;
  }
}

// Loop Principal de Execução a 60 FPS (VBlank & NMI)
function gameLoop() {
  // 1. Polling contínuo de controles (Gamepad USB / Bluetooth)
  pollGamepads();

  // 2. Início do VBlank
  bus.ppuStatus |= 0x80;
  bus.ppuStatus &= ~0x40; // Sprite 0 Hit limpo no início do frame

  // Dispara NMI da ROM ($8082)
  cpu.triggerNMI();

  // Executa as instruções do frame da ROM até retornar ao loop principal ($8057 / $805C)
  let stepsThisFrame = 0;
  const MAX_STEPS_PER_FRAME = 60000;

  while (stepsThisFrame < MAX_STEPS_PER_FRAME) {
    // Quando a CPU do Mario chega na espera do Sprite 0 ($8150), ativa a flag
    if (cpu.PC === 0x8150) {
      bus.ppuStatus |= 0x40;
    }

    cpu.stepInstruction();
    stepsThisFrame++;

    // Retorno do NMI para o loop de espera ($8057 / $805C)
    if (cpu.PC === 0x8057 || cpu.PC === 0x805C) {
      break;
    }
  }

  // 3. Renderiza o frame via PPU e envia ao WebGL ocupando a tela
  ppu.renderFrame();
  renderer.render(ppu.frameBuffer);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// =========================================================================
// SISTEMA DE CONTROLES: GAMEPAD, TECLADO E MOUSE
// =========================================================================

// Botões NES: 0:A, 1:B, 2:Select, 3:Start, 4:Up, 5:Down, 6:Left, 7:Right
const KEY_MAP = {
  // Pular (A)
  Space: 0,
  KeyX: 0,
  KeyK: 0,
  ArrowUp: 0,
  KeyW: 0,

  // Correr / Fogo (B)
  KeyZ: 1,
  KeyJ: 1,
  ShiftLeft: 1,
  ShiftRight: 1,

  // Start & Select
  Enter: 3,
  KeyC: 2,
  Tab: 2,
  Backspace: 2,

  // Direcionais
  ArrowDown: 5,
  KeyS: 5,
  ArrowLeft: 6,
  KeyA: 6,
  ArrowRight: 7,
  KeyD: 7,
};

// Teclado
window.addEventListener("keydown", (e) => {
  unlockAudio();

  // Atalho de Tela Cheia (F)
  if (e.code === "KeyF") {
    toggleFullscreen();
    return;
  }

  // Atalho de Mudo (M)
  if (e.code === "KeyM") {
    audio.toggleMute();
    return;
  }

  if (e.code in KEY_MAP) {
    e.preventDefault();
    bus.setButton(KEY_MAP[e.code], true);
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code in KEY_MAP) {
    e.preventDefault();
    bus.setButton(KEY_MAP[e.code], false);
  }
});

// Gamepad USB / Bluetooth
function pollGamepads() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (!gamepads || !gamepads[0]) return;

  const gp = gamepads[0];
  if (gp.buttons.some((b) => b.pressed)) {
    unlockAudio();
  }

  // Padrão Standard Gamepad:
  // 0: A/Cruz (Pular), 1: B/Círculo (Pular), 2: X/Quadrado (Correr), 3: Y/Triângulo (Correr)
  // 8: Select/Back, 9: Start/Options
  // 12: D-Up, 13: D-Down, 14: D-Left, 15: D-Right
  const btnA = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed;
  const btnB = gp.buttons[2]?.pressed || gp.buttons[3]?.pressed;
  const btnSelect = gp.buttons[8]?.pressed;
  const btnStart = gp.buttons[9]?.pressed;
  const dpadUp = gp.buttons[12]?.pressed || gp.axes[1] < -0.4;
  const dpadDown = gp.buttons[13]?.pressed || gp.axes[1] > 0.4;
  const dpadLeft = gp.buttons[14]?.pressed || gp.axes[0] < -0.4;
  const dpadRight = gp.buttons[15]?.pressed || gp.axes[0] > 0.4;

  bus.setButton(0, btnA);
  bus.setButton(1, btnB);
  bus.setButton(2, btnSelect);
  bus.setButton(3, btnStart);
  bus.setButton(4, dpadUp);
  bus.setButton(5, dpadDown);
  bus.setButton(6, dpadLeft);
  bus.setButton(7, dpadRight);
}

// Suporte a Mouse
// Clique Esquerdo = Pular (A)
// Clique Direito = Correr / Fogo (B)
// Pressionar na metade direita = Andar para Direita
// Pressionar na metade esquerda = Andar para Esquerda
let isMouseDown = false;
let mouseXRatio = 0.5;

window.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("mousedown", (e) => {
  unlockAudio();
  isMouseDown = true;
  updateMouseDirection(e);

  if (e.button === 0) {
    bus.setButton(0, true); // Pular (A)
  } else if (e.button === 2) {
    bus.setButton(1, true); // Correr (B)
  }
});

window.addEventListener("mouseup", (e) => {
  isMouseDown = false;
  bus.setButton(6, false); // Solta Esquerda
  bus.setButton(7, false); // Solta Direita

  if (e.button === 0) {
    bus.setButton(0, false);
  } else if (e.button === 2) {
    bus.setButton(1, false);
  }
});

window.addEventListener("mousemove", (e) => {
  if (isMouseDown) {
    updateMouseDirection(e);
  }
});

function updateMouseDirection(e) {
  mouseXRatio = e.clientX / window.innerWidth;
  if (mouseXRatio > 0.58) {
    bus.setButton(7, true);  // Direita
    bus.setButton(6, false);
  } else if (mouseXRatio < 0.42) {
    bus.setButton(6, true);  // Esquerda
    bus.setButton(7, false);
  } else {
    bus.setButton(6, false);
    bus.setButton(7, false);
  }
}

// Duplo clique na tela alterna Fullscreen
canvas.addEventListener("dblclick", () => {
  toggleFullscreen();
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

// Fade out da dica de controles após 4 segundos
const hint = document.getElementById("hintOverlay");
if (hint) {
  setTimeout(() => {
    hint.classList.add("fade");
  }, 4000);
}
