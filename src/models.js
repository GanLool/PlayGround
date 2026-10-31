import * as THREE from 'three';
import { makeLabelSprite, rand, TAU, clamp } from './utils.js';

const materialCache = new Map();
function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.82,
      metalness: opts.metalness ?? 0.05,
      flatShading: opts.flatShading ?? false,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    }));
  }
  return materialCache.get(key);
}

const FEATHER = 0xf3e6cf;
const FEATHER_2 = 0xdcc9a7;
const COMB = 0xd92f24;
const BEAK = 0xf0a02a;
const LEG = 0xe08a2e;
const TAIL = 0x17634f;

export function createRooster() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.12;
  root.add(bodyGroup);

  const bodyMat = mat(FEATHER, { roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), bodyMat);
  body.scale.set(0.6, 0.54, 0.84);
  body.castShadow = true;
  bodyGroup.add(body);

  const breast = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat(FEATHER_2, { roughness: 0.95 }));
  breast.scale.set(0.5, 0.48, 0.42);
  breast.position.set(0, -0.06, 0.45);
  breast.castShadow = true;
  bodyGroup.add(breast);

  const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(FEATHER_2, { roughness: 0.95 }));
  saddle.scale.set(0.42, 0.12, 0.55);
  saddle.position.set(0, 0.34, -0.18);
  saddle.castShadow = true;
  bodyGroup.add(saddle);

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.56, 8), bodyMat);
  neck.position.set(0, 0.46, 0.54);
  neck.rotation.x = 0.42;
  neck.castShadow = true;
  bodyGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.8, 0.6);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bodyMat);
  head.castShadow = true;
  headGroup.add(head);

  const combMat = mat(COMB, { roughness: 0.6, emissive: 0x4a0804, emissiveIntensity: 0.35 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3 - i * 0.03, 0.22), combMat);
    c.position.set(0, 0.37 + (i === 1 ? 0.03 : 0), -0.1 + i * 0.14);
    c.rotation.z = i === 0 ? -0.15 : i === 2 ? 0.15 : 0;
    c.castShadow = true;
    headGroup.add(c);
  }

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), mat(BEAK, { roughness: 0.55 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.01, 0.38);
  beak.castShadow = true;
  headGroup.add(beak);

  const wattle = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(COMB, { roughness: 0.6 }));
  wattle.scale.set(0.11, 0.19, 0.12);
  wattle.position.set(0, -0.28, 0.27);
  headGroup.add(wattle);

  const eyeMat = mat(0x111111, { roughness: 0.3, metalness: 0.1 });
  const eyeGlint = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), eyeMat);
    eye.position.set(sx * 0.165, 0.1, 0.305);
    headGroup.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), eyeGlint);
    glint.position.set(sx * 0.185, 0.125, 0.355);
    headGroup.add(glint);
  }

  // wings
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  wingL.position.set(-0.6, 0.1, 0.02);
  wingR.position.set(0.6, 0.1, 0.02);
  const wingGeo = new THREE.SphereGeometry(1, 8, 6);
  const wl = new THREE.Mesh(wingGeo, mat(FEATHER_2, { roughness: 0.95 }));
  wl.scale.set(0.13, 0.42, 0.6);
  wl.position.set(0, -0.2, 0);
  wl.castShadow = true;
  wingL.add(wl);
  const wr = wl.clone();
  wingR.add(wr);
  bodyGroup.add(wingL, wingR);

  // tail feathers
  const tail = new THREE.Group();
  tail.position.set(0, 0.02, -0.78);
  const tailMat = mat(TAIL, { roughness: 0.45, metalness: 0.35, emissive: 0x063026, emissiveIntensity: 0.6 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.0, 4), tailMat);
    f.position.set(0, 0.08, 0);
    f.rotation.set(-1.18 - i * 0.03, (i - 2) * 0.24, (i - 2) * 0.2);
    f.castShadow = true;
    tail.add(f);
  }
  bodyGroup.add(tail);

  // legs
  const legMat = mat(LEG, { roughness: 0.7 });
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [grp, sx] of [[legL, -1], [legR, 1]]) {
    grp.position.set(sx * 0.21, 0.72, 0.02);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.62, 6), legMat);
    shin.position.y = -0.31;
    shin.castShadow = true;
    grp.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.42), legMat);
    foot.position.set(0, -0.62, 0.11);
    foot.castShadow = true;
    grp.add(foot);
    root.add(grp);
  }

  root.userData = {
    bodyGroup, headGroup, wingL, wingR, tail, legL, legR, body, phase: 0,
    update(dt, opts = {}) {
      const { speed = 0, grounded = true, sprint = false, attack = 0, time = 0 } = opts;
      const u = root.userData;
      u.phase += dt * (2.0 + speed * 2.5);
      const amp = Math.min(1, speed / 5.5) * 0.95;
      u.legL.rotation.x = Math.sin(u.phase) * amp;
      u.legR.rotation.x = -Math.sin(u.phase) * amp;
      u.bodyGroup.position.y = 1.12 + Math.abs(Math.sin(u.phase * 2)) * 0.055 * amp;
      u.bodyGroup.rotation.x = attack * 0.22;
      u.bodyGroup.rotation.z = Math.sin(u.phase) * 0.04 * amp;
      u.headGroup.position.z = 0.6 + attack * 0.22;
      u.headGroup.position.y = 0.8 + Math.sin(u.phase * 2) * 0.02 * amp;
      u.headGroup.rotation.x = Math.sin(u.phase * 2) * 0.05 * amp + attack * 1.05;
      u.tail.rotation.x = Math.sin(u.phase * 0.7) * 0.07 + (sprint ? -0.08 : 0);
      u.tail.rotation.y = Math.sin(u.phase * 0.45) * 0.09;

      let flare = 0.03;
      if (!grounded) flare = 0.9 + Math.sin(time * 26) * 0.28;
      else if (sprint) flare = 0.42;
      u.wingL.rotation.z = flare;
      u.wingR.rotation.z = -flare;
      if (!grounded) {
        u.legL.rotation.x = 0.7;
        u.legR.rotation.x = 0.45;
      }
    },
  };
  return root;
}

const SHIRTS = [0x3f7fbf, 0xc4563f, 0x4f8a54, 0xd1a43a, 0x7b5aa6, 0xd7d2c4, 0x2f6f70, 0xc76b8d];
const PANTS = [0x2e3742, 0x3d4a5c, 0x4b4035, 0x2b2b2b, 0x5c5a55];
const SKINS = [0xe0b089, 0xc48a5f, 0x8d5a3a, 0xf0c9a0, 0x6e452c];

export function createHuman(role = 'ped') {
  const root = new THREE.Group();
  const skin = role === 'cop' ? 0xd9a97e : SKINS[Math.floor(Math.random() * SKINS.length)];
  const shirtColor = role === 'cop' ? 0x243a63 : role === 'gang' ? 0x8f1f24 : SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pantsColor = role === 'cop' ? 0x1b2a45 : PANTS[Math.floor(Math.random() * PANTS.length)];
  const shirtMat = mat(shirtColor);
  const pantsMat = mat(pantsColor);
  const skinMat = mat(skin, { roughness: 0.85 });
  const shoeMat = mat(0x1c1c1c, { roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.31), shirtMat);
  torso.position.y = 1.24;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 10), skinMat);
  head.position.y = 1.79;
  head.castShadow = true;
  root.add(head);

  const hairMat = mat(role === 'gang' ? 0x2b1a12 : 0x231a16, { roughness: 0.95 });
  if (role === 'cop') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.13, 10), mat(0x14233d));
    cap.position.y = 1.97;
    cap.castShadow = true;
    root.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.2), mat(0x0e1a2e));
    brim.position.set(0, 1.93, 0.19);
    root.add(brim);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), mat(0xffc531, { emissive: 0x5a3c00, emissiveIntensity: 0.5 }));
    badge.position.set(-0.17, 1.36, 0.17);
    root.add(badge);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, TAU, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.81;
    root.add(hair);
    if (role === 'gang') {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), mat(0xc31d1d));
      band.position.y = 1.86;
      root.add(band);
    }
  }

  const armGeo = new THREE.BoxGeometry(0.14, 0.64, 0.17);
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.37, 1.53, 0);
  armR.position.set(0.37, 1.53, 0);
  const al = new THREE.Mesh(armGeo, shirtMat);
  al.position.y = -0.3;
  al.castShadow = true;
  armL.add(al);
  const ar = al.clone();
  armR.add(ar);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), skinMat);
  handL.position.y = -0.66;
  armL.add(handL);
  const handR = handL.clone();
  armR.add(handR);
  root.add(armL, armR);

  const legGeo = new THREE.BoxGeometry(0.19, 0.78, 0.22);
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.15, 0.88, 0);
  legR.position.set(0.15, 0.88, 0);
  const ll = new THREE.Mesh(legGeo, pantsMat);
  ll.position.y = -0.39;
  ll.castShadow = true;
  legL.add(ll);
  const lr = ll.clone();
  legR.add(lr);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.11, 0.32), shoeMat);
  shoeL.position.set(0, -0.78, 0.05);
  legL.add(shoeL);
  const shoeR = shoeL.clone();
  legR.add(shoeR);
  root.add(legL, legR);

  if (role === 'gang') {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.05), mat(0x2b1a12));
    strap.position.set(0.12, 1.26, 0.18);
    strap.rotation.z = 0.5;
    root.add(strap);
  }

  root.userData = {
    role, armL, armR, legL, legR, torso, head, phase: Math.random() * TAU,
    update(dt, speed = 0) {
      const u = root.userData;
      u.phase += dt * (1.4 + speed * 2.4);
      const amp = clamp(speed / 4.2, 0, 1) * 0.75;
      u.legL.rotation.x = Math.sin(u.phase) * amp;
      u.legR.rotation.x = -Math.sin(u.phase) * amp;
      u.armL.rotation.x = -Math.sin(u.phase) * amp * 0.85;
      u.armR.rotation.x = Math.sin(u.phase) * amp * 0.85;
      u.torso.position.y = 1.24 + Math.abs(Math.sin(u.phase * 2)) * 0.025 * amp;
    },
  };
  return root;
}

const CAR_TYPES = {
  sedan: { w: 1.92, l: 4.3, bodyH: 0.54, cabW: 1.66, cabH: 0.5, cabL: 1.95, cabZ: -0.12, wheel: 0.37 },
  sport: { w: 1.98, l: 4.5, bodyH: 0.44, cabW: 1.62, cabH: 0.4, cabL: 1.75, cabZ: -0.24, wheel: 0.36 },
  van: { w: 2.05, l: 4.9, bodyH: 0.72, cabW: 1.86, cabH: 0.62, cabL: 2.7, cabZ: -0.2, wheel: 0.4 },
  police: { w: 1.96, l: 4.4, bodyH: 0.5, cabW: 1.68, cabH: 0.5, cabL: 2.0, cabZ: -0.12, wheel: 0.37 },
};

const CAR_COLORS = [0xc23b32, 0x2f6fb5, 0xd9a62e, 0x4d8f5b, 0xdedad0, 0x373c46, 0x8b4fa0, 0x2f8f8f, 0xd96a2f];

export function createCar(opts = {}) {
  const type = opts.type || 'sedan';
  const d = CAR_TYPES[type] || CAR_TYPES.sedan;
  const color = opts.color ?? (opts.police ? 0xe8e6df : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
  const root = new THREE.Group();
  const paint = mat(color, { roughness: 0.38, metalness: 0.35 });
  const dark = mat(0x1b1e24, { roughness: 0.6, metalness: 0.2 });
  const glass = mat(0x1c2a38, { roughness: 0.12, metalness: 0.7, emissive: 0x0a141e, emissiveIntensity: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.bodyH, d.l), paint);
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.04, 0.2, d.l - 0.2), dark);
  skirt.position.y = 0.31;
  root.add(skirt);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(d.cabW, d.cabH, d.cabL), glass);
  cab.position.set(0, 0.5 + d.bodyH / 2 + d.cabH / 2 - 0.03, d.cabZ);
  cab.castShadow = true;
  root.add(cab);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(d.cabW + 0.02, 0.1, d.cabL - 0.16), paint);
  roof.position.set(0, 0.5 + d.bodyH / 2 + d.cabH + 0.01, d.cabZ);
  roof.castShadow = true;
  root.add(roof);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.06, 0.18, 0.22), dark);
  bumperF.position.set(0, 0.42, d.l / 2 - 0.02);
  root.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -d.l / 2 + 0.02;
  root.add(bumperR);

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffe0a0, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff1408, emissiveIntensity: 1.1 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), lightMat);
    hl.position.set(sx * 0.62, 0.58, d.l / 2 + 0.01);
    root.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.06), tailMat);
    tl.position.set(sx * 0.64, 0.6, -d.l / 2 - 0.01);
    root.add(tl);
  }

  const wheelGeo = new THREE.CylinderGeometry(d.wheel, d.wheel, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(d.wheel * 0.42, d.wheel * 0.42, 0.28, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const wheelMat = mat(0x14161a, { roughness: 0.95 });
  const hubMat = mat(0xa8a8a8, { roughness: 0.4, metalness: 0.8 });
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(sx * (d.w / 2 - 0.08), d.wheel, sz * (d.l / 2 - 0.72));
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.castShadow = true;
      w.add(tire);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      w.add(hub);
      root.add(w);
      wheels.push(w);
    }
  }

  let lightbar = null;
  if (opts.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.03, 0.2, 1.4), mat(0x1b2f5c));
    stripe.position.set(0, 0.55, 0.1);
    root.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.26), dark);
    barBase.position.set(0, 0.5 + d.bodyH / 2 + d.cabH + 0.09, d.cabZ);
    root.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff0000, emissiveIntensity: 2.4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2b6bff, emissive: 0x0033ff, emissiveIntensity: 2.4 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), redMat);
    red.position.set(-0.3, 0.5 + d.bodyH / 2 + d.cabH + 0.19, d.cabZ);
    root.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), blueMat);
    blue.position.set(0.3, 0.5 + d.bodyH / 2 + d.cabH + 0.19, d.cabZ);
    root.add(blue);
    lightbar = { red, blue, redMat, blueMat };
  }

  root.userData = { wheels, lightbar, type, color };
  return root;
}

export function createPickup(type) {
  const root = new THREE.Group();
  if (type === 'cash') {
    for (let i = 0; i < 3; i++) {
      const bill = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.05, 0.36),
        mat(0x3f8f4a, { roughness: 0.6, emissive: 0x0d2a10, emissiveIntensity: 0.5 })
      );
      bill.position.y = i * 0.06;
      bill.rotation.y = i * 0.3;
      root.add(bill);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), mat(0xd9b23a, { roughness: 0.5 }));
    band.position.y = 0.06;
    root.add(band);
  } else if (type === 'health') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mat(0xf0eee6, { roughness: 0.6 }));
    box.position.y = 0.2;
    root.add(box);
    const red = mat(0xd42f2f, { emissive: 0x4a0505, emissiveIntensity: 0.4 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.66), red);
    c1.position.y = 0.2;
    root.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.66), red);
    c2.position.y = 0.2;
    root.add(c2);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.46), mat(0x4a5a33, { roughness: 0.8 }));
    box.position.y = 0.2;
    root.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.5), mat(0x2f3a20));
    lid.position.y = 0.46;
    root.add(lid);
    for (let i = 0; i < 3; i++) {
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 6), mat(0xd9b23a, { metalness: 0.7, roughness: 0.3 }));
      bullet.rotation.z = Math.PI / 2;
      bullet.position.set(-0.18 + i * 0.18, 0.55, 0);
      root.add(bullet);
    }
  }
  root.userData.baseY = 0.6;
  root.userData.update = (time) => {
    root.rotation.y = time * 1.7;
    root.position.y = root.userData.baseY + Math.sin(time * 2.4 + root.position.x) * 0.16;
  };
  return root;
}

export function createMarker(color = 0xffc531, label = 'MISI', scale = 1) {
  const root = new THREE.Group();
  const c = new THREE.Color(color);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3 * scale, 0.1 * scale, 6, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  root.add(ring);

  const beamMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.05 * scale, 2.25 * scale, 7, 24, 1, true), beamMat);
  beam.position.y = 3.5;
  root.add(beam);

  const gemMat = new THREE.MeshStandardMaterial({
    color: c.clone().offsetHSL(0, 0, 0.15), emissive: color, emissiveIntensity: 1.4,
    roughness: 0.2, metalness: 0.4,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * scale, 0), gemMat);
  gem.position.y = 4.1;
  root.add(gem);

  const sprite = makeLabelSprite(label, { border: '#' + c.getHexString(), color: '#fff6d8', scale: 0.72 * scale });
  sprite.position.y = 5.5 * scale;
  root.add(sprite);

  root.userData.update = (time) => {
    gem.rotation.y = time * 1.4;
    gem.position.y = 4.1 + Math.sin(time * 2) * 0.18;
    beamMat.opacity = 0.12 + Math.sin(time * 2.2) * 0.04;
    ring.scale.setScalar(1 + Math.sin(time * 2.2) * 0.025);
  };
  return root;
}
