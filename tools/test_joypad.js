import { PRG_ROM, CHR_ROM } from "../web/rom_data.js";
import { NESBus } from "../web/nes_bus.js";
import { RecompiledSMB } from "../web/recompiled_smb.js";

const bus = new NESBus(PRG_ROM, CHR_ROM);
const cpu = new RecompiledSMB(bus);

cpu.reset();

// Boot
let bootSteps = 0;
while (bootSteps < 30000) {
  if (bootSteps === 100 || bootSteps === 400) {
    bus.ppuStatus |= 0x80;
  }
  cpu.stepInstruction();
  bootSteps++;
  if (cpu.PC === 0x8057) break;
}

console.log("Boot finished at step", bootSteps, "PC:", cpu.PC.toString(16));

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

// Run 30 frames at title screen
for (let i = 0; i < 30; i++) runFrame();

console.log("Title screen state. GameEngineSubroutine ($0E):", bus.ram[0x0E], "GameState ($0770):", bus.ram[0x770]);

// Press Start (Button 3)
console.log("Pressing START...");
bus.setButton(3, true);

for (let i = 0; i < 60; i++) {
  runFrame();
  if (i % 10 === 0) {
    console.log(`Frame ${i}: Joypad1 reading ($06FC): 0x${bus.ram[0x06FC].toString(16)}, GameState ($0770): ${bus.ram[0x770]}, WorldSelection ($07FD): ${bus.ram[0x7FD]}`);
  }
}

bus.setButton(3, false);

// Run 150 more frames to enter World 1-1
for (let i = 0; i < 150; i++) {
  runFrame();
}

console.log(`After entering game: OperMode ($0770): ${bus.ram[0x770]}, Mario X ($0086): ${bus.ram[0x86]}`);

// Press Right (Button 7)
console.log("Holding RIGHT for 60 frames...");
bus.setButton(7, true);
for (let i = 0; i < 60; i++) {
  runFrame();
}
console.log(`After holding Right: Mario X ($0086): ${bus.ram[0x86]}, Joypad1 ($06FC): 0x${bus.ram[0x06FC].toString(16)}`);
