import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function dampAngle(a, b, lambda, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (opts.anisotropy) tex.anisotropy = opts.anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function makeLabelSprite(text, opts = {}) {
  const {
    font = '700 44px "Barlow Condensed", sans-serif',
    color = '#ffffff',
    bg = 'rgba(8,10,14,0.82)',
    border = '#ffc531',
    padX = 30,
    padY = 16,
    scale = 1,
  } = opts;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width);
  c.width = tw + padX * 2;
  c.height = 88 + padY * 2;
  const g = c.getContext('2d');
  g.font = font;
  g.fillStyle = bg;
  g.beginPath();
  const r = 10;
  const w = c.width;
  const h = c.height;
  g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, h - r); g.quadraticCurveTo(w, h, w - r, h);
  g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r);
  g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
  g.fill();
  g.strokeStyle = border;
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / h) * 2.2 * scale, 2.2 * scale, 1);
  return sprite;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

export function pointInRect(x, z, r, pad = 0) {
  return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;
}

export function circleRectResolve(pos, radius, rect) {
  const cx = clamp(pos.x, rect.minX, rect.maxX);
  const cz = clamp(pos.z, rect.minZ, rect.maxZ);
  let dx = pos.x - cx;
  let dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > radius * radius) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    pos.x += (dx / d) * push;
    pos.z += (dz / d) * push;
  } else {
    // center is inside the rect: push out through the nearest side
    const left = Math.abs(pos.x - rect.minX);
    const right = Math.abs(rect.maxX - pos.x);
    const back = Math.abs(pos.z - rect.minZ);
    const front = Math.abs(rect.maxZ - pos.z);
    const m = Math.min(left, right, back, front);
    if (m === left) pos.x = rect.minX - radius;
    else if (m === right) pos.x = rect.maxX + radius;
    else if (m === back) pos.z = rect.minZ - radius;
    else pos.z = rect.maxZ + radius;
  }
  return true;
}
