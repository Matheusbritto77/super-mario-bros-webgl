#!/usr/bin/env python3
"""
tools/extract_rom.py
Extrai os componentes de uma ROM iNES:
- Header (16 bytes)
- PRG-ROM (Código 6502 - 32 KB para Super Mario Bros)
- CHR-ROM (Gráficos/Tiles 2bpp - 8 KB para Super Mario Bros)
"""

import os
import sys

def extract_nes(rom_path, output_dir="extracted"):
    os.makedirs(output_dir, exist_ok=True)

    with open(rom_path, "rb") as f:
        rom_data = f.read()

    if len(rom_data) < 16:
        raise ValueError("Arquivo muito pequeno para ser uma ROM NES válida.")

    header = rom_data[:16]
    magic = header[:4]
    if magic != b"NES\x1a":
        raise ValueError(f"Assinatura iNES inválida: {magic}")

    prg_banks = header[4]
    chr_banks = header[5]
    flags6 = header[6]
    flags7 = header[7]
    mapper = (flags7 & 0xF0) | (flags6 >> 4)
    mirroring = "Vertical" if (flags6 & 1) else "Horizontal"
    has_battery = bool(flags6 & 2)
    has_trainer = bool(flags6 & 4)

    prg_size = prg_banks * 16384
    chr_size = chr_banks * 8192

    offset = 16
    if has_trainer:
        trainer_data = rom_data[offset:offset + 512]
        with open(os.path.join(output_dir, "trainer.bin"), "wb") as f:
            f.write(trainer_data)
        offset += 512

    prg_data = rom_data[offset:offset + prg_size]
    offset += prg_size

    chr_data = rom_data[offset:offset + chr_size]
    offset += chr_size

    # Salva arquivos brutos
    with open(os.path.join(output_dir, "prg_rom.bin"), "wb") as f:
        f.write(prg_data)

    with open(os.path.join(output_dir, "chr_rom.bin"), "wb") as f:
        f.write(chr_data)

    # Identifica os vetores de interrupção (localizados no topo da PRG-ROM: $FFFA-$FFFF)
    # Como PRG-ROM tem 32KB mapeados em $8000-$FFFF, o offset é [0x7FFA : 0x8000]
    nmi_vector = prg_data[0x7FFA] | (prg_data[0x7FFB] << 8)
    reset_vector = prg_data[0x7FFC] | (prg_data[0x7FFD] << 8)
    irq_vector = prg_data[0x7FFE] | (prg_data[0x7FFF] << 8)

    info = f"""==================================================
Informações da ROM: {os.path.basename(rom_path)}
==================================================
- PRG-ROM (Código): {prg_size // 1024} KB ({prg_banks} bancos de 16KB)
- CHR-ROM (Gráficos): {chr_size // 1024} KB ({chr_banks} bancos de 8KB)
- Mapper: {mapper} (NROM-256)
- Espelhamento (Mirroring): {mirroring}
- Vetor NMI (Frame/VBlank loop): 0x{nmi_vector:04X}
- Vetor RESET (Inicialização): 0x{reset_vector:04X}
- Vetor IRQ: 0x{irq_vector:04X}
=================================================="""

    with open(os.path.join(output_dir, "rom_info.txt"), "w") as f:
        f.write(info)

    print(info)
    print(f"\n[OK] Arquivos extraídos com sucesso em: '{output_dir}/'")

if __name__ == "__main__":
    rom = "Super Mario Bros. (World).nes" if len(sys.argv) < 2 else sys.argv[1]
    extract_nes(rom)
