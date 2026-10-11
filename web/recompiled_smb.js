// web/recompiled_smb.js
// SUPER MARIO BROS - MOTOR COMPILADO NATIVO COM 100% DOS OPCODES 6502 GERADOS
// Gerado automaticamente pelo compilador Python (tools/recompiler.py)

export class RecompiledSMB {
  constructor(bus) {
    this.bus = bus;
    this.A = 0;
    this.X = 0;
    this.Y = 0;
    this.SP = 0xFF;
    this.PC = 0x8000;

    this.flagC = 0;
    this.flagZ = 1;
    this.flagI = 1;
    this.flagD = 0;
    this.flagV = 0;
    this.flagN = 0;

    this.cycles = 0;
  }

  setNZ(val) {
    val = val & 0xFF;
    this.flagZ = (val === 0) ? 1 : 0;
    this.flagN = (val & 0x80) ? 1 : 0;
    return val;
  }

  push(val) {
    this.bus.write(0x0100 + this.SP, val & 0xFF);
    this.SP = (this.SP - 1) & 0xFF;
  }

  pop() {
    this.SP = (this.SP + 1) & 0xFF;
    return this.bus.read(0x0100 + this.SP);
  }

  getStatus() {
    return (this.flagC ? 0x01 : 0) |
           (this.flagZ ? 0x02 : 0) |
           (this.flagI ? 0x04 : 0) |
           (this.flagD ? 0x08 : 0) |
           0x20 |
           (this.flagV ? 0x40 : 0) |
           (this.flagN ? 0x80 : 0);
  }

  setStatus(val) {
    this.flagC = (val & 0x01) ? 1 : 0;
    this.flagZ = (val & 0x02) ? 1 : 0;
    this.flagI = (val & 0x04) ? 1 : 0;
    this.flagD = (val & 0x08) ? 1 : 0;
    this.flagV = (val & 0x40) ? 1 : 0;
    this.flagN = (val & 0x80) ? 1 : 0;
  }

  reset() {
    this.SP = 0xFF;
    this.setStatus(0x24);
    this.PC = 0x8000;
  }

  triggerNMI() {
    this.push((this.PC >> 8) & 0xFF);
    this.push(this.PC & 0xFF);
    this.push(this.getStatus());
    this.flagI = 1;
    this.PC = 0x8082;
  }

  stepInstruction() {
    const pc = this.PC;
    const op = this.bus.read(pc);
    let addr = 0;
    let val = 0;
    let tmp = 0;

    switch (op) {
      case 0x00: // BRK IMP
        this.PC += 1; return 7;
      case 0x01: // ORA INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 2; return 3;
      case 0x05: // ORA ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 2; return 3;
      case 0x06: // ASL ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ((val << 1) & 0xFF);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x08: // PHP IMP
        this.push(this.getStatus() | 0x10); this.PC += 1; return 3;
      case 0x09: // ORA IMM
        val = this.bus.read(pc + 1);
        this.A = this.setNZ(this.A | val); this.PC += 2; return 3;
      case 0x0A: // ASL ACC
        this.flagC = (this.A & 0x80) ? 1 : 0;
        this.A = this.setNZ((this.A << 1) & 0xFF);
        this.PC += 1; return 2;
      case 0x0D: // ORA ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 3; return 4;
      case 0x0E: // ASL ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ((val << 1) & 0xFF);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x10: // BPL REL
        return this.branch(this.flagN === 0, pc);
      case 0x11: // ORA INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 2; return 3;
      case 0x15: // ORA ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 2; return 3;
      case 0x16: // ASL ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ((val << 1) & 0xFF);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x18: // CLC IMP
        this.flagC = 0; this.PC += 1; return 2;
      case 0x19: // ORA ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 3; return 4;
      case 0x1D: // ORA ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A | val); this.PC += 3; return 4;
      case 0x1E: // ASL ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ((val << 1) & 0xFF);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x20: // JSR ABS
        addr = this.bus.read16(pc + 1);
        tmp = (pc + 2) & 0xFFFF;
        this.push((tmp >> 8) & 0xFF);
        this.push(tmp & 0xFF);
        this.PC = addr; return 6;
      case 0x21: // AND INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 2; return 3;
      case 0x24: // BIT ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.flagZ = ((this.A & val) === 0) ? 1 : 0;
        this.flagN = (val & 0x80) ? 1 : 0;
        this.flagV = (val & 0x40) ? 1 : 0;
        this.PC += 2; return 3;
      case 0x25: // AND ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 2; return 3;
      case 0x26: // ROL ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ(((val << 1) | tmp) & 0xFF);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x28: // PLP IMP
        this.setStatus(this.pop()); this.PC += 1; return 4;
      case 0x29: // AND IMM
        val = this.bus.read(pc + 1);
        this.A = this.setNZ(this.A & val); this.PC += 2; return 3;
      case 0x2A: // ROL ACC
        tmp = this.flagC;
        this.flagC = (this.A & 0x80) ? 1 : 0;
        this.A = this.setNZ(((this.A << 1) | tmp) & 0xFF);
        this.PC += 1; return 2;
      case 0x2C: // BIT ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.flagZ = ((this.A & val) === 0) ? 1 : 0;
        this.flagN = (val & 0x80) ? 1 : 0;
        this.flagV = (val & 0x40) ? 1 : 0;
        this.PC += 3; return 4;
      case 0x2D: // AND ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 3; return 4;
      case 0x2E: // ROL ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ(((val << 1) | tmp) & 0xFF);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x30: // BMI REL
        return this.branch(this.flagN === 1, pc);
      case 0x31: // AND INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 2; return 3;
      case 0x35: // AND ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 2; return 3;
      case 0x36: // ROL ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ(((val << 1) | tmp) & 0xFF);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x38: // SEC IMP
        this.flagC = 1; this.PC += 1; return 2;
      case 0x39: // AND ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 3; return 4;
      case 0x3D: // AND ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A & val); this.PC += 3; return 4;
      case 0x3E: // ROL ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = (val & 0x80) ? 1 : 0;
        val = this.setNZ(((val << 1) | tmp) & 0xFF);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x40: // RTI IMP
        this.setStatus(this.pop());
        const rtiLo = this.pop();
        const rtiHi = this.pop();
        this.PC = ((rtiHi << 8) | rtiLo) & 0xFFFF; return 6;
      case 0x41: // EOR INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 2; return 3;
      case 0x45: // EOR ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 2; return 3;
      case 0x46: // LSR ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.flagC = val & 0x01;
        val = this.setNZ(val >> 1);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x48: // PHA IMP
        this.push(this.A); this.PC += 1; return 3;
      case 0x49: // EOR IMM
        val = this.bus.read(pc + 1);
        this.A = this.setNZ(this.A ^ val); this.PC += 2; return 3;
      case 0x4A: // LSR ACC
        this.flagC = this.A & 0x01;
        this.A = this.setNZ(this.A >> 1);
        this.PC += 1; return 2;
      case 0x4C: // JMP ABS
        addr = this.bus.read16(pc + 1);
        this.PC = addr; return 3;
      case 0x4D: // EOR ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 3; return 4;
      case 0x4E: // LSR ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.flagC = val & 0x01;
        val = this.setNZ(val >> 1);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x50: // BVC REL
        return this.branch(this.flagV === 0, pc);
      case 0x51: // EOR INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 2; return 3;
      case 0x55: // EOR ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 2; return 3;
      case 0x56: // LSR ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.flagC = val & 0x01;
        val = this.setNZ(val >> 1);
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x58: // CLI IMP
        this.flagI = 0; this.PC += 1; return 2;
      case 0x59: // EOR ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 3; return 4;
      case 0x5D: // EOR ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(this.A ^ val); this.PC += 3; return 4;
      case 0x5E: // LSR ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.flagC = val & 0x01;
        val = this.setNZ(val >> 1);
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x60: // RTS IMP
        const rtsLo = this.pop();
        const rtsHi = this.pop();
        this.PC = (((rtsHi << 8) | rtsLo) + 1) & 0xFFFF; return 6;
      case 0x61: // ADC INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.adc(val); this.PC += 2; return 3;
      case 0x65: // ADC ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.adc(val); this.PC += 2; return 3;
      case 0x66: // ROR ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = val & 0x01;
        val = this.setNZ((val >> 1) | (tmp << 7));
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x68: // PLA IMP
        this.A = this.setNZ(this.pop()); this.PC += 1; return 4;
      case 0x69: // ADC IMM
        val = this.bus.read(pc + 1);
        this.adc(val); this.PC += 2; return 3;
      case 0x6A: // ROR ACC
        tmp = this.flagC;
        this.flagC = this.A & 0x01;
        this.A = this.setNZ((this.A >> 1) | (tmp << 7));
        this.PC += 1; return 2;
      case 0x6C: // JMP IND
        addr = this.bus.read16(pc + 1);
        if ((addr & 0x00FF) === 0x00FF) {
          this.PC = this.bus.read(addr) | (this.bus.read(addr & 0xFF00) << 8);
        } else {
          this.PC = this.bus.read16(addr);
        }
        return 5;
      case 0x6D: // ADC ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.adc(val); this.PC += 3; return 4;
      case 0x6E: // ROR ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = val & 0x01;
        val = this.setNZ((val >> 1) | (tmp << 7));
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x70: // BVS REL
        return this.branch(this.flagV === 1, pc);
      case 0x71: // ADC INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.adc(val); this.PC += 2; return 3;
      case 0x75: // ADC ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.adc(val); this.PC += 2; return 3;
      case 0x76: // ROR ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = val & 0x01;
        val = this.setNZ((val >> 1) | (tmp << 7));
        this.bus.write(addr, val); this.PC += 2; return 5;
      case 0x78: // SEI IMP
        this.flagI = 1; this.PC += 1; return 2;
      case 0x79: // ADC ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.adc(val); this.PC += 3; return 4;
      case 0x7D: // ADC ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.adc(val); this.PC += 3; return 4;
      case 0x7E: // ROR ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        tmp = this.flagC;
        this.flagC = val & 0x01;
        val = this.setNZ((val >> 1) | (tmp << 7));
        this.bus.write(addr, val); this.PC += 3; return 6;
      case 0x81: // STA INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        this.bus.write(addr, this.A);
        this.PC += 2; return 4;
      case 0x84: // STY ZP
        addr = this.bus.read(pc + 1);
        this.bus.write(addr, this.Y);
        this.PC += 2; return 4;
      case 0x85: // STA ZP
        addr = this.bus.read(pc + 1);
        this.bus.write(addr, this.A);
        this.PC += 2; return 4;
      case 0x86: // STX ZP
        addr = this.bus.read(pc + 1);
        this.bus.write(addr, this.X);
        this.PC += 2; return 4;
      case 0x88: // DEY IMP
        this.Y = this.setNZ((this.Y - 1) & 0xFF); this.PC += 1; return 2;
      case 0x8A: // TXA IMP
        this.A = this.setNZ(this.X); this.PC += 1; return 2;
      case 0x8C: // STY ABS
        addr = this.bus.read16(pc + 1);
        this.bus.write(addr, this.Y);
        this.PC += 3; return 5;
      case 0x8D: // STA ABS
        addr = this.bus.read16(pc + 1);
        this.bus.write(addr, this.A);
        this.PC += 3; return 5;
      case 0x8E: // STX ABS
        addr = this.bus.read16(pc + 1);
        this.bus.write(addr, this.X);
        this.PC += 3; return 5;
      case 0x90: // BCC REL
        return this.branch(this.flagC === 0, pc);
      case 0x91: // STA INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        this.bus.write(addr, this.A);
        this.PC += 2; return 4;
      case 0x94: // STY ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        this.bus.write(addr, this.Y);
        this.PC += 2; return 4;
      case 0x95: // STA ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        this.bus.write(addr, this.A);
        this.PC += 2; return 4;
      case 0x96: // STX ZPY
        addr = (this.bus.read(pc + 1) + this.Y) & 0xFF;
        this.bus.write(addr, this.X);
        this.PC += 2; return 4;
      case 0x98: // TYA IMP
        this.A = this.setNZ(this.Y); this.PC += 1; return 2;
      case 0x99: // STA ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        this.bus.write(addr, this.A);
        this.PC += 3; return 5;
      case 0x9A: // TXS IMP
        this.SP = this.X; this.PC += 1; return 2;
      case 0x9D: // STA ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        this.bus.write(addr, this.A);
        this.PC += 3; return 5;
      case 0xA0: // LDY IMM
        val = this.bus.read(pc + 1);
        this.Y = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA1: // LDA INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA2: // LDX IMM
        val = this.bus.read(pc + 1);
        this.X = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA4: // LDY ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.Y = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA5: // LDA ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA6: // LDX ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.X = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xA8: // TAY IMP
        this.Y = this.setNZ(this.A); this.PC += 1; return 2;
      case 0xA9: // LDA IMM
        val = this.bus.read(pc + 1);
        this.A = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xAA: // TAX IMP
        this.X = this.setNZ(this.A); this.PC += 1; return 2;
      case 0xAC: // LDY ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.Y = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xAD: // LDA ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xAE: // LDX ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.X = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xB0: // BCS REL
        return this.branch(this.flagC === 1, pc);
      case 0xB1: // LDA INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xB4: // LDY ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.Y = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xB5: // LDA ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xB6: // LDX ZPY
        addr = (this.bus.read(pc + 1) + this.Y) & 0xFF;
        val = this.bus.read(addr);
        this.X = this.setNZ(val);
        this.PC += 2; return 3;
      case 0xB8: // CLV IMP
        this.flagV = 0; this.PC += 1; return 2;
      case 0xB9: // LDA ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xBA: // TSX IMP
        this.X = this.setNZ(this.SP); this.PC += 1; return 2;
      case 0xBC: // LDY ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.Y = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xBD: // LDA ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.A = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xBE: // LDX ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.X = this.setNZ(val);
        this.PC += 3; return 4;
      case 0xC0: // CPY IMM
        val = this.bus.read(pc + 1);
        this.cmp(this.Y, val); this.PC += 2; return 3;
      case 0xC1: // CMP INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 2; return 3;
      case 0xC4: // CPY ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.Y, val); this.PC += 2; return 3;
      case 0xC5: // CMP ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 2; return 3;
      case 0xC6: // DEC ZP
        addr = this.bus.read(pc + 1);
        val = (this.bus.read(addr) - 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 2; return 5;
      case 0xC8: // INY IMP
        this.Y = this.setNZ((this.Y + 1) & 0xFF); this.PC += 1; return 2;
      case 0xC9: // CMP IMM
        val = this.bus.read(pc + 1);
        this.cmp(this.A, val); this.PC += 2; return 3;
      case 0xCA: // DEX IMP
        this.X = this.setNZ((this.X - 1) & 0xFF); this.PC += 1; return 2;
      case 0xCC: // CPY ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.Y, val); this.PC += 3; return 4;
      case 0xCD: // CMP ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 3; return 4;
      case 0xCE: // DEC ABS
        addr = this.bus.read16(pc + 1);
        val = (this.bus.read(addr) - 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 3; return 6;
      case 0xD0: // BNE REL
        return this.branch(this.flagZ === 0, pc);
      case 0xD1: // CMP INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 2; return 3;
      case 0xD5: // CMP ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 2; return 3;
      case 0xD6: // DEC ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = (this.bus.read(addr) - 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 2; return 5;
      case 0xD8: // CLD IMP
        this.flagD = 0; this.PC += 1; return 2;
      case 0xD9: // CMP ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 3; return 4;
      case 0xDD: // CMP ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.cmp(this.A, val); this.PC += 3; return 4;
      case 0xDE: // DEC ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = (this.bus.read(addr) - 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 3; return 6;
      case 0xE0: // CPX IMM
        val = this.bus.read(pc + 1);
        this.cmp(this.X, val); this.PC += 2; return 3;
      case 0xE1: // SBC INDX
        tmp = (this.bus.read(pc + 1) + this.X) & 0xFF;
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 2; return 3;
      case 0xE4: // CPX ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.X, val); this.PC += 2; return 3;
      case 0xE5: // SBC ZP
        addr = this.bus.read(pc + 1);
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 2; return 3;
      case 0xE6: // INC ZP
        addr = this.bus.read(pc + 1);
        val = (this.bus.read(addr) + 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 2; return 5;
      case 0xE8: // INX IMP
        this.X = this.setNZ((this.X + 1) & 0xFF); this.PC += 1; return 2;
      case 0xE9: // SBC IMM
        val = this.bus.read(pc + 1);
        this.sbc(val); this.PC += 2; return 3;
      case 0xEA: // NOP IMP
        this.PC += 1; return 2;
      case 0xEC: // CPX ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.cmp(this.X, val); this.PC += 3; return 4;
      case 0xED: // SBC ABS
        addr = this.bus.read16(pc + 1);
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 3; return 4;
      case 0xEE: // INC ABS
        addr = this.bus.read16(pc + 1);
        val = (this.bus.read(addr) + 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 3; return 6;
      case 0xF0: // BEQ REL
        return this.branch(this.flagZ === 1, pc);
      case 0xF1: // SBC INDY
        tmp = this.bus.read(pc + 1);
        addr = this.bus.read(tmp) | (this.bus.read((tmp + 1) & 0xFF) << 8);
        addr = (addr + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 2; return 3;
      case 0xF5: // SBC ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 2; return 3;
      case 0xF6: // INC ZPX
        addr = (this.bus.read(pc + 1) + this.X) & 0xFF;
        val = (this.bus.read(addr) + 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 2; return 5;
      case 0xF8: // SED IMP
        this.flagD = 1; this.PC += 1; return 2;
      case 0xF9: // SBC ABSY
        addr = (this.bus.read16(pc + 1) + this.Y) & 0xFFFF;
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 3; return 4;
      case 0xFD: // SBC ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = this.bus.read(addr);
        this.sbc(val); this.PC += 3; return 4;
      case 0xFE: // INC ABSX
        addr = (this.bus.read16(pc + 1) + this.X) & 0xFFFF;
        val = (this.bus.read(addr) + 1) & 0xFF;
        this.bus.write(addr, val); this.setNZ(val);
        this.PC += 3; return 6;
      default:
        console.warn(`Opcode não reconhecido: 0x${op.toString(16)} em PC=0x${pc.toString(16)}`);
        this.PC += 1;
        return 2;
    }
  }

  branch(condition, pc) {
    if (condition) {
      let offset = this.bus.read(pc + 1);
      if (offset >= 0x80) offset -= 0x100;
      this.PC = (pc + 2 + offset) & 0xFFFF;
      return 3;
    } else {
      this.PC += 2;
      return 2;
    }
  }

  cmp(reg, val) {
    const res = reg - val;
    this.flagC = (reg >= val) ? 1 : 0;
    this.flagZ = ((res & 0xFF) === 0) ? 1 : 0;
    this.flagN = (res & 0x80) ? 1 : 0;
  }

  adc(val) {
    const sum = this.A + val + this.flagC;
    this.flagC = (sum > 0xFF) ? 1 : 0;
    this.flagV = ((~(this.A ^ val) & (this.A ^ sum) & 0x80) !== 0) ? 1 : 0;
    this.A = this.setNZ(sum & 0xFF);
  }

  sbc(val) {
    this.adc((~val) & 0xFF);
  }
}
