#!/usr/bin/env python3
"""
tools/bundle_rom.py
Empacota a PRG-ROM e a CHR-ROM extraídas em um módulo JavaScript (web/rom_data.js)
com Uint8Arrays prontos para carregamento instantâneo no navegador.
"""

import base64
import os

def bundle():
    with open("extracted/prg_rom.bin", "rb") as f:
        prg = f.read()

    with open("extracted/chr_rom.bin", "rb") as f:
        chr_data = f.read()

    prg_b64 = base64.b64encode(prg).decode("ascii")
    chr_b64 = base64.b64encode(chr_data).decode("ascii")

    content = f"""// web/rom_data.js
// Dados binários empacotados de Super Mario Bros (PRG: 32KB, CHR: 8KB)

function base64ToUint8Array(base64) {{
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {{
    bytes[i] = binaryString.charCodeAt(i);
  }}
  return bytes;
}}

export const PRG_ROM = base64ToUint8Array("{prg_b64}");
export const CHR_ROM = base64ToUint8Array("{chr_b64}");
"""

    with open("web/rom_data.js", "w") as f:
        f.write(content)

    print(f"[OK] ROM empacotada em web/rom_data.js (PRG: {len(prg)} bytes, CHR: {len(chr_data)} bytes)")

if __name__ == "__main__":
    bundle()
