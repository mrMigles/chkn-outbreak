// Tiny helper to author level grids by carving rooms out of solid wall.
export class Painter {
  cells: string[][];
  constructor(public w: number, public h: number, fill = '#') {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  /** Inclusive rectangle. */
  rect(x0: number, y0: number, x1: number, y1: number, ch: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch;
    return this;
  }
  get(x: number, y: number) { return this.cells[y]?.[x]; }
  rows() { return this.cells.map((r) => r.join('')); }
}
