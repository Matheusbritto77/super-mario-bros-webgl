#!/usr/bin/env python3
"""
tools/disassembler.py
Desmontador de 6502 com suporte à arquitetura e registradores de hardware do NES.
Identifica labels, branches, rotinas (JSR) e registradores PPU/APU.
"""

import os
import sys

# Tabela de opcodes do MOS 6502
# formato: (mnemônico, modo_de_endereçamento, tamanho_em_bytes)
ADDR_IMPLIED = "IMP"
ADDR_ACC = "ACC"
ADDR_IMM = "IMM"
ADDR_ZP = "ZP"
ADDR_ZPX = "ZPX"
ADDR_ZPY = "ZPY"
ADDR_ABS = "ABS"
ADDR_ABSX = "ABSX"
ADDR_ABSY = "ABSY"
ADDR_IND = "IND"
ADDR_INDX = "INDX"
ADDR_INDY = "INDY"
ADDR_REL = "REL"

OPCODES = {
    0x00: ("BRK", ADDR_IMPLIED, 1), 0x01: ("ORA", ADDR_INDX, 2),    0x05: ("ORA", ADDR_ZP, 2),      0x06: ("ASL", ADDR_ZP, 2),
    0x08: ("PHP", ADDR_IMPLIED, 1), 0x09: ("ORA", ADDR_IMM, 2),     0x0A: ("ASL", ADDR_ACC, 1),     0x0D: ("ORA", ADDR_ABS, 3),
    0x0E: ("ASL", ADDR_ABS, 3),     0x10: ("BPL", ADDR_REL, 2),     0x11: ("ORA", ADDR_INDY, 2),    0x15: ("ORA", ADDR_ZPX, 2),
    0x16: ("ASL", ADDR_ZPX, 2),     0x18: ("CLC", ADDR_IMPLIED, 1), 0x19: ("ORA", ADDR_ABSY, 3),    0x1D: ("ORA", ADDR_ABSX, 3),
    0x1E: ("ASL", ADDR_ABSX, 3),    0x20: ("JSR", ADDR_ABS, 3),     0x21: ("AND", ADDR_INDX, 2),    0x24: ("BIT", ADDR_ZP, 2),
    0x25: ("AND", ADDR_ZP, 2),      0x26: ("ROL", ADDR_ZP, 2),      0x28: ("PLP", ADDR_IMPLIED, 1), 0x29: ("AND", ADDR_IMM, 2),
    0x2A: ("ROL", ADDR_ACC, 1),     0x2C: ("BIT", ADDR_ABS, 3),     0x2D: ("AND", ADDR_ABS, 3),     0x2E: ("ROL", ADDR_ABS, 3),
    0x30: ("BMI", ADDR_REL, 2),     0x31: ("AND", ADDR_INDY, 2),    0x35: ("AND", ADDR_ZPX, 2),     0x36: ("ROL", ADDR_ZPX, 2),
    0x38: ("SEC", ADDR_IMPLIED, 1), 0x39: ("AND", ADDR_ABSY, 3),    0x3D: ("AND", ADDR_ABSX, 3),    0x3E: ("ROL", ADDR_ABSX, 3),
    0x40: ("RTI", ADDR_IMPLIED, 1), 0x41: ("EOR", ADDR_INDX, 2),    0x45: ("EOR", ADDR_ZP, 2),      0x46: ("LSR", ADDR_ZP, 2),
    0x48: ("PHA", ADDR_IMPLIED, 1), 0x49: ("EOR", ADDR_IMM, 2),     0x4A: ("LSR", ADDR_ACC, 1),     0x4C: ("JMP", ADDR_ABS, 3),
    0x4D: ("EOR", ADDR_ABS, 3),     0x4E: ("LSR", ADDR_ABS, 3),     0x50: ("BVC", ADDR_REL, 2),     0x51: ("EOR", ADDR_INDY, 2),
    0x55: ("EOR", ADDR_ZPX, 2),     0x56: ("LSR", ADDR_ZPX, 2),     0x58: ("CLI", ADDR_IMPLIED, 1), 0x59: ("EOR", ADDR_ABSY, 3),
    0x5D: ("EOR", ADDR_ABSX, 3),    0x5E: ("LSR", ADDR_ABSX, 3),    0x60: ("RTS", ADDR_IMPLIED, 1), 0x61: ("ADC", ADDR_INDX, 2),
    0x65: ("ADC", ADDR_ZP, 2),      0x66: ("ROR", ADDR_ZP, 2),      0x68: ("PLA", ADDR_IMPLIED, 1), 0x69: ("ADC", ADDR_IMM, 2),
    0x6A: ("ROR", ADDR_ACC, 1),     0x6C: ("JMP", ADDR_IND, 3),     0x6D: ("ADC", ADDR_ABS, 3),     0x6E: ("ROR", ADDR_ABS, 3),
    0x70: ("BVS", ADDR_REL, 2),     0x71: ("ADC", ADDR_INDY, 2),    0x75: ("ADC", ADDR_ZPX, 2),     0x76: ("ROR", ADDR_ZPX, 2),
    0x78: ("SEI", ADDR_IMPLIED, 1), 0x79: ("ADC", ADDR_ABSY, 3),    0x7D: ("ADC", ADDR_ABSX, 3),    0x7E: ("ROR", ADDR_ABSX, 3),
    0x81: ("STA", ADDR_INDX, 2),    0x84: ("STY", ADDR_ZP, 2),      0x85: ("STA", ADDR_ZP, 2),      0x86: ("STX", ADDR_ZP, 2),
    0x88: ("DEY", ADDR_IMPLIED, 1), 0x8A: ("TXA", ADDR_IMPLIED, 1), 0x8C: ("STY", ADDR_ABS, 3),    0x8D: ("STA", ADDR_ABS, 3),
    0x8E: ("STX", ADDR_ABS, 3),     0x90: ("BCC", ADDR_REL, 2),     0x91: ("STA", ADDR_INDY, 2),    0x94: ("STY", ADDR_ZPX, 2),
    0x95: ("STA", ADDR_ZPX, 2),     0x96: ("STX", ADDR_ZPY, 2),     0x98: ("TYA", ADDR_IMPLIED, 1), 0x99: ("STA", ADDR_ABSY, 3),
    0x9A: ("TXS", ADDR_IMPLIED, 1), 0x9D: ("STA", ADDR_ABSX, 3),    0xA0: ("LDY", ADDR_IMM, 2),     0xA1: ("LDA", ADDR_INDX, 2),
    0xA2: ("LDX", ADDR_IMM, 2),     0xA4: ("LDY", ADDR_ZP, 2),      0xA5: ("LDA", ADDR_ZP, 2),      0xA6: ("LDX", ADDR_ZP, 2),
    0xA8: ("TAY", ADDR_IMPLIED, 1), 0xA9: ("LDA", ADDR_IMM, 2),     0xAA: ("TAX", ADDR_IMPLIED, 1), 0xAC: ("LDY", ADDR_ABS, 3),
    0xAD: ("LDA", ADDR_ABS, 3),     0xAE: ("LDX", ADDR_ABS, 3),     0xB0: ("BCS", ADDR_REL, 2),     0xB1: ("LDA", ADDR_INDY, 2),
    0xB4: ("LDY", ADDR_ZPX, 2),     0xB5: ("LDA", ADDR_ZPX, 2),     0xB6: ("LDX", ADDR_ZPY, 2),     0xB8: ("CLV", ADDR_IMPLIED, 1),
    0xB9: ("LDA", ADDR_ABSY, 3),    0xBA: ("TSX", ADDR_IMPLIED, 1), 0xBC: ("LDY", ADDR_ABSX, 3),    0xBD: ("LDA", ADDR_ABSX, 3),
    0xBE: ("LDX", ADDR_ABSY, 3),    0xC0: ("CPY", ADDR_IMM, 2),     0xC1: ("CMP", ADDR_INDX, 2),    0xC4: ("CPY", ADDR_ZP, 2),
    0xC5: ("CMP", ADDR_ZP, 2),      0xC6: ("DEC", ADDR_ZP, 2),      0xC8: ("INY", ADDR_IMPLIED, 1), 0xC9: ("CMP", ADDR_IMM, 2),
    0xCA: ("DEX", ADDR_IMPLIED, 1), 0xCC: ("CPY", ADDR_ABS, 3),     0xCD: ("CMP", ADDR_ABS, 3),     0xCE: ("DEC", ADDR_ABS, 3),
    0xD0: ("BNE", ADDR_REL, 2),     0xD1: ("CMP", ADDR_INDY, 2),    0xD5: ("CMP", ADDR_ZPX, 2),     0xD6: ("DEC", ADDR_ZPX, 2),
    0xD8: ("CLD", ADDR_IMPLIED, 1), 0xD9: ("CMP", ADDR_ABSY, 3),    0xDD: ("CMP", ADDR_ABSX, 3),    0xDE: ("DEC", ADDR_ABSX, 3),
    0xE0: ("CPX", ADDR_IMM, 2),     0xE1: ("SBC", ADDR_INDX, 2),    0xE4: ("CPX", ADDR_ZP, 2),      0xE5: ("SBC", ADDR_ZP, 2),
    0xE6: ("INC", ADDR_ZP, 2),      0xE8: ("INX", ADDR_IMPLIED, 1), 0xE9: ("SBC", ADDR_IMM, 2),     0xEA: ("NOP", ADDR_IMPLIED, 1),
    0xEC: ("CPX", ADDR_ABS, 3),     0xED: ("SBC", ADDR_ABS, 3),     0xEE: ("INC", ADDR_ABS, 3),     0xF0: ("BEQ", ADDR_REL, 2),
    0xF1: ("SBC", ADDR_INDY, 2),    0xF5: ("SBC", ADDR_ZPX, 2),     0xF6: ("INC", ADDR_ZPX, 2),     0xF8: ("SED", ADDR_IMPLIED, 1),
    0xF9: ("SBC", ADDR_ABSY, 3),    0xFD: ("SBC", ADDR_ABSX, 3),    0xFE: ("INC", ADDR_ABSX, 3),
}

# Registradores conhecidos do NES
NES_REGISTERS = {
    0x2000: "PPUCTRL",
    0x2001: "PPUMASK",
    0x2002: "PPUSTATUS",
    0x2003: "OAMADDR",
    0x2004: "OAMDATA",
    0x2005: "PPUSCROLL",
    0x2006: "PPUADDR",
    0x2007: "PPUDATA",
    0x4000: "SQ1_VOL",
    0x4001: "SQ1_SWEEP",
    0x4002: "SQ1_LO",
    0x4003: "SQ1_HI",
    0x4004: "SQ2_VOL",
    0x4005: "SQ2_SWEEP",
    0x4006: "SQ2_LO",
    0x4007: "SQ2_HI",
    0x4008: "TRI_LINEAR",
    0x400A: "TRI_LO",
    0x400B: "TRI_HI",
    0x400C: "NOISE_VOL",
    0x400E: "NOISE_LO",
    0x400F: "NOISE_HI",
    0x4010: "DMC_FREQ",
    0x4011: "DMC_RAW",
    0x4012: "DMC_START",
    0x4013: "DMC_LEN",
    0x4014: "OAMDMA",
    0x4015: "APUSTATUS",
    0x4016: "JOY1",
    0x4017: "JOY2_FRAME",
}

SMB1_SYMBOLS = {
    0x8000: "RESET_Start",
    0x8082: "NMI_Handler",
    0xFFF0: "IRQ_Handler",
}

class Disassembler6502:
    def __init__(self, prg_bytes, base_addr=0x8000):
        self.prg = prg_bytes
        self.base_addr = base_addr
        self.size = len(prg_bytes)
        self.labels = set()
        self.label_names = {}
        self.instructions = []

    def disassemble(self):
        # Passo 1: Descobrir destinos de saltos para criar labels
        self._find_labels()

        # Passo 2: Montar as instruções formatadas
        pc = 0
        while pc < self.size:
            addr = self.base_addr + pc
            byte = self.prg[pc]

            if byte in OPCODES:
                mnemonic, mode, length = OPCODES[byte]
                # Verifica se a instrução não ultrapassa o fim da ROM
                if pc + length <= self.size:
                    operands = self.prg[pc + 1 : pc + length]
                    asm_line, target = self._format_instruction(addr, mnemonic, mode, operands)
                    self.instructions.append({
                        "addr": addr,
                        "bytes": self.prg[pc : pc + length],
                        "mnemonic": mnemonic,
                        "mode": mode,
                        "operands": operands,
                        "text": asm_line,
                        "target": target
                    })
                    pc += length
                    continue

            # Byte de dados ou opcode não reconhecido
            self.instructions.append({
                "addr": addr,
                "bytes": bytes([byte]),
                "mnemonic": ".byte",
                "mode": "DATA",
                "operands": bytes([byte]),
                "text": f".byte ${byte:02X}",
                "target": None
            })
            pc += 1

    def _find_labels(self):
        # Adiciona vetores conhecidos
        for sym_addr, sym_name in SMB1_SYMBOLS.items():
            self.labels.add(sym_addr)
            self.label_names[sym_addr] = sym_name

        pc = 0
        while pc < self.size:
            byte = self.prg[pc]
            if byte in OPCODES:
                mnemonic, mode, length = OPCODES[byte]
                if pc + length <= self.size:
                    if mode == ADDR_REL:
                        offset = self.prg[pc + 1]
                        if offset >= 0x80:
                            offset -= 0x100
                        target = (self.base_addr + pc + 2) + offset
                        if self.base_addr <= target < self.base_addr + self.size:
                            self.labels.add(target)
                            if target not in self.label_names:
                                self.label_names[target] = f"loc_{target:04X}"
                    elif mode == ADDR_ABS and mnemonic in ("JMP", "JSR"):
                        target = self.prg[pc + 1] | (self.prg[pc + 2] << 8)
                        if self.base_addr <= target < self.base_addr + self.size:
                            self.labels.add(target)
                            if target not in self.label_names:
                                prefix = "sub" if mnemonic == "JSR" else "loc"
                                self.label_names[target] = f"{prefix}_{target:04X}"
                    pc += length
                    continue
            pc += 1

    def _format_instruction(self, addr, mnemonic, mode, operands):
        target = None
        if mode == ADDR_IMPLIED:
            return f"{mnemonic}", None
        elif mode == ADDR_ACC:
            return f"{mnemonic} A", None
        elif mode == ADDR_IMM:
            return f"{mnemonic} #${operands[0]:02X}", None
        elif mode == ADDR_ZP:
            val = operands[0]
            comment = f" ; {NES_REGISTERS[val]}" if val in NES_REGISTERS else ""
            return f"{mnemonic} ${val:02X}{comment}", val
        elif mode == ADDR_ZPX:
            return f"{mnemonic} ${operands[0]:02X},X", None
        elif mode == ADDR_ZPY:
            return f"{mnemonic} ${operands[0]:02X},Y", None
        elif mode == ADDR_ABS:
            val = operands[0] | (operands[1] << 8)
            target = val
            if val in NES_REGISTERS:
                return f"{mnemonic} {NES_REGISTERS[val]} ; (${val:04X})", val
            if val in self.label_names:
                return f"{mnemonic} {self.label_names[val]}", val
            return f"{mnemonic} ${val:04X}", val
        elif mode == ADDR_ABSX:
            val = operands[0] | (operands[1] << 8)
            if val in NES_REGISTERS:
                return f"{mnemonic} {NES_REGISTERS[val]},X", val
            return f"{mnemonic} ${val:04X},X", val
        elif mode == ADDR_ABSY:
            val = operands[0] | (operands[1] << 8)
            return f"{mnemonic} ${val:04X},Y", val
        elif mode == ADDR_IND:
            val = operands[0] | (operands[1] << 8)
            return f"{mnemonic} (${val:04X})", val
        elif mode == ADDR_INDX:
            return f"{mnemonic} (${operands[0]:02X},X)", None
        elif mode == ADDR_INDY:
            return f"{mnemonic} (${operands[0]:02X}),Y", None
        elif mode == ADDR_REL:
            offset = operands[0]
            if offset >= 0x80:
                offset -= 0x100
            target = (addr + 2) + offset
            target_name = self.label_names.get(target, f"${target:04X}")
            return f"{mnemonic} {target_name}", target
        return f"{mnemonic} ???", None

    def export_assembly(self, output_file):
        with open(output_file, "w") as f:
            f.write("; =========================================================\n")
            f.write("; SUPER MARIO BROS (NES NROM-256) - DESCOMPILAÇÃO 6502\n")
            f.write(f"; Base Address: ${self.base_addr:04X} | Size: {self.size} bytes\n")
            f.write(f"; Total Labels Identificadas: {len(self.labels)}\n")
            f.write("; =========================================================\n\n")

            for instr in self.instructions:
                addr = instr["addr"]
                if addr in self.labels:
                    name = self.label_names.get(addr, f"loc_{addr:04X}")
                    f.write(f"\n{name}:\n")

                bytes_hex = " ".join(f"{b:02X}" for b in instr["bytes"]).ljust(10)
                f.write(f"  ${addr:04X}:  {bytes_hex}  {instr['text']}\n")

        print(f"[OK] Assembly descompilado salvo em: {output_file}")


if __name__ == "__main__":
    prg_path = "extracted/prg_rom.bin"
    if not os.path.exists(prg_path):
        print(f"Erro: {prg_path} não encontrado. Execute tools/extract_rom.py primeiro.")
        sys.exit(1)

    with open(prg_path, "rb") as f:
        prg = f.read()

    disasm = Disassembler6502(prg, base_addr=0x8000)
    disasm.disassemble()
    disasm.export_assembly("extracted/smb_disassembly.asm")
