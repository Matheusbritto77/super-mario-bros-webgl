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
  // Se a aba estiver em segundo plano, não processa para não travar nem desincronizar o áudio
  if (document.hidden) {
    requestAnimationFrame(gameLoop);
    return;
  }

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

// Gerenciamento de segundo plano: quando mudar de aba ou minimizar, pausa áudio e retoma sem travar
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (audio.ctx && audio.ctx.state === "running") {
      audio.ctx.suspend();
    }
  } else {
    if (audio.ctx && audio.ctx.state === "suspended" && audioUnlocked) {
      audio.ctx.resume();
    }
  }
});

window.addEventListener("blur", () => {
  if (audio.ctx && audio.ctx.state === "running") {
    audio.ctx.suspend();
  }
});

window.addEventListener("focus", () => {
  if (audio.ctx && audio.ctx.state === "suspended" && audioUnlocked) {
    audio.ctx.resume();
  }
});

// =========================================================================
// SISTEMA DE CONTROLES UNIFICADO: GAMEPAD (JOYSTICK), TECLADO E MOUSE
// =========================================================================

// Camadas independentes de entrada (0:A, 1:B, 2:Select, 3:Start, 4:Up, 5:Down, 6:Left, 7:Right)
const keyboardState = new Uint8Array(8);
const gamepadState  = new Uint8Array(8);
const mouseState    = new Uint8Array(8);

// Sincroniza o estado combinado com o barramento do jogo (OR lógico entre todas as fontes)
function syncJoypad() {
  for (let i = 0; i < 8; i++) {
    const isPressed = Boolean(keyboardState[i] | gamepadState[i] | mouseState[i]);
    bus.setButton(i, isPressed);
  }
}

// -------------------------------------------------------------------------
// 1. TECLADO
// -------------------------------------------------------------------------
function handleKey(e, isDown) {
  unlockAudio();

  // Atalhos do sistema
  if (isDown) {
    if (e.code === "KeyF") {
      toggleFullscreen();
      return;
    }
    if (e.code === "KeyM") {
      audio.toggleMute();
      return;
    }
  }

  let matched = false;
  const code = e.code || "";
  const key = (e.key || "").toLowerCase();

  // START (3) - Enter, NumpadEnter, P, Escape
  if (code === "Enter" || code === "NumpadEnter" || key === "enter" || code === "Escape" || key === "escape" || code === "KeyP" || key === "p") {
    keyboardState[3] = isDown ? 1 : 0;
    matched = true;
  }

  // SELECT (2) - C, Tab, Backspace, ShiftRight
  if (code === "KeyC" || key === "c" || code === "Tab" || key === "tab" || code === "Backspace" || key === "backspace" || code === "ShiftRight") {
    keyboardState[2] = isDown ? 1 : 0;
    matched = true;
  }

  // PULAR / A (0) - Barra de Espaço, X, K
  if (code === "Space" || key === " " || code === "KeyX" || key === "x" || code === "KeyK" || key === "k") {
    keyboardState[0] = isDown ? 1 : 0;
    matched = true;
  }

  // CORRER / FOGO / B (1) - Z, J, Shift, Control
  if (code === "KeyZ" || key === "z" || code === "KeyJ" || key === "j" || code === "ShiftLeft" || key === "shift" || code === "ControlLeft" || code === "ControlRight") {
    keyboardState[1] = isDown ? 1 : 0;
    matched = true;
  }

  // CIMA (4) e PULAR (0) com W / Seta para Cima
  if (code === "ArrowUp" || key === "arrowup" || code === "KeyW" || key === "w") {
    keyboardState[4] = isDown ? 1 : 0;
    keyboardState[0] = isDown ? 1 : 0;
    matched = true;
  }

  // BAIXO (5) - Seta para Baixo, S
  if (code === "ArrowDown" || key === "arrowdown" || code === "KeyS" || key === "s") {
    keyboardState[5] = isDown ? 1 : 0;
    matched = true;
  }

  // ESQUERDA (6) - Seta para Esquerda, A
  if (code === "ArrowLeft" || key === "arrowleft" || code === "KeyA" || key === "a") {
    keyboardState[6] = isDown ? 1 : 0;
    matched = true;
  }

  // DIREITA (7) - Seta para Direita, D
  if (code === "ArrowRight" || key === "arrowright" || code === "KeyD" || key === "d") {
    keyboardState[7] = isDown ? 1 : 0;
    matched = true;
  }

  if (matched) {
    e.preventDefault();
    syncJoypad();
  }
}

window.addEventListener("keydown", (e) => handleKey(e, true), { capture: true });
window.addEventListener("keyup", (e) => handleKey(e, false), { capture: true });

// -------------------------------------------------------------------------
// 2. GAMEPAD / JOYSTICK (USB & BLUETOOTH - SUPORTE UNIVERSAL)
// -------------------------------------------------------------------------
function pollGamepads() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (!gamepads || gamepads.length === 0) return;

  const nextGpState = new Uint8Array(8);

  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (!gp || !gp.connected) continue;

    // Se qualquer botão estiver pressionado, desbloqueia áudio
    if (gp.buttons && gp.buttons.some((b) => b && (b.pressed || b.value > 0.5))) {
      unlockAudio();
    }

    const isBtn = (idx) => {
      if (!gp.buttons || !gp.buttons[idx]) return false;
      return gp.buttons[idx].pressed || gp.buttons[idx].value > 0.5;
    };

    const numBtns = gp.buttons ? gp.buttons.length : 0;
    const isStandardPad = numBtns >= 10;

    // 0: A (Pular) - A/Cruz (0) ou B/Círculo (1)
    const btnA = isBtn(0) || isBtn(1);

    // 1: B (Correr/Fogo) - X/Quadrado (2), Y/Triângulo (3), L1(4), R1(5), L2(6), R2(7)
    const btnB = isBtn(2) || isBtn(3) || isBtn(4) || isBtn(5) || (isStandardPad && (isBtn(6) || isBtn(7)));

    // 2: Select - Botão 8 (Select/Back/Share) ou 6 (controles retro) ou 10
    const btnSelect = isBtn(8) || (!isStandardPad && isBtn(6)) || isBtn(10);

    // 3: Start - Botão 9 (Start/Options/Plus) ou 7 (controles retro) ou 11
    const btnStart = isBtn(9) || (!isStandardPad && isBtn(7)) || isBtn(11);

    // Direcionais D-Pad (botões 12 a 15)
    let dpadUp = isBtn(12);
    let dpadDown = isBtn(13);
    let dpadLeft = isBtn(14);
    let dpadRight = isBtn(15);

    // Analógico Principal (Left Stick / Eixos 0 e 1)
    if (gp.axes && gp.axes.length >= 2) {
      if (gp.axes[0] < -0.35) dpadLeft = true;
      if (gp.axes[0] > 0.35) dpadRight = true;
      if (gp.axes[1] < -0.35) dpadUp = true;
      if (gp.axes[1] > 0.35) dpadDown = true;
    }

    // Eixos Secundários (D-Pad em alguns joysticks retro / Arcade Sticks)
    if (gp.axes && gp.axes.length >= 6) {
      if (gp.axes[4] < -0.35) dpadLeft = true;
      if (gp.axes[4] > 0.35) dpadRight = true;
      if (gp.axes[5] < -0.35) dpadUp = true;
      if (gp.axes[5] > 0.35) dpadDown = true;
    }

    if (btnA) nextGpState[0] = 1;
    if (btnB) nextGpState[1] = 1;
    if (btnSelect) nextGpState[2] = 1;
    if (btnStart) nextGpState[3] = 1;
    if (dpadUp) nextGpState[4] = 1;
    if (dpadDown) nextGpState[5] = 1;
    if (dpadLeft) nextGpState[6] = 1;
    if (dpadRight) nextGpState[7] = 1;
  }

  // Copia o estado e atualiza o barramento
  for (let b = 0; b < 8; b++) {
    gamepadState[b] = nextGpState[b];
  }
  syncJoypad();
}

window.addEventListener("gamepadconnected", (e) => {
  console.log("🎮 Gamepad conectado:", e.gamepad.id, "índice:", e.gamepad.index);
  unlockAudio();
});

window.addEventListener("gamepaddisconnected", () => {
  gamepadState.fill(0);
  syncJoypad();
});

// -------------------------------------------------------------------------
// 3. SUPORTE A MOUSE
// -------------------------------------------------------------------------
let isMouseDown = false;
let mouseXRatio = 0.5;

window.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("mousedown", (e) => {
  unlockAudio();
  canvas.focus();
  isMouseDown = true;
  updateMouseDirection(e);

  if (e.button === 0) {
    mouseState[0] = 1; // Pular (A)
  } else if (e.button === 2) {
    mouseState[1] = 1; // Correr (B)
  }
  syncJoypad();
});

window.addEventListener("mouseup", (e) => {
  isMouseDown = false;
  mouseState[6] = 0;
  mouseState[7] = 0;

  if (e.button === 0) mouseState[0] = 0;
  if (e.button === 2) mouseState[1] = 0;
  syncJoypad();
});

window.addEventListener("mousemove", (e) => {
  if (isMouseDown) {
    updateMouseDirection(e);
  }
});

function updateMouseDirection(e) {
  mouseXRatio = e.clientX / window.innerWidth;
  if (mouseXRatio > 0.58) {
    mouseState[7] = 1;  // Direita
    mouseState[6] = 0;
  } else if (mouseXRatio < 0.42) {
    mouseState[6] = 1;  // Esquerda
    mouseState[7] = 0;
  } else {
    mouseState[6] = 0;
    mouseState[7] = 0;
  }
  syncJoypad();
}

// -------------------------------------------------------------------------
// 4. FOCO, FULLSCREEN E INICIALIZAÇÃO
// -------------------------------------------------------------------------
window.addEventListener("blur", () => {
  keyboardState.fill(0);
  mouseState.fill(0);
  syncJoypad();
  if (audio.ctx && audio.ctx.state === "running") {
    audio.ctx.suspend();
  }
});

window.addEventListener("focus", () => {
  canvas.focus();
  if (audio.ctx && audio.ctx.state === "suspended" && audioUnlocked) {
    audio.ctx.resume();
  }
});

canvas.addEventListener("click", () => {
  unlockAudio();
  canvas.focus();
});

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

// Foco imediato no Canvas ao carregar a página
canvas.focus();

// Fade out da dica de controles após 4 segundos
const hint = document.getElementById("hintOverlay");
if (hint) {
  setTimeout(() => {
    hint.classList.add("fade");
  }, 4000);
}
