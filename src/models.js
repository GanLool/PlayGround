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

// ---------------------------------------------------------------------------
// Cute anime player characters
// ---------------------------------------------------------------------------
export function createAnimeCharacter(variant = 'female') {
  const female = variant !== 'male';
  const skin = 0xffd7bd;
  const skinShade = 0xf0b894;
  const hairColor = female ? 0xff8fc4 : 0x2f4f8f;
  const hairDark = female ? 0xe06aa8 : 0x1f376b;
  const eyeColor = female ? 0xff4f9a : 0x38b6ff;
  const outfitColor = female ? 0xf7f3ff : 0x1fb8a6;
  const accentColor = female ? 0x5b6ee1 : 0xff5a3c;
  const skinMat = mat(skin, { roughness: 0.8 });
  const hairMat = mat(hairColor, { roughness: 0.82 });
  const hairDarkMat = mat(hairDark, { roughness: 0.82 });
  const outfitMat = mat(outfitColor, { roughness: 0.82 });
  const accentMat = mat(accentColor, { roughness: 0.75 });
  const whiteMat = mat(0xffffff, { roughness: 0.75 });
  const eyeWhiteMat = mat(0xffffff, { roughness: 0.22, emissive: 0xffffff, emissiveIntensity: 0.18 });
  const irisMat = mat(eyeColor, { roughness: 0.18, emissive: eyeColor, emissiveIntensity: 0.38 });
  const pupilMat = mat(0x1a1220, { roughness: 0.2 });
  const glintMat = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
  const blushMat = mat(0xff8fb0, { roughness: 0.9, transparent: true, opacity: 0.55 });
  const mouthMat = mat(0xd94f6a, { roughness: 0.5 });

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Legs
  const legMat = mat(female ? 0xfff4f8 : 0x2b2f3a, { roughness: 0.9 });
  const sockMat = mat(0xffffff, { roughness: 0.9 });
  const shoeMat = mat(female ? 0x7a4b2a : 0xff5a3c, { roughness: 0.7 });
  function makeLeg(sx) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.14, 0.78, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.66, 8), legMat);
    thigh.position.y = -0.33;
    thigh.castShadow = true;
    leg.add(thigh);
    if (female) {
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.079, 0.072, 0.28, 8), sockMat);
      sock.position.y = -0.5;
      sock.castShadow = true;
      leg.add(sock);
    }
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.3), shoeMat);
    shoe.position.set(0, -0.725, 0.045);
    shoe.castShadow = true;
    leg.add(shoe);
    if (!female) {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.31), whiteMat);
      sole.position.set(0, -0.775, 0.045);
      leg.add(sole);
    }
    root.add(leg);
    return leg;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Hips / skirt / shorts
  if (female) {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.38, 0.42, 12, 1, true),
      mat(accentColor, { roughness: 0.85, side: THREE.DoubleSide })
    );
    skirt.position.y = 0.91;
    skirt.castShadow = true;
    bodyGroup.add(skirt);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.385, 0.045, 12, 1, true), whiteMat);
    hem.position.y = 0.705;
    bodyGroup.add(hem);
  } else {
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), mat(0x2b2f3a, { roughness: 0.9 }));
    shorts.position.y = 0.9;
    shorts.castShadow = true;
    bodyGroup.add(shorts);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.32), accentMat);
    belt.position.y = 1.04;
    bodyGroup.add(belt);
  }

  // Torso
  const torso = new THREE.Mesh(
    female
      ? new THREE.CylinderGeometry(0.19, 0.24, 0.48, 10)
      : new THREE.BoxGeometry(0.43, 0.5, 0.28),
    outfitMat
  );
  torso.position.y = 1.2;
  torso.castShadow = true;
  bodyGroup.add(torso);

  if (female) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12), whiteMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.42;
    bodyGroup.add(collar);
    const bow = new THREE.Group();
    bow.position.set(0, 1.33, 0.155);
    for (const sx of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(0xff4f6d, { roughness: 0.55 }));
      loop.scale.set(0.075, 0.045, 0.03);
      loop.position.x = sx * 0.07;
      bow.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0xff4f6d, { roughness: 0.55 }));
    bow.add(knot);
    bodyGroup.add(bow);
  } else {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12, Math.PI), accentMat);
    hood.rotation.x = Math.PI / 2;
    hood.rotation.z = Math.PI;
    hood.position.set(0, 1.42, -0.02);
    bodyGroup.add(hood);
    for (const sx of [-0.06, 0.06]) {
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), whiteMat);
      string.position.set(sx, 1.3, 0.155);
      bodyGroup.add(string);
    }
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.02), mat(accentColor, { roughness: 0.8 }));
    pocket.position.set(0, 1.07, 0.155);
    bodyGroup.add(pocket);
  }

  // Arms
  function makeArm(sx) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.27, 1.38, 0);
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.065, female ? 0.18 : 0.5, 8),
      outfitMat
    );
    sleeve.position.y = female ? -0.09 : -0.25;
    sleeve.castShadow = true;
    arm.add(sleeve);
    if (female) {
      const bare = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.4, 8), skinMat);
      bare.position.y = -0.38;
      bare.castShadow = true;
      arm.add(bare);
    }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinMat);
    hand.position.y = -0.55;
    hand.castShadow = true;
    arm.add(hand);
    bodyGroup.add(arm);
    return arm;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Neck & head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 8), skinMat);
  neck.position.y = 1.47;
  bodyGroup.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.62;
  bodyGroup.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), skinMat);
  skull.castShadow = true;
  head.add(skull);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skinMat);
    ear.scale.set(0.55, 1, 0.65);
    ear.position.set(sx * 0.26, 0, 0);
    head.add(ear);

    const white = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), eyeWhiteMat);
    white.scale.set(0.066, 0.092, 0.03);
    white.position.set(sx * 0.1, 0.02, 0.245);
    head.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), irisMat);
    iris.scale.set(0.046, 0.062, 0.02);
    iris.position.set(sx * 0.1, 0.015, 0.268);
    head.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), pupilMat);
    pupil.scale.set(0.022, 0.033, 0.012);
    pupil.position.set(sx * 0.1, 0.012, 0.28);
    head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), glintMat);
    glint.scale.set(0.014, 0.018, 0.008);
    glint.position.set(sx * 0.1 - 0.018, 0.04, 0.288);
    head.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), hairDarkMat);
    brow.position.set(sx * 0.1, 0.14, 0.235);
    brow.rotation.z = sx * 0.12;
    head.add(brow);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), blushMat);
    blush.scale.set(0.055, 0.03, 0.012);
    blush.position.set(sx * 0.17, -0.04, 0.225);
    head.add(blush);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), mat(skinShade, { roughness: 0.85 }));
  nose.position.set(0, -0.04, 0.272);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mouthMat);
  mouth.scale.set(0.035, 0.014, 0.01);
  mouth.position.set(0, -0.11, 0.255);
  head.add(mouth);

  // Hair
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.285, 18, 12, 0, TAU, 0, Math.PI * 0.48),
    hairMat
  );
  cap.position.y = 0.03;
  cap.castShadow = true;
  head.add(cap);

  if (female) {
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), hairMat);
    back.scale.set(0.29, 0.4, 0.2);
    back.position.set(0, -0.12, -0.12);
    back.castShadow = true;
    head.add(back);
    for (const sx of [-1, 1]) {
      const strand = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10), hairMat);
      strand.scale.set(0.075, 0.31, 0.095);
      strand.position.set(sx * 0.235, -0.17, 0.07);
      strand.castShadow = true;
      head.add(strand);
    }
    const sweep = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3, 4), hairMat);
    sweep.position.set(0.07, 0.13, 0.23);
    sweep.rotation.x = Math.PI;
    sweep.rotation.z = -0.55;
    head.add(sweep);
    const bow = new THREE.Group();
    bow.position.set(0.19, 0.19, 0.06);
    bow.rotation.z = -0.28;
    for (const sx of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(0xff4f6d, { roughness: 0.5 }));
      loop.scale.set(0.075, 0.045, 0.03);
      loop.position.x = sx * 0.07;
      bow.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0xff4f6d, { roughness: 0.5 }));
    bow.add(knot);
    head.add(bow);
  } else {
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), hairMat);
    back.scale.set(0.27, 0.23, 0.2);
    back.position.set(0, 0.0, -0.1);
    back.castShadow = true;
    head.add(back);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 4), i % 2 ? hairDarkMat : hairMat);
      spike.position.set(-0.16 + i * 0.08, 0.27, -0.02 + Math.abs(i - 2) * 0.03);
      spike.rotation.z = (i - 2) * 0.24;
      spike.rotation.x = -0.2;
      head.add(spike);
    }
    const ahoge = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.19, 4), hairMat);
    ahoge.position.set(0.03, 0.38, 0.0);
    ahoge.rotation.z = 0.35;
    head.add(ahoge);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.022, 6, 18, Math.PI), mat(0x1b1e24, { roughness: 0.55, metalness: 0.3 }));
    band.position.y = 0.02;
    head.add(band);
    for (const sx of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), mat(0x1b1e24, { roughness: 0.55, metalness: 0.3 }));
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * 0.285, 0.0, 0);
      head.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 12), mat(accentColor, { emissive: accentColor, emissiveIntensity: 0.45 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * 0.315, 0.0, 0);
      head.add(ring);
    }
  }

  // Front bangs
  for (let i = 0; i < 4; i++) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 4), i % 2 ? hairDarkMat : hairMat);
    bang.position.set(-0.16 + i * 0.105, 0.16, 0.22);
    bang.rotation.x = Math.PI;
    bang.rotation.z = (i - 1.5) * 0.16;
    head.add(bang);
  }

  root.userData = {
    variant: female ? 'female' : 'male',
    bodyGroup, armL, armR, legL, legR, head, torso,
    phase: Math.random() * TAU,
    update(dt, opts = {}) {
      const { speed = 0, grounded = true, sprint = false, attack = 0, time = 0 } = opts;
      const u = root.userData;
      u.phase += dt * (2.0 + speed * 2.3);
      const amp = clamp(speed / 4.5, 0, 1) * (sprint ? 1.1 : 0.85);
      const s = Math.sin(u.phase);
      u.legL.rotation.x = s * amp;
      u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * amp * 0.8;
      u.armR.rotation.x = s * amp * 0.8;
      u.armL.rotation.z = 0.06;
      u.armR.rotation.z = -0.06;
      u.bodyGroup.position.y = Math.abs(Math.sin(u.phase * 2)) * 0.025 * amp;
      u.bodyGroup.rotation.z = Math.sin(u.phase) * 0.03 * amp;
      u.head.rotation.z = Math.sin(u.phase * 0.5) * 0.02;
      if (!grounded) {
        u.legL.rotation.x = 0.55;
        u.legR.rotation.x = -0.35;
        u.armL.rotation.x = -1.1;
        u.armR.rotation.x = -1.1;
      }
      if (attack > 0) {
        u.armR.rotation.x = -1.9 * attack;
        u.armR.rotation.z = -0.2;
        u.bodyGroup.rotation.y = 0.16 * attack;
      } else {
        u.bodyGroup.rotation.y *= 0.85;
      }
      if (speed < 0.15 && grounded) {
        const t = time * 1.4;
        u.bodyGroup.rotation.z = Math.sin(t) * 0.015;
        u.armL.rotation.x = Math.sin(t) * 0.05;
        u.armR.rotation.x = -Math.sin(t) * 0.05;
        u.head.rotation.z = Math.sin(t * 0.8) * 0.03;
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
