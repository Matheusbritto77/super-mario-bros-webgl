#!/usr/bin/env python3
"""
tools/chr_decoder.py
Decodifica os 8KB de CHR-ROM do NES (formato 2bpp) em:
1. Um atlas de texturas PNG (128x256 pixels) para visualização e WebGL.
2. Um arquivo binário chr_tiles_indexed.bin (512 tiles x 64 pixels = 32KB) com índices 0, 1, 2, 3.
"""

import os
from PIL import Image

def decode_nes_tile(tile_bytes):
    """
    Decodifica 16 bytes em um tile 8x8 com valores de 0 a 3.
    Plane 0: primeiros 8 bytes
    Plane 1: últimos 8 bytes
    """
    tile = []
    for y in range(8):
        plane0 = tile_bytes[y]
        plane1 = tile_bytes[y + 8]
        row = []
        for x in range(8):
            bit0 = (plane0 >> (7 - x)) & 1
            bit1 = (plane1 >> (7 - x)) & 1
            color_index = (bit1 << 1) | bit0
            row.append(color_index)
        tile.append(row)
    return tile

def process_chr_rom(chr_bin_path="extracted/chr_rom.bin", output_dir="extracted"):
    if not os.path.exists(chr_bin_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {chr_bin_path}")

    with open(chr_bin_path, "rb") as f:
        chr_data = f.read()

    total_tiles = len(chr_data) // 16
    print(f"Total de tiles no CHR-ROM: {total_tiles} tiles (deve ser 512)")

    # Atlas de 16 tiles por linha:
    # 512 tiles / 16 = 32 linhas de tiles
    # Largura = 16 * 8 = 128 pixels
    # Altura  = 32 * 8 = 256 pixels
    tiles_per_row = 16
    tiles_rows = total_tiles // tiles_per_row

    img_w = tiles_per_row * 8
    img_h = tiles_rows * 8

    # Cores de visualização (tons de cinza / verde Gameboy / paleta clássica)
    # 0 = preto/transparente, 1 = cinza escuro, 2 = cinza claro, 3 = branco
    palette_rgb = [
        (15, 15, 15),     # 0
        (120, 120, 120),  # 1
        (190, 190, 190),  # 2
        (255, 255, 255)   # 3
    ]

    img = Image.new("RGB", (img_w, img_h))
    pixels = img.load()

    raw_indices = bytearray()

    for tile_idx in range(total_tiles):
        tile_bytes = chr_data[tile_idx * 16 : (tile_idx + 1) * 16]
        tile = decode_nes_tile(tile_bytes)

        tile_x = (tile_idx % tiles_per_row) * 8
        tile_y = (tile_idx // tiles_per_row) * 8

        for y in range(8):
            for x in range(8):
                c_idx = tile[y][x]
                raw_indices.append(c_idx)
                pixels[tile_x + x, tile_y + y] = palette_rgb[c_idx]

    png_path = os.path.join(output_dir, "chr_tiles.png")
    img.save(png_path)

    bin_path = os.path.join(output_dir, "chr_tiles_indexed.bin")
    with open(bin_path, "wb") as f:
        f.write(raw_indices)

    print(f"[OK] Atlas PNG gerado: {png_path} ({img_w}x{img_h} px)")
    print(f"[OK] Buffer indexado (0-3) gerado: {bin_path} ({len(raw_indices)} bytes)")

if __name__ == "__main__":
    process_chr_rom()
