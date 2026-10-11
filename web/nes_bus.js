// web/nes_bus.js
// Barramento de memória (Memory Bus) do NES para o runtime de Super Mario Bros

export class NESBus {
  constructor(prgRom, chrRom) {
    this.ram = new Uint8Array(0x0800); // 2KB RAM interna
    this.prgRom = prgRom; // 32KB PRG-ROM
    this.chrRom = chrRom; // 8KB CHR-ROM

    // Registradores e estados da PPU
    this.ppuCtrl = 0;
    this.ppuMask = 0;
    this.ppuStatus = 0;
    this.oamAddr = 0;
    this.oam = new Uint8Array(256); // 64 sprites * 4 bytes
    this.scrollX = 0;
    this.scrollY = 0;
    this.scrollLatch = 0;
    this.ppuAddr = 0;
    this.ppuAddrLatch = 0;
    this.ppuDataBuffer = 0;

    // VRAM da PPU (2KB Nametables + 32 bytes Palettes)
    this.vram = new Uint8Array(0x1000); // 4KB para nametables espelhadas
    this.paletteRam = new Uint8Array([
      0x22, 0x29, 0x1A, 0x0F,  0x22, 0x36, 0x17, 0x0F,  0x22, 0x30, 0x21, 0x0F,  0x22, 0x27, 0x17, 0x0F,
      0x22, 0x16, 0x27, 0x18,  0x22, 0x1A, 0x30, 0x27,  0x22, 0x16, 0x30, 0x27,  0x22, 0x0F, 0x36, 0x17
    ]);

    // Estado do Controle 1 (Joypad)
    // Bits: [A, B, Select, Start, Up, Down, Left, Right]
    this.joypad1State = 0;
    this.joypad1Shift = 0;
    this.joypadStrobe = 0;

    // APU registers
    this.apuRegisters = new Uint8Array(0x20);
    this.onAudioWrite = null;

    // VBlank flag
    this.vblank = false;
  }

  // Leitura de 8 bits otimizada (Fast Path para PRG-ROM e RAM)
  read(addr) {
    addr = addr & 0xFFFF;

    // 1. Fast Path: PRG-ROM ($8000 - $FFFF) - Maioria esmagadora dos acessos da CPU
    if (addr >= 0x8000) {
      return this.prgRom[addr - 0x8000];
    }

    // 2. Fast Path: RAM interna ($0000 - $07FF, espelhada até $1FFF)
    if (addr < 0x2000) {
      return this.ram[addr & 0x07FF];
    }

    // 3. Registradores da PPU ($2000 - $2007, espelhados até $3FFF)
    if (addr < 0x4000) {
      const reg = 0x2000 + (addr & 7);
      switch (reg) {
        case 0x2002: { // PPUSTATUS
          const status = this.ppuStatus;
          this.ppuStatus &= ~0x80;
          this.ppuAddrLatch = 0;
          this.scrollLatch = 0;
          return status;
        }
        case 0x2004: // OAMDATA
          return this.oam[this.oamAddr];
        case 0x2007: { // PPUDATA
          let val = this.readPPU(this.ppuAddr);
          if ((this.ppuAddr & 0x3FFF) < 0x3F00) {
            const buffered = this.ppuDataBuffer;
            this.ppuDataBuffer = val;
            val = buffered;
          } else {
            this.ppuDataBuffer = this.readPPU(this.ppuAddr - 0x1000);
          }
          this.ppuAddr = (this.ppuAddr + ((this.ppuCtrl & 0x04) ? 32 : 1)) & 0x3FFF;
          return val;
        }
        default:
          return 0;
      }
    }

    // 4. APU e I/O ($4000 - $401F)
    if (addr < 0x4020) {
      if (addr === 0x4016) {
        if (this.joypadStrobe === 1) {
          return (this.joypad1State & 0x01) ? 1 : 0;
        }
        const bit = (this.joypad1Shift & 0x01) ? 1 : 0;
        this.joypad1Shift = (this.joypad1Shift >> 1) | 0x80;
        return bit;
      }
      if (addr === 0x4015) {
        return this.apuRegisters[0x15];
      }
      return 0;
    }

    return 0;
  }

  // Leitura de 16 bits otimizada (evita duas chamadas virtuais de read)
  read16(addr) {
    addr = addr & 0xFFFF;
    if (addr >= 0x8000 && addr < 0xFFFF) {
      const offset = addr - 0x8000;
      return this.prgRom[offset] | (this.prgRom[offset + 1] << 8);
    }
    if (addr < 0x07FE) {
      return this.ram[addr] | (this.ram[addr + 1] << 8);
    }
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  // Escrita de 8 bits
  write(addr, val) {
    addr = addr & 0xFFFF;
    val = val & 0xFF;

    // 1. RAM interna ($0000 - $07FF, espelhada até $1FFF)
    if (addr < 0x2000) {
      this.ram[addr & 0x07FF] = val;
      return;
    }

    // 2. Registradores da PPU ($2000 - $2007, espelhados até $3FFF)
    if (addr < 0x4000) {
      const reg = 0x2000 + (addr & 7);
      switch (reg) {
        case 0x2000: // PPUCTRL
          this.ppuCtrl = val;
          break;
        case 0x2001: // PPUMASK
          this.ppuMask = val;
          break;
        case 0x2003: // OAMADDR
          this.oamAddr = val;
          break;
        case 0x2004: // OAMDATA
          this.oam[this.oamAddr] = val;
          this.oamAddr = (this.oamAddr + 1) & 0xFF;
          break;
        case 0x2005: // PPUSCROLL
          if (this.scrollLatch === 0) {
            this.scrollX = val;
            this.scrollLatch = 1;
          } else {
            this.scrollY = val;
            this.scrollLatch = 0;
          }
          break;
        case 0x2006: // PPUADDR
          if (this.ppuAddrLatch === 0) {
            this.ppuAddr = (this.ppuAddr & 0x00FF) | ((val & 0x3F) << 8);
            this.ppuAddrLatch = 1;
          } else {
            this.ppuAddr = (this.ppuAddr & 0xFF00) | val;
            this.ppuAddrLatch = 0;
          }
          break;
        case 0x2007: // PPUDATA
          this.writePPU(this.ppuAddr, val);
          this.ppuAddr = (this.ppuAddr + ((this.ppuCtrl & 0x04) ? 32 : 1)) & 0x3FFF;
          break;
      }
      return;
    }

    // 3. APU e I/O ($4000 - $401F)
    if (addr < 0x4020) {
      if (addr === 0x4014) {
        // OAM DMA: copia 256 bytes da CPU RAM para a OAM
        const base = val << 8;
        for (let i = 0; i < 256; i++) {
          this.oam[i] = this.read(base + i);
        }
        return;
      }

      if (addr === 0x4016) {
        // Strobe do Joypad
        if (this.joypadStrobe === 1 && (val & 1) === 0) {
          this.joypad1Shift = this.joypad1State;
        }
        this.joypadStrobe = val & 1;
        return;
      }

      // Registradores de Áudio APU
      if (addr >= 0x4000 && addr <= 0x4017) {
        this.apuRegisters[addr - 0x4000] = val;
        if (this.onAudioWrite) {
          this.onAudioWrite(addr, val);
        }
        return;
      }
    }
  }

  // Leitura da VRAM da PPU
  readPPU(addr) {
    addr = addr & 0x3FFF;
    if (addr < 0x2000) {
      return this.chrRom ? this.chrRom[addr] : 0;
    }
    if (addr < 0x3F00) {
      // Nametables espelhadas verticalmente (SMB1 usa Vertical Mirroring)
      return this.vram[addr & 0x07FF];
    }
    // Paletas ($3F00 - $3F1F)
    return this.paletteRam[addr & 0x1F];
  }

  // Escrita na VRAM da PPU
  writePPU(addr, val) {
    addr = addr & 0x3FFF;
    if (addr < 0x2000) {
      // Geralmente CHR-ROM é read-only no Mario
      return;
    }
    if (addr < 0x3F00) {
      this.vram[addr & 0x07FF] = val;
      return;
    }
    // Paletas
    let pAddr = addr & 0x1F;
    if (pAddr === 0x10) pAddr = 0x00;
    if (pAddr === 0x14) pAddr = 0x04;
    if (pAddr === 0x18) pAddr = 0x08;
    if (pAddr === 0x1C) pAddr = 0x0C;
    this.paletteRam[pAddr] = val & 0x3F;
  }

  // Atualiza estado dos botões do Joypad 1 (0: A, 1: B, 2: Select, 3: Start, 4: Up, 5: Down, 6: Left, 7: Right)
  setButton(button, pressed) {
    const bit = 1 << button;
    if (pressed) {
      this.joypad1State |= bit;
    } else {
      this.joypad1State &= ~bit;
    }
  }
}
