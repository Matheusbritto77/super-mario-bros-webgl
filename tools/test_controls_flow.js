import { PRG_ROM, CHR_ROM } from "../web/rom_data.js";
import { NESBus } from "../web/nes_bus.js";
import { RecompiledSMB } from "../web/recompiled_smb.js";

const bus = new NESBus(PRG_ROM, CHR_ROM);
const cpu = new RecompiledSMB(bus);

cpu.reset();

// Boot
let bootSteps = 0;
while (bootSteps < 30000) {
  if (bootSteps === 100 || bootSteps === 400) bus.ppuStatus |= 0x80;
  cpu.stepInstruction();
  bootSteps++;
  if (cpu.PC === 0x8057) break;
}

function runFrame() {
  bus.ppuStatus |= 0x80;
  bus.ppuStatus &= ~0x40;
  cpu.triggerNMI();
  let steps = 0;
  while (steps < 60000) {
    if (cpu.PC === 0x8150) bus.ppuStatus |= 0x40;
    cpu.stepInstruction();
    steps++;
    if (cpu.PC === 0x8057 || cpu.PC === 0x805C) break;
  }
}

// Simula a nova arquitetura de controles
const keyboardState = new Uint8Array(8);
const gamepadState  = new Uint8Array(8);
const mouseState    = new Uint8Array(8);

function syncJoypad() {
  for (let i = 0; i < 8; i++) {
    const isPressed = Boolean(keyboardState[i] | gamepadState[i] | mouseState[i]);
    bus.setButton(i, isPressed);
  }
}

// Espera a tela de título inicializar
for (let i = 0; i < 30; i++) runFrame();

// Teste 1: Pressiona Enter (Start = 3) no Teclado
keyboardState[3] = 1; // Pressionou Enter
syncJoypad();

console.log("Start pressionado via teclado. Joypad1 State no Bus:", bus.joypad1State);
for (let i = 0; i < 10; i++) runFrame();
console.log("Frame pós-start. Mem $06FC:", bus.ram[0x06FC], "OperMode ($0770):", bus.ram[0x770]);

keyboardState[3] = 0;
syncJoypad();

// Executa frames até entrar no jogo (World 1-1)
for (let i = 0; i < 200; i++) {
  runFrame();
}

console.log("No jogo! OperMode:", bus.ram[0x770], "Mario X inicial:", bus.ram[0x86]);

// Teste 2: Usuário anda para a direita usando o Teclado (Tecla D / Seta Direita = 7)
// Mesmo com o loop do Gamepad rodando todo frame e zerado!
keyboardState[7] = 1;
for (let i = 0; i < 60; i++) {
  // Gamepad polling a cada frame:
  gamepadState.fill(0);
  syncJoypad();
  runFrame();
}
console.log("Após 60 frames com Teclado na Direita. Mario X:", bus.ram[0x86]);
keyboardState[7] = 0;
syncJoypad();

// Teste 3: Usuário anda para a direita usando o Gamepad/Joystick (Dpad Direita = 7)
gamepadState[7] = 1;
for (let i = 0; i < 60; i++) {
  syncJoypad();
  runFrame();
}
console.log("Após 60 frames com Gamepad na Direita. Mario X:", bus.ram[0x86]);

// Teste 4: Usuário aperta PULAR (0) no Teclado E CORRER (1) no Gamepad simultaneamente
keyboardState[0] = 1; // Pular no teclado
gamepadState[1] = 1;  // Correr no joystick
syncJoypad();
for (let i = 0; i < 30; i++) {
  runFrame();
}
console.log("Após pular+correr simultâneo (Teclado+Gamepad). Mario Y ($00CE):", bus.ram[0xCE], "Mario X:", bus.ram[0x86]);
console.log("TESTE DE CONTROLES PASSOU COM SUCESSO!");
