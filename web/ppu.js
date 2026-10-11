// web/ppu.js
// Processador Gráfico PPU 2C02 do NES para Super Mario Bros
// Suporta: Fine Scrolling pixel-a-pixel, Split de HUD (Status Bar fixa), Mirroring Vertical e Prioridade de Sprites

export const NES_PALETTE = [
  0x666666, 0x002A88, 0x1412A7, 0x3B00A4, 0x5C007E, 0x6E0040, 0x6C0600, 0x561D00,
  0x333500, 0x0B4800, 0x005200, 0x004F08, 0x00404D, 0x000000, 0x000000, 0x000000,
  0xADADAD, 0x155FD9, 0x4240FF, 0x7527FE, 0xA01ACC, 0xB71E7B, 0xB53120, 0x994E00,
  0x6B6D00, 0x388700, 0x0C9300, 0x008F32, 0x007C8D, 0x000000, 0x000000, 0x000000,
  0xFFFEFF, 0x64B0FF, 0x9290FF, 0xC676FF, 0xF36AFF, 0xFE6ECC, 0xFE8170, 0xEA9E22,
  0xBCBE00, 0x88D800, 0x5CE430, 0x45E082, 0x48CDDE, 0x4F4F4F, 0x000000, 0x000000,
  0xFFFEFF, 0xC0DFFF, 0xD3D2FF, 0xE8C8FF, 0xFBC2FF, 0xFEC4EA, 0xFECCC5, 0xF7D8A5,
  0xE4E594, 0xCFEF96, 0xBDF4AB, 0xB3F3CC, 0xB5EBF2, 0xB8B8B8, 0x000000, 0x000000,
];

export class PPU {
  constructor(bus) {
    this.bus = bus;
    this.width = 256;
    this.height = 240;
    this.frameBuffer = new Uint8Array(this.width * this.height * 4);
    // Buffer de opacidade do background para prioridade de sprites
    this.bgOpaque = new Uint8Array(this.width * this.height);
  }

  renderFrame() {
    const bus = this.bus;
    const fb = this.frameBuffer;

    const showBg = (bus.ppuMask & 0x08) !== 0;
    const showSprites = (bus.ppuMask & 0x10) !== 0;

    // Cor de fundo universal (Paleta $3F00)
    const universalBgColor = NES_PALETTE[bus.paletteRam[0] & 0x3F] || 0x000000;
    const bgR = (universalBgColor >> 16) & 0xFF;
    const bgG = (universalBgColor >> 8) & 0xFF;
    const bgB = universalBgColor & 0xFF;

    // Limpa framebuffer e buffer de opacidade
    for (let i = 0; i < this.width * this.height; i++) {
      const idx = i * 4;
      fb[idx] = bgR;
      fb[idx + 1] = bgG;
      fb[idx + 2] = bgB;
      fb[idx + 3] = 255;
      this.bgOpaque[i] = 0;
    }

    if (showBg) {
      this.renderBackground();
    }

    if (showSprites) {
      this.renderSprites();
    }

    // Sinaliza Sprite 0 Hit para a quebra de scanline do HUD
    bus.ppuStatus |= 0x40;
  }

  renderBackground() {
    const bus = this.bus;
    const bgPatternTable = (bus.ppuCtrl & 0x10) ? 0x1000 : 0x0000;

    // Renderiza cada linha de tiles (30 linhas de altura)
    for (let tileY = 0; tileY < 30; tileY++) {
      // Split de HUD: As 4 primeiras linhas (0..31 pixels) NUNCA rolam horizontalmente
      const isHUD = tileY < 4;
      const effScrollX = isHUD ? 0 : bus.scrollX;
      const effBaseNT = isHUD ? 0 : (bus.ppuCtrl & 0x01);

      // Fine Scroll (0..7 pixels) e Tile Scroll
      const fineX = effScrollX % 8;
      const tileOffset = Math.floor(effScrollX / 8);

      // Desenha 33 colunas para cobrir a transição de scroll suave
      for (let col = 0; col <= 32; col++) {
        const worldTileX = (effBaseNT * 32) + tileOffset + col;
        const ntIndex = Math.floor(worldTileX / 32) % 2; // 0 ($2000) ou 1 ($2400)
        const ntCol = worldTileX % 32;

        const ntBase = ntIndex === 0 ? 0x2000 : 0x2400;
        const tileId = bus.readPPU(ntBase + (tileY * 32) + ntCol);

        // Atributos de cor (paleta 0..3)
        const attrAddr = (ntBase + 0x03C0) + (Math.floor(tileY / 4) * 8) + Math.floor(ntCol / 4);
        const attrByte = bus.readPPU(attrAddr);
        const shift = ((tileY % 4 >= 2 ? 1 : 0) << 2) | ((ntCol % 4 >= 2 ? 1 : 0) << 1);
        const paletteIdx = (attrByte >> shift) & 0x03;

        const screenX = (col * 8) - fineX;
        const screenY = tileY * 8;

        this.drawBGTile(tileId, bgPatternTable, paletteIdx * 4, screenX, screenY);
      }
    }
  }

  drawBGTile(tileId, patternTableBase, paletteBase, screenX, screenY) {
    const bus = this.bus;
    const fb = this.frameBuffer;
    const tileOffset = patternTableBase + (tileId * 16);

    for (let py = 0; py < 8; py++) {
      const destY = screenY + py;
      if (destY < 0 || destY >= 240) continue;

      const plane0 = bus.readPPU(tileOffset + py);
      const plane1 = bus.readPPU(tileOffset + py + 8);

      for (let px = 0; px < 8; px++) {
        const destX = screenX + px;
        if (destX < 0 || destX >= 256) continue;

        const xBit = 7 - px;
        const bit0 = (plane0 >> xBit) & 1;
        const bit1 = (plane1 >> xBit) & 1;
        const colorIdx = (bit1 << 1) | bit0;

        const pixelIdx = destY * 256 + destX;
        if (colorIdx !== 0) {
          this.bgOpaque[pixelIdx] = 1;
        }

        const palColorEntry = (colorIdx === 0)
          ? (bus.paletteRam[0] & 0x3F)
          : (bus.paletteRam[(paletteBase + colorIdx) & 0x1F] & 0x3F);
        const rgb = NES_PALETTE[palColorEntry] || 0x000000;

        const fbIdx = pixelIdx * 4;
        fb[fbIdx] = (rgb >> 16) & 0xFF;
        fb[fbIdx + 1] = (rgb >> 8) & 0xFF;
        fb[fbIdx + 2] = rgb & 0xFF;
        fb[fbIdx + 3] = 255;
      }
    }
  }

  renderSprites() {
    const bus = this.bus;
    const fb = this.frameBuffer;
    const spritePatternTable = (bus.ppuCtrl & 0x08) ? 0x1000 : 0x0000;

    // Processa os 64 sprites do Mario em ordem reversa
    for (let i = 63; i >= 0; i--) {
      const oamIdx = i * 4;
      const y = bus.oam[oamIdx] + 1;
      const tileId = bus.oam[oamIdx + 1];
      const attr = bus.oam[oamIdx + 2];
      const x = bus.oam[oamIdx + 3];

      // Ignora sprites fora da tela ou não-inicializados
      if (y >= 239 || y <= 0 || (x === 0 && y === 1)) continue;

      const flipV = (attr & 0x80) !== 0;
      const flipH = (attr & 0x40) !== 0;
      const priorityBehind = (attr & 0x20) !== 0;
      const paletteBase = 16 + (attr & 0x03) * 4;

      const tileOffset = spritePatternTable + (tileId * 16);

      for (let py = 0; py < 8; py++) {
        const destY = y + py;
        if (destY < 0 || destY >= 240) continue;

        const yLine = flipV ? (7 - py) : py;
        const plane0 = bus.readPPU(tileOffset + yLine);
        const plane1 = bus.readPPU(tileOffset + yLine + 8);

        for (let px = 0; px < 8; px++) {
          const destX = x + px;
          if (destX < 0 || destX >= 256) continue;

          const xBit = flipH ? px : (7 - px);
          const bit0 = (plane0 >> xBit) & 1;
          const bit1 = (plane1 >> xBit) & 1;
          const colorIdx = (bit1 << 1) | bit0;

          // Cor 0 é transparente para sprites
          if (colorIdx === 0) continue;

          const pixelIdx = destY * 256 + destX;

          // Prioridade: se o sprite deve ficar atrás do background e o pixel do background for sólido, não desenha
          if (priorityBehind && this.bgOpaque[pixelIdx] === 1) {
            continue;
          }

          const palColorEntry = bus.paletteRam[(paletteBase + colorIdx) & 0x1F] & 0x3F;
          const rgb = NES_PALETTE[palColorEntry] || 0x000000;

          const fbIdx = pixelIdx * 4;
          fb[fbIdx] = (rgb >> 16) & 0xFF;
          fb[fbIdx + 1] = (rgb >> 8) & 0xFF;
          fb[fbIdx + 2] = rgb & 0xFF;
          fb[fbIdx + 3] = 255;
        }
      }
    }
  }
}
