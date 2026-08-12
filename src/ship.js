import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeLabelTexture, makeScreenTexture } from './materials.js';

const DEG = Math.PI / 180;

function box(parent, size, position, material, rotation = [0, 0, 0], radius = 0, shadows = true) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius)
    : new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radii, height, position, material, rotation = [0, 0, 0], segments = 16, shadows = true) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, radius, material, closed = false, segments = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, closed), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addLabel(parent, {
  title,
  subtitle = '',
  position,
  rotation = [0, 0, 0],
  size = [0.78, 0.25],
  accent,
  background,
  align,
}) {
  const texture = makeLabelTexture({ title, subtitle, accent, background, align });
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.userData.isLabel = true;
  parent.add(mesh);
  return mesh;
}

function addBolts(parent, positions, material, radius = 0.025) {
  const geometry = new THREE.CylinderGeometry(radius, radius, 0.018, 8);
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((position, index) => {
    dummy.position.set(...position);
    dummy.rotation.x = Math.PI / 2;
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.castShadow = true;
  parent.add(mesh);
}

function addWindowFrame(parent, {
  position,
  width,
  height,
  plane = 'front',
  materials,
  mullions = 1,
  glass = true,
}) {
  const frame = new THREE.Group();
  frame.position.set(...position);
  parent.add(frame);
  const edge = 0.115;
  const depth = 0.12;
  const horizontalSize = plane === 'side' ? [edge, edge, width + edge] : [width + edge, edge, depth];
  const verticalSize = plane === 'side' ? [edge, height + edge, depth] : [edge, height + edge, depth];
  const horizontalOffset = (height + edge) / 2;
  const verticalOffset = (width + edge) / 2;

  if (plane === 'side') {
    box(frame, horizontalSize, [0, horizontalOffset, 0], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, horizontalSize, [0, -horizontalOffset, 0], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, verticalSize, [0, 0, verticalOffset], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, verticalSize, [0, 0, -verticalOffset], materials.darkPaint, [0, 0, 0], 0.03);
    for (let index = 1; index <= mullions; index += 1) {
      const z = -width / 2 + (width / (mullions + 1)) * index;
      box(frame, verticalSize, [0, 0, z], materials.darkPaint, [0, 0, 0], 0.025);
    }
    if (glass) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), materials.glass);
      pane.rotation.y = Math.PI / 2;
      pane.renderOrder = 4;
      frame.add(pane);
    }
  } else {
    box(frame, horizontalSize, [0, horizontalOffset, 0], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, horizontalSize, [0, -horizontalOffset, 0], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, verticalSize, [verticalOffset, 0, 0], materials.darkPaint, [0, 0, 0], 0.03);
    box(frame, verticalSize, [-verticalOffset, 0, 0], materials.darkPaint, [0, 0, 0], 0.03);
    for (let index = 1; index <= mullions; index += 1) {
      const x = -width / 2 + (width / (mullions + 1)) * index;
      box(frame, verticalSize, [x, 0, 0], materials.darkPaint, [0, 0, 0], 0.025);
    }
    if (glass) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), materials.glass);
      pane.renderOrder = 4;
      frame.add(pane);
    }
  }

  return frame;
}

function addVent(parent, position, rotation, materials, width = 0.7) {
  const vent = new THREE.Group();
  vent.position.set(...position);
  vent.rotation.set(...rotation);
  parent.add(vent);
  box(vent, [width, 0.38, 0.045], [0, 0, 0], materials.rubber, [0, 0, 0], 0.025);
  for (let index = -3; index <= 3; index += 1) {
    box(vent, [0.045, 0.27, 0.025], [index * width * 0.105, 0, -0.03], materials.bareMetal, [0, 0, -12 * DEG], 0, false);
  }
  return vent;
}

function addScreen(parent, {
  position,
  rotation = [0, 0, 0],
  size = [1, 0.5],
  bezel = 0.035,
  depth = 0.042,
  seed = 1,
  mode = 'nav',
  materials,
  screenAnimations,
}) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  parent.add(group);
  box(
    group,
    [size[0] + bezel * 2, size[1] + bezel * 2, depth],
    [0, 0, -depth * 0.45],
    materials.rubber,
    [0, 0, 0],
    Math.min(0.018, bezel * 0.45),
  );
  const animated = makeScreenTexture(seed, mode);
  const material = new THREE.MeshBasicMaterial({ map: animated.texture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  screen.position.z = 0.004;
  screen.userData.screenMode = mode;
  group.add(screen);
  screenAnimations.push(animated);
  return group;
}

function createCockpitSeat(materials, station) {
  const seat = new THREE.Group();
  seat.name = `Cockpit seat ${station}`;

  // Floor rails and compact slide carriage.
  [-0.19, 0.19].forEach((x) => {
    box(seat, [0.034, 0.026, 0.78], [x, 0.035, 0.08], materials.bareMetal, [0, 0, 0], 0.009);
    [-0.25, 0.3].forEach((z) => {
      box(seat, [0.09, 0.028, 0.08], [x, 0.025, z], materials.darkPaint, [0, 0, 0], 0.012);
    });
  });
  box(seat, [0.42, 0.075, 0.46], [0, 0.22, 0.03], materials.darkPaint, [-3 * DEG, 0, 0], 0.035);
  cylinder(seat, [0.085, 0.115], 0.2, [0, 0.11, 0.08], materials.bareMetal, [0, 0, 0], 14);

  // The visible rear silhouette is a curved metal hoop with a thin shell inside it.
  tube(
    seat,
    [
      [-0.27, 0.34, 0.3],
      [-0.315, 0.68, 0.34],
      [-0.28, 1.12, 0.39],
      [-0.17, 1.34, 0.43],
      [0, 1.4, 0.44],
      [0.17, 1.34, 0.43],
      [0.28, 1.12, 0.39],
      [0.315, 0.68, 0.34],
      [0.27, 0.34, 0.3],
    ],
    0.018,
    materials.bareMetal,
    false,
    44,
  );
  box(seat, [0.5, 0.7, 0.065], [0, 0.9, 0.33], materials.darkPaint, [-8 * DEG, 0, 0], 0.055);

  // Separate pads, seams and side bolsters keep the seat from reading as one blob.
  box(seat, [0.51, 0.105, 0.49], [0, 0.36, -0.015], materials.fabric, [-5 * DEG, 0, 0], 0.065);
  box(seat, [0.44, 0.23, 0.075], [0, 0.59, 0.225], materials.fabric, [-10 * DEG, 0, 0], 0.055);
  box(seat, [0.455, 0.25, 0.075], [0, 0.84, 0.27], materials.fabric, [-9 * DEG, 0, 0], 0.055);
  box(seat, [0.43, 0.2, 0.075], [0, 1.075, 0.315], materials.fabric, [-8 * DEG, 0, 0], 0.05);
  box(seat, [0.26, 0.105, 0.08], [0, 1.285, 0.365], materials.fabric, [-6 * DEG, 0, 0], 0.04);
  box(seat, [0.06, 0.39, 0.085], [-0.25, 0.72, 0.21], materials.rubber, [-9 * DEG, 0, -2 * DEG], 0.025);
  box(seat, [0.06, 0.39, 0.085], [0.25, 0.72, 0.21], materials.rubber, [-9 * DEG, 0, 2 * DEG], 0.025);

  // Four-point harness and small central buckle.
  box(seat, [0.035, 0.49, 0.012], [-0.105, 0.98, 0.2], materials.blanket, [0, 0, -8 * DEG], 0.008, false);
  box(seat, [0.035, 0.49, 0.012], [0.105, 0.98, 0.2], materials.blanket, [0, 0, 8 * DEG], 0.008, false);
  box(seat, [0.16, 0.07, 0.035], [0, 0.7, 0.175], materials.bareMetal, [-8 * DEG, 0, 0], 0.012);

  // Narrow arm pads on exposed supports.
  [-0.34, 0.34].forEach((x) => {
    box(seat, [0.045, 0.22, 0.045], [x, 0.49, 0.08], materials.bareMetal, [0, 0, 0], 0.012);
    box(seat, [0.075, 0.06, 0.35], [x, 0.62, -0.025], materials.rubber, [0, 0, 0], 0.025);
  });

  // Rear service pack and station marking are what the player sees on entry.
  box(seat, [0.22, 0.12, 0.045], [0, 0.47, 0.39], materials.rubber, [-8 * DEG, 0, 0], 0.018);
  for (let index = 0; index < 4; index += 1) {
    box(seat, [0.026, 0.055, 0.012], [-0.06 + index * 0.04, 0.47, 0.418], materials.bareMetal, [-8 * DEG, 0, 0], 0.004, false);
  }

  addLabel(seat, {
    title: station,
    subtitle: 'FLIGHT SEAT',
    position: [0, 0.59, 0.391],
    rotation: [-8 * DEG, 0, 0],
    size: [0.16, 0.055],
    align: 'center',
    accent: '#aa714f',
  });
  return seat;
}

function createMug(materials) {
  const mug = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.16, 16, 1, true), materials.creamPaint);
  body.castShadow = true;
  mug.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.008, 6, 18), materials.bareMetal);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.08;
  mug.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI * 1.55), materials.creamPaint);
  handle.rotation.y = Math.PI / 2;
  handle.position.set(0.08, 0, 0);
  mug.add(handle);
  mug.userData.grabbable = true;
  mug.userData.label = 'ENAMEL MUG';
  return mug;
}

function createWrench(materials) {
  const wrench = new THREE.Group();
  box(wrench, [0.055, 0.055, 0.36], [0, 0, 0], materials.bareMetal, [0, 0, 0], 0.02);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.026, 7, 12, Math.PI * 1.5), materials.bareMetal);
  head.position.z = -0.2;
  head.rotation.x = Math.PI / 2;
  head.rotation.z = 45 * DEG;
  wrench.add(head);
  wrench.userData.grabbable = true;
  wrench.userData.label = '8 MM SERVICE WRENCH';
  return wrench;
}

function createJournal(materials) {
  const journal = new THREE.Group();
  box(journal, [0.23, 0.035, 0.32], [0, 0, 0], materials.blanket, [0, 0, 0], 0.018);
  box(journal, [0.012, 0.044, 0.3], [-0.105, 0, 0], materials.copper, [0, 0, 0], 0.006);
  journal.userData.grabbable = true;
  journal.userData.label = 'MISSION JOURNAL';
  return journal;
}

function addStorageCrate(parent, position, rotation, materials, marking = '07') {
  const crate = new THREE.Group();
  crate.position.set(...position);
  crate.rotation.set(...rotation);
  parent.add(crate);
  box(crate, [0.68, 0.45, 0.48], [0, 0, 0], materials.darkPaint, [0, 0, 0], 0.055);
  box(crate, [0.72, 0.045, 0.08], [0, 0.16, 0.25], materials.copper, [0, 0, 0], 0.01);
  box(crate, [0.72, 0.045, 0.08], [0, -0.16, 0.25], materials.copper, [0, 0, 0], 0.01);
  addLabel(crate, {
    title: marking,
    subtitle: 'DRY STORE',
    position: [0, 0, 0.246],
    size: [0.27, 0.11],
    align: 'center',
  });
  return crate;
}

function createControlButton(parent, position, rotation, materials, label) {
  const button = cylinder(parent, [0.045, 0.045], 0.035, position, materials.amberGlow, rotation, 14, false);
  button.userData.interactable = true;
  button.userData.label = label;
  return button;
}

export function createShip(materials) {
  const ship = new THREE.Group();
  ship.name = 'LRSV Lone Light';
  const interactables = [];
  const grabbables = [];
  const screenAnimations = [];
  const warmLights = [];

  // 48 m vessel: a 30 m occupied pressure deck between an 8 m sensor prow and a 10 m drive section.
  // Furniture remains human-sized; the solitude now comes from empty ship volume instead of capsule scale.
  const hullHalfWidth = 3.6;
  const ceilingHeight = 3.25;
  const deckForward = -14.55;
  const deckAft = 15.45;
  box(ship, [7.2, 0.2, 30], [0, -0.12, 0.45], materials.floor, [0, 0, 0], 0.07);
  box(ship, [6.92, 0.14, 29.8], [0, ceilingHeight, 0.45], materials.darkPaint, [0, 0, 0], 0.045);

  // Left pressure wall: long equipment run, then the private bunk's framed celestial view.
  box(ship, [0.17, 3.18, 17.1], [-hullHalfWidth, 1.58, -5.95], materials.paint, [0, 0, 0], 0.04);
  box(ship, [0.17, 0.72, 4.55], [-hullHalfWidth, 0.36, 5.05], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 0.68, 4.55], [-hullHalfWidth, 2.91, 5.05], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 3.18, 0.45], [-hullHalfWidth, 1.58, 2.58], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 3.18, 8.2], [-hullHalfWidth, 1.58, 11.36], materials.paint, [0, 0, 0], 0.04);
  const bunkWindow = addWindowFrame(ship, {
    position: [-hullHalfWidth - 0.09, 1.64, 5.05],
    width: 4.2,
    height: 1.72,
    plane: 'side',
    materials,
    mullions: 1,
  });
  bunkWindow.name = 'Bunk observation window';

  // Right pressure wall: a six-metre observation bay and a long armored service run aft.
  box(ship, [0.17, 3.18, 3.4], [hullHalfWidth, 1.58, -12.78], materials.paint, [0, 0, 0], 0.04);
  box(ship, [0.17, 0.62, 6.45], [hullHalfWidth, 0.31, -7.85], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 0.58, 6.45], [hullHalfWidth, 2.96, -7.85], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 3.18, 0.42], [hullHalfWidth, 1.58, -11.28], materials.paint, [0, 0, 0], 0.03);
  box(ship, [0.17, 3.18, 20.45], [hullHalfWidth, 1.58, 5.28], materials.paint, [0, 0, 0], 0.04);
  addWindowFrame(ship, {
    position: [hullHalfWidth + 0.09, 1.62, -7.85],
    width: 6.05,
    height: 2.02,
    plane: 'side',
    materials,
    mullions: 3,
  });

  // Wide flight deck glazing and angled pressure shoulders.
  box(ship, [0.54, 3.08, 2.75], [-3.18, 1.54, -13.25], materials.darkPaint, [0, 14 * DEG, 0], 0.06);
  box(ship, [0.54, 3.08, 2.75], [3.18, 1.54, -13.25], materials.darkPaint, [0, -14 * DEG, 0], 0.06);
  addWindowFrame(ship, {
    position: [0, 1.67, deckForward - 0.03],
    width: 5.65,
    height: 2.05,
    plane: 'front',
    materials,
    mullions: 3,
  });
  box(ship, [6.25, 0.3, 0.3], [0, 0.46, deckForward + 0.1], materials.darkPaint, [-7 * DEG, 0, 0], 0.06);
  box(ship, [6.25, 0.26, 0.3], [0, 2.94, deckForward + 0.1], materials.darkPaint, [8 * DEG, 0, 0], 0.06);

  // Sensor prow, fins, comms spine, and hull plumbing visible from the cockpit.
  cylinder(ship, [0.58, 2.35], 7.2, [0, -0.72, -18.1], materials.exterior, [Math.PI / 2, 0, 0], 24);
  box(ship, [11.8, 0.12, 3.25], [0, -0.3, -18.0], materials.exterior, [0, 0, 0], 0.055);
  box(ship, [0.16, 2.2, 5.65], [0, -0.02, -18.0], materials.exterior, [3 * DEG, 0, 0], 0.035);
  tube(ship, [[-0.92, 0.24, -14.48], [-1.08, 0.56, -17.2], [-0.55, 0.22, -21.4]], 0.045, materials.copper, false, 52);
  tube(ship, [[0.92, 0.24, -14.48], [1.08, 0.56, -17.2], [0.55, 0.22, -21.4]], 0.045, materials.copper, false, 52);
  cylinder(ship, [0.05, 0.05], 1.75, [1.1, 1.02, -17.55], materials.bareMetal, [0, 0, -15 * DEG], 10);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), materials.exterior);
  dish.scale.y = 0.32;
  dish.rotation.z = -18 * DEG;
  dish.position.set(1.32, 2.0, -17.55);
  ship.add(dish);

  // Aft drive body, radiator outriggers, and engine bells establish the full ship silhouette.
  // Keep the tall radiators behind the habitation glazing so the bunk window reads as space,
  // not as a close-up of an exterior panel.
  cylinder(ship, [3.0, 3.45], 9.5, [0, 0.15, 20.15], materials.exterior, [Math.PI / 2, 0, 0], 24);
  for (let z = 15.8; z <= 24.1; z += 1.65) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.11, 8, 36), materials.bareMetal);
    ring.position.set(0, 0.15, z);
    ship.add(ring);
  }
  [-1.55, 0, 1.55].forEach((x) => {
    cylinder(ship, [0.85, 1.25], 2.25, [x, 0.04, 25.25], materials.rubber, [Math.PI / 2, 0, 0], 20);
  });
  box(ship, [16.5, 0.09, 8.4], [0, -0.9, 9.6], materials.exterior, [0, 0, 0], 0.035);
  const portRadiator = box(ship, [0.09, 3.2, 8.6], [-7.75, 0.2, 13.05], materials.exterior, [0, 0, -3 * DEG], 0.025);
  const starboardRadiator = box(ship, [0.09, 3.2, 8.6], [7.75, 0.2, 13.05], materials.exterior, [0, 0, 3 * DEG], 0.025);
  portRadiator.name = 'Port aft radiator';
  starboardRadiator.name = 'Starboard aft radiator';
  tube(ship, [[3.66, -0.35, -8], [5.2, -0.55, 2.8], [7.65, -0.2, 13.05]], 0.075, materials.bareMetal, false, 54);
  tube(ship, [[-3.66, -0.35, -8], [-5.2, -0.55, 2.8], [-7.65, -0.2, 13.05]], 0.075, materials.bareMetal, false, 54);

  // Deck plates and long central companionway.
  box(ship, [1.42, 0.018, 28.2], [0, 0.008, 0.15], materials.rubber, [0, 0, 0], 0.025, false);
  for (let z = -13.5; z <= 14.2; z += 1.12) {
    box(ship, [1.22, 0.013, 0.03], [0, 0.022, z], materials.bareMetal, [0, 0, 0], 0, false);
  }
  const floorBolts = [];
  for (let z = -14; z < 15; z += 0.62) {
    floorBolts.push([-3.29, 0.006, z], [3.29, 0.006, z]);
  }
  addBolts(ship, floorBolts, materials.bareMetal, 0.018);

  // Repeating structure makes the thirty-metre internal length legible in VR.
  for (let z = -13.7; z < 15; z += 2.45) {
    box(ship, [6.95, 0.1, 0.14], [0, ceilingHeight - 0.11, z], materials.bareMetal, [0, 0, 0], 0.02);
    box(ship, [0.11, 3.02, 0.15], [-3.43, 1.52, z], materials.bareMetal, [0, 0, 0], 0.018);
    box(ship, [0.11, 3.02, 0.15], [3.43, 1.52, z], materials.bareMetal, [0, 0, 0], 0.018);
  }
  tube(ship, [[-3.2, 3.03, -13.8], [-3.2, 3.03, 0], [-3.08, 2.96, 14.8]], 0.062, materials.copper, false, 84);
  tube(ship, [[-2.98, 3.11, -13.4], [-2.98, 3.11, 0], [-2.82, 3.0, 14.8]], 0.04, materials.bareMetal, false, 84);
  tube(ship, [[2.94, 3.08, -13.2], [3.08, 3.02, 1], [3.02, 2.96, 14.4]], 0.05, materials.rubber, false, 84);
  tube(ship, [[-3.47, 2.2, -8], [-3.18, 1.98, -5.4], [-3.42, 1.66, -3]], 0.024, materials.rubber, false, 28);

  // Emissive strips run the whole deck; only five practicals cast light for Quest performance.
  for (let z = -13; z <= 14; z += 2.7) {
    box(ship, [1.16, 0.035, 0.22], [0, ceilingHeight - 0.16, z], materials.amberGlow, [0, 0, 0], 0.045, false);
  }
  const lightPositions = [-12, -6.4, -0.8, 5.0, 10.6, 14.0];
  lightPositions.forEach((z, index) => {
    const light = new THREE.PointLight(index === 0 ? 0xffaa76 : 0xffbd86, index === 0 ? 24 : 28, 7.8, 2);
    light.position.set(index === 3 ? -0.9 : 0, ceilingHeight - 0.3, z);
    light.castShadow = index === 2;
    if (light.castShadow) {
      light.shadow.mapSize.set(768, 768);
      light.shadow.bias = -0.002;
      light.shadow.radius = 4;
    }
    ship.add(light);
    warmLights.push(light);
  });

  // Flight deck: purpose-built visual set dressing only. The composition is two
  // compact crew stations beneath a large uninterrupted forward view.
  const cockpit = new THREE.Group();
  cockpit.name = 'Long-range flight deck';
  cockpit.position.z = -7.55;
  ship.add(cockpit);

  const cockpitEnamel = materials.creamPaint.clone();
  cockpitEnamel.color.setHex(0x777b75);
  cockpitEnamel.roughness = 0.68;
  const cockpitPanel = materials.darkPaint.clone();
  cockpitPanel.color.setHex(0x24292a);
  const cockpitAmber = materials.amberGlow.clone();
  cockpitAmber.emissiveIntensity = 1.55;
  const cockpitGreen = materials.greenGlow.clone();
  cockpitGreen.emissiveIntensity = 1.15;
  const cockpitRed = materials.redGlow.clone();
  cockpitRed.emissiveIntensity = 1.25;
  const indicatorMaterials = [cockpitAmber, cockpitGreen, materials.bareMetal, cockpitAmber, cockpitRed];

  // Framing belongs to the ship, not the furniture: a pressure arch and sill make
  // the dashboard feel installed while keeping almost all of the glazing exposed.
  box(cockpit, [0.16, 2.62, 0.2], [-3.13, 1.4, -4.57], cockpitEnamel, [0, 0, -4 * DEG], 0.04);
  box(cockpit, [0.16, 2.62, 0.2], [3.13, 1.4, -4.57], cockpitEnamel, [0, 0, 4 * DEG], 0.04);
  box(cockpit, [6.02, 0.15, 0.22], [0, 2.73, -4.57], cockpitEnamel, [0, 0, 0], 0.035);
  box(cockpit, [5.78, 0.07, 0.16], [0, 0.69, -4.73], materials.bareMetal, [0, 0, 0], 0.018);
  [-2.73, -0.46, 0.46, 2.73].forEach((x) => {
    box(cockpit, [0.024, 0.34, 0.12], [x, 0.97, -4.73], materials.bareMetal, [0, 0, 0], 0.007);
  });

  function addFrontFasteners(parent, width, height, center) {
    const points = [
      [center[0] - width / 2, center[1] - height / 2, center[2]],
      [center[0] + width / 2, center[1] - height / 2, center[2]],
      [center[0] - width / 2, center[1] + height / 2, center[2]],
      [center[0] + width / 2, center[1] + height / 2, center[2]],
    ];
    addBolts(parent, points, materials.bareMetal, 0.009);
  }

  function addStationPod({ x, title, subtitle, mode, seed, mirrored = false }) {
    const pod = new THREE.Group();
    pod.name = `${title} instrument pod`;
    pod.position.x = x;
    cockpit.add(pod);

    // Layered casing, inset fascia and glare hood.
    box(pod, [1.58, 0.42, 0.66], [0, 0.36, -4.66], cockpitEnamel, [0, 0, 0], 0.065);
    box(pod, [1.45, 0.5, 0.085], [0, 0.93, -4.72], cockpitPanel, [-3 * DEG, 0, 0], 0.032);
    box(pod, [1.5, 0.055, 0.42], [0, 1.22, -4.57], materials.rubber, [-6 * DEG, 0, 0], 0.022);
    box(pod, [1.4, 0.035, 0.58], [0, 0.63, -4.38], materials.bareMetal, [-8 * DEG, 0, 0], 0.012);
    box(pod, [1.34, 0.024, 0.53], [0, 0.665, -4.37], cockpitPanel, [-8 * DEG, 0, 0], 0.008);

    const screenX = mirrored ? 0.18 : -0.18;
    addScreen(pod, {
      position: [screenX, 0.96, -4.665],
      rotation: [-3 * DEG, 0, 0],
      size: [0.74, 0.285],
      bezel: 0.027,
      depth: 0.035,
      seed,
      mode,
      materials,
      screenAnimations,
    });

    // A small optical repeater and two analogue standby instruments occupy the
    // outboard bay; no element is larger than a hand.
    const outboard = mirrored ? -0.53 : 0.53;
    addScreen(pod, {
      position: [outboard, 1.02, -4.66],
      rotation: [-3 * DEG, 0, 0],
      size: [0.205, 0.15],
      bezel: 0.022,
      depth: 0.03,
      seed: seed + 9,
      mode: mirrored ? 'nav' : 'amber',
      materials,
      screenAnimations,
    });
    [-0.06, 0.06].forEach((offset, gaugeIndex) => {
      const gaugeX = outboard + offset;
      cylinder(pod, [0.036, 0.036], 0.025, [gaugeX, 0.83, -4.66], materials.rubber, [Math.PI / 2, 0, 0], 20, false);
      cylinder(
        pod,
        [0.025, 0.025],
        0.026,
        [gaugeX, 0.83, -4.642],
        gaugeIndex ? cockpitGreen : cockpitAmber,
        [Math.PI / 2, 0, 0],
        20,
        false,
      );
    });

    // Tactile keys are 18–22 mm across, with restrained status lamps and screws.
    for (let index = 0; index < 8; index += 1) {
      const keyX = screenX - 0.315 + index * 0.09;
      box(pod, [0.024, 0.016, 0.012], [keyX, 0.765, -4.655], index === 1 ? cockpitGreen : materials.rubber, [0, 0, 0], 0.004, false);
    }
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const controlX = -0.2 + column * 0.1;
        const controlZ = -4.49 + row * 0.17;
        box(pod, [0.026, 0.012, 0.035], [controlX, 0.69, controlZ], materials.rubber, [0, 0, 0], 0.006, false);
        cylinder(
          pod,
          [0.005, 0.005],
          0.025,
          [controlX, 0.715, controlZ],
          materials.bareMetal,
          [0, 0, (column % 2 ? -10 : 10) * DEG],
          6,
          false,
        );
      }
    }
    for (let index = 0; index < 6; index += 1) {
      cylinder(
        pod,
        [0.008, 0.008],
        0.009,
        [0.33 + index * 0.075, 0.69, -4.43],
        indicatorMaterials[index % indicatorMaterials.length],
        [0, 0, 0],
        8,
        false,
      );
    }

    addLabel(pod, {
      title,
      subtitle,
      position: [0, 1.3, -4.69],
      size: [0.67, 0.085],
      align: 'center',
      accent: mirrored ? '#72a69f' : '#b67a52',
    });
    addFrontFasteners(pod, 1.3, 0.39, [0, 0.93, -4.655]);
  }

  addStationPod({
    x: -1.3,
    title: 'FLIGHT',
    subtitle: 'ATTITUDE / VECTOR / TRIM',
    mode: 'attitude',
    seed: 2,
  });
  addStationPod({
    x: 1.3,
    title: 'NAVIGATION',
    subtitle: 'SURVEY / RANGE / COMMS',
    mode: 'systems',
    seed: 4,
    mirrored: true,
  });

  // Narrow central reference stack links the two stations without filling the view.
  box(cockpit, [0.52, 0.56, 0.5], [0, 0.41, -4.64], cockpitEnamel, [0, 0, 0], 0.05);
  box(cockpit, [0.45, 0.49, 0.075], [0, 0.95, -4.715], cockpitPanel, [-3 * DEG, 0, 0], 0.025);
  addScreen(cockpit, {
    position: [0, 1.0, -4.67],
    rotation: [-3 * DEG, 0, 0],
    size: [0.29, 0.25],
    bezel: 0.025,
    depth: 0.035,
    seed: 3,
    mode: 'nav',
    materials,
    screenAnimations,
  });
  for (let index = 0; index < 5; index += 1) {
    box(
      cockpit,
      [0.045, 0.018, 0.018],
      [-0.12 + index * 0.06, 0.76, -4.67],
      indicatorMaterials[index],
      [0, 0, 0],
      0.005,
      false,
    );
  }
  addLabel(cockpit, {
    title: 'REFERENCE',
    subtitle: 'INERTIAL / MASTER',
    position: [0, 1.215, -4.69],
    size: [0.34, 0.07],
    align: 'center',
  });

  // Outer side consoles wrap the seats, with dense but physically modest hardware.
  [-1, 1].forEach((side) => {
    const consoleX = side * 2.02;
    box(cockpit, [0.43, 0.47, 1.72], [consoleX, 0.32, -3.48], cockpitEnamel, [0, side * -4 * DEG, 0], 0.06);
    box(cockpit, [0.37, 0.035, 1.56], [consoleX, 0.575, -3.5], cockpitPanel, [-5 * DEG, side * -4 * DEG, 0], 0.012);
    box(cockpit, [0.31, 0.025, 0.42], [consoleX, 0.605, -3.92], materials.rubber, [-5 * DEG, 0, 0], 0.01);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const localX = consoleX - side * 0.105 + side * column * 0.07;
        const localZ = -3.58 + row * 0.16;
        box(cockpit, [0.022, 0.012, 0.032], [localX, 0.61, localZ], materials.rubber, [0, 0, 0], 0.005, false);
        cylinder(cockpit, [0.0045, 0.0045], 0.024, [localX, 0.635, localZ], materials.bareMetal, [0, 0, (row % 2 ? -8 : 8) * DEG], 6, false);
      }
    }
    for (let index = 0; index < 5; index += 1) {
      box(
        cockpit,
        [0.018, 0.01, 0.028],
        [consoleX, 0.615, -2.98 + index * 0.08],
        indicatorMaterials[(index + (side > 0 ? 1 : 0)) % indicatorMaterials.length],
        [0, 0, 0],
        0.004,
        false,
      );
    }
    addLabel(cockpit, {
      title: side < 0 ? 'POWER' : 'SENSOR',
      subtitle: side < 0 ? 'BUS / AUXILIARY' : 'OPTICS / ARRAY',
      position: [consoleX, 0.615, -4.12],
      rotation: [-Math.PI / 2, 0, side * -4 * DEG],
      size: [0.27, 0.065],
      align: 'center',
      accent: side < 0 ? '#b67a52' : '#72a69f',
    });
  });

  // Low centre pedestal: two small throttle handles, trim wheel and wrist rest.
  box(cockpit, [0.34, 0.38, 1.16], [0, 0.26, -3.45], cockpitEnamel, [-3 * DEG, 0, 0], 0.045);
  box(cockpit, [0.29, 0.035, 1.04], [0, 0.475, -3.46], cockpitPanel, [-3 * DEG, 0, 0], 0.012);
  box(cockpit, [0.22, 0.045, 0.2], [0, 0.51, -2.99], materials.rubber, [-3 * DEG, 0, 0], 0.02);
  [-0.065, 0.065].forEach((x, index) => {
    cylinder(cockpit, [0.008, 0.008], 0.13, [x, 0.56, -3.65], materials.bareMetal, [0, 0, (index ? -5 : 5) * DEG], 8);
    box(cockpit, [0.035, 0.027, 0.055], [x + (index ? -0.006 : 0.006), 0.635, -3.65], materials.rubber, [0, 0, 0], 0.01);
  });
  const trimWheel = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 20), materials.rubber);
  trimWheel.rotation.x = Math.PI / 2;
  trimWheel.position.set(0, 0.505, -3.28);
  cockpit.add(trimWheel);
  for (let index = 0; index < 5; index += 1) {
    cylinder(cockpit, [0.007, 0.007], 0.008, [-0.1 + index * 0.05, 0.51, -3.9], indicatorMaterials[index], [0, 0, 0], 8, false);
  }

  // Two genuinely human-sized seats, aligned squarely with their instrument pods.
  const pilotSeat = createCockpitSeat(materials, '01');
  pilotSeat.name = 'Port cockpit seat';
  pilotSeat.position.set(-1.2, 0, -2.96);
  cockpit.add(pilotSeat);
  const navigatorSeat = createCockpitSeat(materials, '02');
  navigatorSeat.name = 'Starboard cockpit seat';
  navigatorSeat.position.set(1.2, 0, -2.96);
  cockpit.add(navigatorSeat);

  // Slim sidesticks and separate rudder pedals complete the visual language.
  [-1, 1].forEach((side) => {
    const stickX = side * 1.58;
    cylinder(cockpit, [0.028, 0.04], 0.035, [stickX, 0.57, -3.48], materials.rubber, [0, 0, 0], 12);
    cylinder(cockpit, [0.009, 0.009], 0.14, [stickX, 0.65, -3.48], materials.bareMetal, [0, 0, side * -7 * DEG], 8);
    box(cockpit, [0.045, 0.085, 0.05], [stickX + side * -0.01, 0.73, -3.48], materials.rubber, [0, 0, side * -7 * DEG], 0.016);
    [-0.11, 0.11].forEach((offset) => {
      box(cockpit, [0.115, 0.026, 0.22], [side * 1.2 + offset, 0.075, -4.08], materials.rubber, [-14 * DEG, 0, 0], 0.016);
      box(cockpit, [0.018, 0.08, 0.15], [side * 1.2 + offset, 0.12, -4.0], materials.bareMetal, [-14 * DEG, 0, 0], 0.006);
    });
  });

  // A shallow overhead panel adds cockpit density when looking up, without
  // blocking the panoramic glass or becoming a wall of glowing buttons.
  box(cockpit, [3.25, 0.17, 0.5], [0, 2.6, -4.23], cockpitEnamel, [0, 0, 0], 0.045);
  box(cockpit, [3.08, 0.025, 0.4], [0, 2.5, -4.23], cockpitPanel, [0, 0, 0], 0.009);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const x = -1.26 + column * 0.23;
      const z = -4.36 + row * 0.13;
      box(cockpit, [0.025, 0.012, 0.038], [x, 2.475, z], materials.rubber, [0, 0, 0], 0.005, false);
      if ((column + row) % 4 === 0) {
        box(cockpit, [0.012, 0.008, 0.018], [x + 0.045, 2.472, z], cockpitAmber, [0, 0, 0], 0.003, false);
      }
    }
  }
  box(cockpit, [1.18, 0.025, 0.035], [-1.72, 2.46, -4.4], cockpitAmber, [0, 0, 0], 0.008, false);
  box(cockpit, [1.18, 0.025, 0.035], [1.72, 2.46, -4.4], cockpitAmber, [0, 0, 0], 0.008, false);

  // Soft pool of instrument light ties the furniture together at night.
  const instrumentFill = new THREE.PointLight(0xc76f45, 4.5, 3.2, 2);
  instrumentFill.position.set(0, 1.25, -4.05);
  cockpit.add(instrumentFill);

  // Observation lounge with worn couch, table, physical radio, and personal effects.
  const lounge = new THREE.Group();
  lounge.position.set(-0.72, 0, -5.1);
  ship.add(lounge);
  box(lounge, [0.68, 0.22, 2.15], [-2.02, 0.43, 0.35], materials.fabric, [0, 0, 0], 0.12);
  box(lounge, [0.2, 0.78, 2.15], [-2.38, 0.77, 0.35], materials.fabric, [0, 0, -4 * DEG], 0.11);
  box(lounge, [0.7, 0.18, 0.2], [-2.0, 0.56, -0.7], materials.fabric, [0, 0, 0], 0.07);
  box(lounge, [0.7, 0.18, 0.2], [-2.0, 0.56, 1.4], materials.fabric, [0, 0, 0], 0.07);
  box(lounge, [0.76, 0.055, 0.92], [-0.82, 0.63, 0.15], materials.darkPaint, [0, 0, 0], 0.045);
  cylinder(lounge, [0.05, 0.05], 0.58, [-0.82, 0.31, 0.15], materials.bareMetal, [0, 0, 0], 10);
  box(lounge, [1.28, 0.028, 2.8], [0.25, 0.025, 0.15], materials.blanket, [0, 0, 0], 0.02, false);

  const mug = createMug(materials);
  mug.position.set(-0.67, 0.75, 0.05);
  lounge.add(mug);
  grabbables.push(mug);
  const journal = createJournal(materials);
  journal.position.set(-0.94, 0.69, 0.35);
  journal.rotation.y = 11 * DEG;
  lounge.add(journal);
  grabbables.push(journal);

  const radio = new THREE.Group();
  radio.position.set(-2.18, 1.36, 1.22);
  radio.rotation.y = Math.PI / 2;
  lounge.add(radio);
  box(radio, [0.62, 0.38, 0.25], [0, 0, 0], materials.darkPaint, [0, 0, 0], 0.055);
  cylinder(radio, [0.11, 0.11], 0.025, [-0.16, 0, -0.138], materials.rubber, [Math.PI / 2, 0, 0], 20, false);
  for (let index = -2; index <= 2; index += 1) {
    box(radio, [0.018, 0.17, 0.025], [-0.16 + index * 0.032, 0, -0.158], materials.bareMetal, [0, 0, 0], 0, false);
  }
  box(radio, [0.22, 0.11, 0.025], [0.13, 0.04, -0.158], materials.screen, [0, 0, 0], 0.01, false);
  const radioButton = createControlButton(radio, [0.23, -0.1, -0.16], [Math.PI / 2, 0, 0], materials, 'SHIP RADIO');
  interactables.push(radioButton);
  const radioAnchor = new THREE.Object3D();
  radioAnchor.position.set(-0.16, 0, -0.2);
  radio.add(radioAnchor);

  // Bunk nook: soft material, small window, reading light, shelf, photographs.
  const bunk = new THREE.Group();
  bunk.position.set(-0.82, 0, 2.1);
  ship.add(bunk);
  box(bunk, [1.22, 0.16, 2.25], [-1.82, 0.43, 3.48], materials.darkPaint, [0, 0, 0], 0.06);
  box(bunk, [1.12, 0.15, 2.1], [-1.82, 0.57, 3.48], materials.fabric, [0, 0, 0], 0.11);
  box(bunk, [0.86, 0.055, 1.25], [-1.76, 0.66, 3.78], materials.blanket, [0, 0, -2 * DEG], 0.035);
  box(bunk, [0.5, 0.14, 0.34], [-1.83, 0.71, 2.72], materials.creamPaint, [0, 0, 0], 0.09);
  box(bunk, [1.1, 0.08, 0.28], [-1.85, 1.96, 3.92], materials.darkPaint, [0, 0, 0], 0.025);
  box(bunk, [0.28, 0.32, 0.21], [-2.32, 1.38, 2.68], materials.darkPaint, [0, 0, 0], 0.035);
  box(bunk, [0.13, 0.035, 0.1], [-2.19, 1.42, 2.68], materials.amberGlow, [0, 0, 0], 0.025, false);
  const readingLight = new THREE.PointLight(0xffa86d, 8, 2.2, 2);
  readingLight.position.set(-2.05, 1.36, 2.68);
  bunk.add(readingLight);

  addLabel(bunk, {
    title: 'LRSV-07',
    subtitle: 'THE DISTANCE IS THE MISSION',
    position: [-2.467, 1.0, 2.5],
    rotation: [0, Math.PI / 2, 0],
    size: [0.72, 0.23],
  });
  addLabel(bunk, {
    title: '1419',
    subtitle: 'DAYS OUTBOUND',
    position: [-2.466, 1.88, 4.25],
    rotation: [0, Math.PI / 2, 0],
    size: [0.46, 0.18],
    accent: '#72b8ae',
  });

  // Utility bench, tool wall, storage, cabling, and maintenance clutter.
  const utility = new THREE.Group();
  utility.position.set(0.84, 0, 5.5);
  ship.add(utility);
  box(utility, [1.42, 0.14, 2.25], [1.71, 0.83, 3.47], materials.bareMetal, [0, 0, 0], 0.045);
  box(utility, [1.25, 0.75, 0.08], [1.75, 1.35, 4.56], materials.darkPaint, [0, 0, 0], 0.03);
  box(utility, [1.33, 0.72, 0.55], [1.74, 0.4, 3.05], materials.darkPaint, [0, 0, 0], 0.055);
  box(utility, [1.33, 0.72, 0.55], [1.74, 0.4, 3.72], materials.darkPaint, [0, 0, 0], 0.055);
  addVent(utility, [1.75, 1.42, 4.51], [0, 0, 0], materials, 0.66);
  const wrench = createWrench(materials);
  wrench.position.set(1.45, 0.98, 3.62);
  wrench.rotation.set(0, 23 * DEG, 82 * DEG);
  utility.add(wrench);
  grabbables.push(wrench);
  for (let index = 0; index < 4; index += 1) {
    cylinder(utility, [0.035, 0.035], 0.36, [1.23 + index * 0.31, 1.35 + (index % 2) * 0.18, 4.49], index % 2 ? materials.copper : materials.bareMetal, [Math.PI / 2, 0, 0], 10);
  }
  tube(utility, [[1.15, 1.72, 4.48], [1.3, 1.88, 4.37], [1.18, 2.13, 4.5]], 0.018, materials.redGlow, false, 16);
  tube(utility, [[1.45, 1.72, 4.48], [1.62, 1.9, 4.36], [1.53, 2.18, 4.49]], 0.018, materials.rubber, false, 16);
  addStorageCrate(ship, [3.08, 0.29, 7.35], [0, -Math.PI / 2, 0], materials, 'L-04');
  addStorageCrate(ship, [-3.08, 0.29, -2.25], [0, Math.PI / 2, 0], materials, 'O2');

  // Galley and mess occupy a full bay opposite the bunk rather than being squeezed into furniture scale.
  const galley = new THREE.Group();
  galley.position.set(0.82, 0, 0.3);
  ship.add(galley);
  box(galley, [1.16, 0.12, 3.3], [1.97, 0.86, 2.9], materials.bareMetal, [0, 0, 0], 0.04);
  box(galley, [1.05, 0.78, 0.65], [2.03, 0.42, 2.05], materials.darkPaint, [0, 0, 0], 0.06);
  box(galley, [1.05, 0.78, 0.65], [2.03, 0.42, 3.0], materials.darkPaint, [0, 0, 0], 0.06);
  box(galley, [1.05, 0.78, 0.65], [2.03, 0.42, 3.95], materials.darkPaint, [0, 0, 0], 0.06);
  box(galley, [1.12, 0.75, 0.09], [2.01, 1.43, 4.44], materials.darkPaint, [0, 0, 0], 0.035);
  box(galley, [0.48, 0.04, 0.68], [2.0, 0.94, 3.17], materials.rubber, [0, 0, 0], 0.02);
  cylinder(galley, [0.11, 0.14], 0.2, [1.82, 1.04, 2.55], materials.copper, [0, 0, 0], 16);
  tube(galley, [[1.77, 1.15, 2.5], [1.74, 1.32, 2.47], [1.9, 1.35, 2.5]], 0.018, materials.bareMetal, false, 12);
  addLabel(galley, {
    title: 'GALLEY / 02',
    subtitle: 'PLEASE CLEAN FILTER AFTER USE',
    position: [2.585, 1.6, 4.1],
    rotation: [0, -Math.PI / 2, 0],
    size: [0.78, 0.23],
  });

  // Empty cargo and spare-crew volume makes it obvious the ship is not purpose-built for one body.
  const cargo = new THREE.Group();
  ship.add(cargo);
  for (let row = 0; row < 3; row += 1) {
    box(cargo, [0.09, 2.55, 2.1], [-3.18, 1.28, 10.45 + row * 1.45], materials.bareMetal, [0, 0, 0], 0.02);
    box(cargo, [0.78, 0.08, 2.1], [-2.78, 0.48, 10.45 + row * 1.45], materials.darkPaint, [0, 0, 0], 0.025);
    box(cargo, [0.78, 0.08, 2.1], [-2.78, 1.42, 10.45 + row * 1.45], materials.darkPaint, [0, 0, 0], 0.025);
    box(cargo, [0.78, 0.08, 2.1], [-2.78, 2.32, 10.45 + row * 1.45], materials.darkPaint, [0, 0, 0], 0.025);
  }
  addStorageCrate(cargo, [-2.75, 0.76, 10.05], [0, Math.PI / 2, 0], materials, 'S-12');
  addStorageCrate(cargo, [-2.75, 1.72, 11.45], [0, Math.PI / 2, 0], materials, 'VAC');
  addStorageCrate(cargo, [-2.75, 0.76, 12.78], [0, Math.PI / 2, 0], materials, 'H2O');

  // Broad pressure arches separate flight, habitation, service, and airlock zones.
  [-9.9, 1.05, 8.1, 13.25].forEach((z, index) => {
    const archMaterial = index === 3 ? materials.exterior : materials.darkPaint;
    box(ship, [1.85, 3.0, 0.24], [-2.65, 1.5, z], archMaterial, [0, 0, 0], 0.045);
    box(ship, [1.85, 3.0, 0.24], [2.65, 1.5, z], archMaterial, [0, 0, 0], 0.045);
    box(ship, [3.55, 0.52, 0.24], [0, 2.75, z], archMaterial, [0, 0, 0], 0.045);
    box(ship, [3.55, 0.24, 0.24], [0, 0.12, z], archMaterial, [0, 0, 0], 0.035);
  });

  // Airlock vestibule and inner sliding pressure door.
  const airlock = new THREE.Group();
  airlock.position.z = 8.55;
  ship.add(airlock);
  box(airlock, [1.22, 2.55, 0.18], [-1.95, 1.27, 4.92], materials.darkPaint, [0, 0, 0], 0.03);
  box(airlock, [1.22, 2.55, 0.18], [1.95, 1.27, 4.92], materials.darkPaint, [0, 0, 0], 0.03);
  box(airlock, [2.75, 0.42, 0.18], [0, 2.35, 4.92], materials.darkPaint, [0, 0, 0], 0.03);
  box(airlock, [2.75, 0.36, 0.18], [0, 0.18, 4.92], materials.darkPaint, [0, 0, 0], 0.03);
  const innerDoor = new THREE.Group();
  innerDoor.position.z = 4.9;
  airlock.add(innerDoor);
  box(innerDoor, [2.3, 2.02, 0.13], [0, 1.23, 0], materials.exterior, [0, 0, 0], 0.15);
  box(innerDoor, [1.82, 1.56, 0.05], [0, 1.23, -0.08], materials.darkPaint, [0, 0, 0], 0.12);
  tube(innerDoor, [[-0.73, 0.57, -0.11], [0, 0.42, -0.11], [0.73, 0.57, -0.11]], 0.028, materials.copper, false, 24);
  addLabel(innerDoor, {
    title: 'AIRLOCK',
    subtitle: 'CYCLE BEFORE OPENING',
    position: [0, 1.55, -0.12],
    size: [0.82, 0.27],
    align: 'center',
  });
  const doorButton = createControlButton(airlock, [1.48, 1.2, 4.77], [Math.PI / 2, 0, 0], materials, 'INNER AIRLOCK');
  interactables.push(doorButton);
  box(airlock, [0.24, 0.42, 0.11], [1.48, 1.2, 4.84], materials.rubber, [0, 0, 0], 0.035);

  // Dim vestibule with exterior pressure door and a small porthole to the hull.
  box(airlock, [7.05, 0.14, 1.45], [0, -0.09, 5.62], materials.floor, [0, 0, 0], 0.04);
  box(airlock, [0.15, 3.18, 1.45], [-3.58, 1.58, 5.62], materials.darkPaint, [0, 0, 0], 0.025);
  box(airlock, [0.15, 3.18, 1.45], [3.58, 1.58, 5.62], materials.darkPaint, [0, 0, 0], 0.025);
  box(airlock, [7.05, 3.18, 0.16], [0, 1.58, 6.28], materials.darkPaint, [0, 0, 0], 0.025);
  const outerDoor = cylinder(airlock, [1.08, 1.08], 0.15, [0, 1.25, 6.16], materials.exterior, [Math.PI / 2, 0, 0], 12);
  cylinder(airlock, [0.4, 0.4], 0.19, [0, 1.34, 6.04], materials.darkPaint, [Math.PI / 2, 0, 0], 16);
  const porthole = cylinder(airlock, [0.3, 0.3], 0.02, [0, 1.34, 5.94], materials.glass, [Math.PI / 2, 0, 0], 24, false);
  porthole.renderOrder = 4;
  outerDoor.userData.outerDoor = true;
  box(airlock, [0.64, 0.055, 0.18], [0, 2.42, 5.58], materials.redGlow, [0, 0, 0], 0.03, false);
  const airlockLight = new THREE.PointLight(0xd75b46, 8, 2.4, 2);
  airlockLight.position.set(0, 2.22, 5.55);
  airlock.add(airlockLight);

  // Wall system panels and switches.
  addScreen(ship, {
    position: [-3.505, 1.55, -2.15],
    rotation: [0, Math.PI / 2, 0],
    size: [0.82, 0.47],
    seed: 6,
    mode: 'amber',
    materials,
    screenAnimations,
  });
  addVent(ship, [-3.505, 1.52, -0.9], [0, Math.PI / 2, 0], materials, 0.78);
  addVent(ship, [3.505, 1.56, -1.15], [0, -Math.PI / 2, 0], materials, 0.74);
  addLabel(ship, {
    title: 'FLIGHT DECK',
    subtitle: 'LONG-RANGE NAVIGATION / FORWARD',
    position: [3.505, 2.08, -10.55],
    rotation: [0, -Math.PI / 2, 0],
    size: [0.92, 0.27],
  });

  const lightSwitch = createControlButton(ship, [-3.515, 1.25, -0.15], [0, 0, Math.PI / 2], materials, 'CABIN LIGHTS');
  interactables.push(lightSwitch);
  box(ship, [0.09, 0.32, 0.22], [-3.5, 1.25, -0.15], materials.rubber, [0, 0, 0], 0.025);

  let doorOpen = false;
  let lightDimmed = false;
  let lastScreenUpdate = 0;
  doorButton.userData.onActivate = () => {
    doorOpen = !doorOpen;
    return doorOpen ? 'INNER AIRLOCK OPEN' : 'INNER AIRLOCK SEALED';
  };
  lightSwitch.userData.onActivate = () => {
    lightDimmed = !lightDimmed;
    warmLights.forEach((light, index) => {
      light.userData.targetIntensity = lightDimmed ? (index === 2 ? 5 : 3.5) : (index === 0 ? 19 : 24);
    });
    return lightDimmed ? 'CABIN LIGHTS: NIGHT WATCH' : 'CABIN LIGHTS: WARM';
  };

  warmLights.forEach((light) => {
    light.userData.targetIntensity = light.intensity;
  });

  const collisionObstacles = [
    new THREE.Box2(new THREE.Vector2(-3.5, -6.25), new THREE.Vector2(-2.02, -3.45)),
    new THREE.Box2(new THREE.Vector2(-3.48, 4.15), new THREE.Vector2(-2.0, 7.0)),
    new THREE.Box2(new THREE.Vector2(2.1, 1.7), new THREE.Vector2(3.5, 4.7)),
    new THREE.Box2(new THREE.Vector2(2.0, 8.0), new THREE.Vector2(3.5, 10.55)),
    new THREE.Box2(new THREE.Vector2(-3.5, 9.15), new THREE.Vector2(-2.18, 14.1)),
    new THREE.Box2(new THREE.Vector2(-1.68, -11.5), new THREE.Vector2(-0.63, -10.45)),
    new THREE.Box2(new THREE.Vector2(0.63, -11.5), new THREE.Vector2(1.68, -10.45)),
    new THREE.Box2(new THREE.Vector2(-2.95, -13.15), new THREE.Vector2(2.95, -11.9)),
    new THREE.Box2(new THREE.Vector2(-3.45, -13.85), new THREE.Vector2(-2.2, -11.2)),
    new THREE.Box2(new THREE.Vector2(2.2, -13.85), new THREE.Vector2(3.45, -11.2)),
  ];

  function constrainPlayer(position, previous) {
    position.x = THREE.MathUtils.clamp(position.x, -3.18, 3.18);
    position.z = THREE.MathUtils.clamp(position.z, -13.92, doorOpen ? 14.82 : 12.92);
    const radius = 0.24;
    const point = new THREE.Vector2(position.x, position.z);
    for (const obstacle of collisionObstacles) {
      const expanded = obstacle.clone().expandByScalar(radius);
      if (!expanded.containsPoint(point)) continue;
      const left = Math.abs(point.x - expanded.min.x);
      const right = Math.abs(expanded.max.x - point.x);
      const back = Math.abs(point.y - expanded.min.y);
      const front = Math.abs(expanded.max.y - point.y);
      const nearest = Math.min(left, right, back, front);
      if (nearest === left) position.x = expanded.min.x;
      else if (nearest === right) position.x = expanded.max.x;
      else if (nearest === back) position.z = expanded.min.y;
      else position.z = expanded.max.y;
    }

    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) position.copy(previous);
  }

  function update(delta, elapsed) {
    innerDoor.position.x = THREE.MathUtils.damp(innerDoor.position.x, doorOpen ? -2.25 : 0, 5.2, delta);
    warmLights.forEach((light) => {
      light.intensity = THREE.MathUtils.damp(light.intensity, light.userData.targetIntensity, 4, delta);
    });
    readingLight.intensity = 7.5 + Math.sin(elapsed * 2.7) * 0.18;
    airlockLight.intensity = 7.4 + Math.sin(elapsed * 1.65) * 0.55;
    if (elapsed - lastScreenUpdate > 0.18) {
      screenAnimations.forEach((screen) => screen.draw(elapsed * 1000));
      lastScreenUpdate = elapsed;
    }
  }

  return {
    group: ship,
    interactables,
    grabbables,
    radioAnchor,
    radioButton,
    warmLights,
    constrainPlayer,
    update,
  };
}
