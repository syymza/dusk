export const STEP = 1 / 120;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export class Flock {
  constructor(width = 1000, height = 700, seed = 7619, count = 500) {
    this.width = width; this.height = height; this.seed = seed; this.count = count;
    this.reset();
  }
  reset() {
    const rng = random(this.seed);
    this.tick = 0;
    this.birds = Array.from({ length: this.count }, (_, id) => {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      const angle = -.3 + rng() * .6, speed = 46 + rng() * 14;
      return { id, x: this.width * (.5 + Math.cos(a) * r * .29), y: this.height * (.43 + Math.sin(a) * r * .14), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, bank: 0, phase: rng() * Math.PI * 2, depth: .5 + rng() * .5 };
    });
    this.previous = this.birds.map(b => ({ ...b }));
  }
  resize(width, height) {
    for (const b of this.birds) { b.x *= width / this.width; b.y *= height / this.height; }
    this.width = width; this.height = height;
    this.previous = this.birds.map(b => ({ ...b }));
  }
  step(pointer = null) {
    const birds = this.birds, n = birds.length, t = this.tick * STEP;
    const w = this.width, h = this.height;
    let centerX = 0, centerY = 0;
    for (const b of birds) { centerX += b.x; centerY += b.y; }
    centerX /= n; centerY /= n;
    const goalX = w * (.5 + .25 * Math.sin(t * .095));
    const goalY = h * (.43 + .13 * Math.sin(t * .14 + .8));
    const next = this.previous;
    const columns=Math.ceil(w/100),rows=Math.ceil(h/100);
    if(!this.cells||this.cells.length!==columns*rows) this.cells=new Int32Array(columns*rows);
    if(!this.links||this.links.length!==n) this.links=new Int32Array(n);
    const cells=this.cells,links=this.links;
    cells.fill(-1);
    for(let i=n-1;i>=0;i--) {
      const cell=Math.floor(birds[i].y/100)*columns+Math.floor(birds[i].x/100);
      links[i]=cells[cell];cells[cell]=i;
    }
    for (let i = 0; i < n; i++) {
      const b = birds[i]; let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, neighbors = 0;
      const cellX=Math.floor(b.x/100),cellY=Math.floor(b.y/100);
      for(let y=Math.max(0,cellY-1);y<=Math.min(rows-1,cellY+1);y++) {
        for(let x=Math.max(0,cellX-1);x<=Math.min(columns-1,cellX+1);x++) {
          for(let j=cells[y*columns+x];j!==-1;j=links[j]) {
            if (i === j) continue;
            const o = birds[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 < 10000 && d2 > .0001) {
              const d = Math.sqrt(d2);
              if (d < 19) { const force = (19 - d) / d; sx -= dx * force; sy -= dy * force; }
              if (dx * b.vx + dy * b.vy > -d * 38) { ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; neighbors++; }
            }
          }
        }
      }
      let fx = sx * 3.3, fy = sy * 3.3;
      if (neighbors) { fx += (ax / neighbors - b.vx) * .85 + (cx / neighbors - b.x) * .22; fy += (ay / neighbors - b.vy) * .85 + (cy / neighbors - b.y) * .22; }
      fx += (centerX - b.x) * .065 + (goalX - centerX) * .12;
      fy += (centerY - b.y) * .065 + (goalY - centerY) * .12;
      fx += Math.cos(t * .42 + b.y * .008) * 7;
      fy += Math.sin(t * .38 + b.x * .006) * 9;
      const margin = Math.min(w, h) * .17;
      fx += Math.max(0, margin - b.x) * .8 - Math.max(0, b.x - (w - margin)) * .8;
      fy += Math.max(0, h * .22 - b.y) * .8 - Math.max(0, b.y - h * .74) * .8;
      if (pointer?.active) {
        const dx = b.x + b.vx * .28 - pointer.x, dy = b.y + b.vy * .28 - pointer.y;
        const d = Math.hypot(dx, dy), radius = 105;
        if (d < radius) {
          const strength = (1 - d / radius) ** 2 * 220;
          const nx = d > .01 ? dx / d : (i % 2 ? 1 : -1), ny = d > .01 ? dy / d : 0;
          fx += nx * strength; fy += ny * strength;
        }
      }
      const force = Math.hypot(fx, fy), limit = 90;
      if (force > limit) { fx *= limit / force; fy *= limit / force; }
      let vx = b.vx + fx * STEP, vy = b.vy + fy * STEP;
      const speed = Math.hypot(vx, vy), bounded = clamp(speed, 36, 78);
      if (speed > 0) { vx *= bounded / speed; vy *= bounded / speed; }
      const cross = (b.vx * vy - b.vy * vx) / Math.max(1, speed * speed);
      next[i] = { ...b, x: clamp(b.x + vx * STEP, 3, w - 3), y: clamp(b.y + vy * STEP, 3, h - 3), vx, vy, bank: b.bank * .94 + clamp(cross * 70, -.8, .8) * .06 };
    }
    this.previous = birds; this.birds = next; this.tick++;
  }
}
export class FixedClock {
  constructor(flock) { this.flock = flock; this.accumulator = 0; }
  advance(seconds, inputAt = () => null) {
    this.accumulator += clamp(seconds, 0, .1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.flock.step(inputAt(this.flock.tick * STEP));
      this.accumulator = Math.max(0, this.accumulator - STEP);
    }
    return this.accumulator / STEP;
  }
  clear() { this.accumulator = 0; }
}
