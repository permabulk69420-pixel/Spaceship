import * as THREE from 'three';

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function makeNebulaTexture(seed, {
  colors,
  dust = [8, 7, 12],
  pillar = false,
  density = 1,
  stars = 80,
} = {}) {
  const random = mulberry32(seed);
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  context.globalCompositeOperation = 'screen';

  const cloudCount = Math.floor((pillar ? 260 : 210) * density);
  for (let index = 0; index < cloudCount; index += 1) {
    const progress = random();
    const color = colors[Math.floor(random() * colors.length)];
    let x;
    let y;
    let radiusX;
    let radiusY;

    if (pillar) {
      const lane = index % 3;
      const laneX = [0.32, 0.52, 0.68][lane];
      y = size * (0.04 + progress * 0.94);
      x = size * (laneX + Math.sin(progress * 11 + lane * 2.4) * (0.045 + random() * 0.035));
      radiusX = size * (0.055 + random() * 0.105) * (1 - progress * 0.22);
      radiusY = radiusX * (1.1 + random() * 2.2);
    } else {
      x = size * (0.03 + random() * 0.94);
      y = size * (0.06 + random() * 0.88);
      const band = Math.sin((x / size) * 8 + seed) * size * 0.1;
      y = y * 0.52 + size * 0.24 + band + random() * size * 0.19;
      radiusX = size * (0.06 + random() * 0.18);
      radiusY = radiusX * (0.55 + random() * 1.15);
    }

    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 1.5);
    context.scale(1, radiusY / radiusX);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    gradient.addColorStop(0, rgba(color, 0.045 + random() * 0.09));
    gradient.addColorStop(0.28, rgba(color, 0.03 + random() * 0.065));
    gradient.addColorStop(0.72, rgba(color, 0.008 + random() * 0.03));
    gradient.addColorStop(1, rgba(color, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radiusX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Dense luminous rims at the edge of cold, almost-black dust lanes.
  context.globalCompositeOperation = 'source-over';
  const laneCount = pillar ? 58 : 34;
  for (let index = 0; index < laneCount; index += 1) {
    const y = random() * size;
    const x = pillar
      ? size * ([0.35, 0.54, 0.7][index % 3] + Math.sin(y * 0.018 + seed) * 0.04)
      : random() * size;
    const radius = size * (0.025 + random() * (pillar ? 0.085 : 0.13));
    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 1.4);
    context.scale(1, 1.2 + random() * 3.2);
    const shadow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    shadow.addColorStop(0, rgba(dust, 0.28 + random() * 0.36));
    shadow.addColorStop(0.65, rgba(dust, 0.12 + random() * 0.2));
    shadow.addColorStop(1, rgba(dust, 0));
    context.fillStyle = shadow;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < stars; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = random() > 0.92 ? 1.8 : 0.65;
    const alpha = 0.18 + random() * 0.64;
    context.fillStyle = `rgba(235,238,229,${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  // Feather the rectangular texture boundary so distant layers never read as cards.
  context.globalCompositeOperation = 'destination-in';
  const edge = context.createRadialGradient(size / 2, size / 2, size * 0.19, size / 2, size / 2, size * 0.69);
  edge.addColorStop(0, 'rgba(255,255,255,1)');
  edge.addColorStop(0.68, 'rgba(255,255,255,.9)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = edge;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function makeSoftDiscTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,255,255,.85)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function addNebulaPlane(parent, texture, position, scale, color = 0xffffff, opacity = 1, rotation = 0) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), material);
  mesh.position.set(...position);
  mesh.lookAt(0, 1, 0);
  mesh.rotateZ(rotation);
  mesh.renderOrder = -8;
  parent.add(mesh);
  return mesh;
}

function createStarField({ count, minRadius, maxRadius, size, seed, tint = 0xffffff, opacity = 1 }) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const warm = new THREE.Color(0xffd6b8);
  const cool = new THREE.Color(0xb8d4ff);
  const white = new THREE.Color(tint);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radial = Math.sqrt(1 - y * y);
    const radius = minRadius + Math.pow(random(), 0.72) * (maxRadius - minRadius);
    positions[index * 3] = Math.cos(angle) * radial * radius;
    positions[index * 3 + 1] = y * radius;
    positions[index * 3 + 2] = Math.sin(angle) * radial * radius;

    const choice = random();
    color.copy(choice > 0.94 ? warm : choice < 0.06 ? cool : white);
    const luminosity = 0.5 + random() * 0.5;
    colors[index * 3] = color.r * luminosity;
    colors[index * 3 + 1] = color.g * luminosity;
    colors[index * 3 + 2] = color.b * luminosity;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    vertexColors: true,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Points(geometry, material);
}

function createDustField() {
  const count = 620;
  const random = mulberry32(4242);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 8 + random() * 66;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -12 + random() * 29;
    positions[index * 3 + 2] = -54 + random() * 108;
    phases[index] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd8b59c,
    size: 0.045,
    transparent: true,
    opacity: 0.32,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.phases = phases;
  return points;
}

function createCloudPillars(texture) {
  const group = new THREE.Group();
  const random = mulberry32(808);
  const colors = [0x6f241b, 0x9d4c2d, 0xc7834e, 0x493047, 0x26202f];
  const lanes = [
    { x: -340, z: 45, lean: 0.1, height: 620 },
    { x: -245, z: -105, lean: -0.16, height: 760 },
    { x: -140, z: 70, lean: 0.08, height: 510 },
  ];

  lanes.forEach((lane, laneIndex) => {
    const puffCount = 15 + laneIndex * 3;
    for (let index = 0; index < puffCount; index += 1) {
      const t = index / (puffCount - 1);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: colors[(index + laneIndex) % colors.length],
        transparent: true,
        opacity: 0.11 + random() * 0.18,
        depthWrite: false,
        blending: index % 4 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(
        lane.x + Math.sin(t * 10 + laneIndex) * (24 + random() * 22) + lane.lean * t * lane.height,
        -260 + t * lane.height,
        lane.z + (random() - 0.5) * 95,
      );
      const width = 85 + random() * 125;
      sprite.scale.set(width, width * (1.05 + random() * 1.25), 1);
      sprite.renderOrder = -4;
      group.add(sprite);
    }
  });
  group.position.set(0, 0, -440);
  return group;
}

function createPlanet() {
  const uniforms = {
    lightDirection: { value: new THREE.Vector3(-0.55, 0.2, 0.82).normalize() },
    atmosphereColor: { value: new THREE.Color(0xc47b68) },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 lightDirection;
      varying vec3 vNormal;
      varying vec3 vPosition;
      float bands(float y, float x) {
        return sin(y * 0.047 + sin(x * 0.021) * 2.4) * 0.5 + 0.5;
      }
      void main() {
        float stripe = bands(vPosition.y, vPosition.x) * 0.55 + bands(vPosition.y * 2.8, vPosition.z) * 0.22;
        float storm = smoothstep(0.72, 0.98, sin(vPosition.x * 0.028 + vPosition.y * 0.018) * 0.5 + 0.5);
        vec3 darkBand = vec3(0.10, 0.055, 0.075);
        vec3 lightBand = vec3(0.42, 0.18, 0.14);
        vec3 color = mix(darkBand, lightBand, stripe) + storm * vec3(0.15, 0.055, 0.03);
        float diffuse = max(dot(vNormal, lightDirection), 0.0);
        float night = pow(max(dot(vNormal, lightDirection), 0.0), 0.64);
        float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
        gl_FragColor = vec4(color * (0.025 + night * 1.55) + vec3(0.12, 0.035, 0.025) * rim * diffuse, 1.0);
      }
    `,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(230, 48, 32), surface);
  planet.position.set(860, -84, -365);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(237, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 atmosphereColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(max(0.0, 0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
          gl_FragColor = vec4(atmosphereColor, intensity * 0.62);
        }
      `,
    }),
  );
  atmosphere.position.copy(planet.position);
  const group = new THREE.Group();
  group.add(planet, atmosphere);
  return group;
}

function createDarkMoon() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x17151a,
    roughness: 1,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float ridges = sin(vViewPosition.x * 0.19) * sin(vViewPosition.y * 0.17) * 0.035;
       diffuseColor.rgb += ridges;`,
    );
  };
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(54, 5), material);
  moon.position.set(205, 68, -340);
  return moon;
}

export function createSpaceEnvironment() {
  const environment = new THREE.Group();
  environment.name = 'Kestrel Drift';

  const farStars = createStarField({ count: 5200, minRadius: 720, maxRadius: 2400, size: 0.72, seed: 4, opacity: 0.82 });
  const brightStars = createStarField({ count: 420, minRadius: 460, maxRadius: 1900, size: 1.65, seed: 17, tint: 0xfff3dc, opacity: 0.94 });
  const middleStars = createStarField({ count: 1050, minRadius: 160, maxRadius: 680, size: 0.8, seed: 31, tint: 0xcbd9ea, opacity: 0.53 });
  environment.add(farStars, brightStars, middleStars);

  const emberTexture = makeNebulaTexture(91, {
    colors: [[114, 35, 27], [176, 73, 38], [223, 139, 76], [94, 48, 85]],
    dust: [7, 5, 10],
    density: 1.12,
    stars: 70,
  });
  const violetTexture = makeNebulaTexture(177, {
    colors: [[56, 35, 84], [101, 52, 111], [54, 79, 107], [178, 92, 95]],
    dust: [4, 6, 14],
    density: 0.92,
    stars: 110,
  });
  const pillarTexture = makeNebulaTexture(333, {
    colors: [[143, 58, 34], [204, 112, 59], [91, 42, 64], [227, 160, 96]],
    dust: [3, 4, 7],
    pillar: true,
    density: 1.15,
    stars: 36,
  });
  const blueTexture = makeNebulaTexture(512, {
    colors: [[32, 68, 92], [58, 113, 132], [90, 79, 138], [153, 167, 172]],
    dust: [3, 7, 12],
    density: 0.76,
    stars: 150,
  });

  addNebulaPlane(environment, emberTexture, [250, 105, -1050], [1680, 1120], 0xffffff, 0.94, -0.08);
  addNebulaPlane(environment, violetTexture, [-720, 260, -1180], [1450, 960], 0xbbb8e4, 0.58, 0.21);
  addNebulaPlane(environment, pillarTexture, [-510, -20, 15], [720, 1040], 0xffd0a3, 0.9, -0.13);
  addNebulaPlane(environment, blueTexture, [90, 160, 1480], [1540, 940], 0xb9d9e8, 0.48, 0.19);

  const discTexture = makeSoftDiscTexture();
  const pillars = createCloudPillars(discTexture);
  environment.add(pillars);

  const planet = createPlanet();
  const moon = createDarkMoon();
  environment.add(planet, moon);

  const dust = createDustField();
  environment.add(dust);

  const cosmicKey = new THREE.DirectionalLight(0xe2815a, 1.85);
  cosmicKey.position.set(12, 5, -8);
  cosmicKey.castShadow = true;
  cosmicKey.shadow.mapSize.set(1024, 1024);
  cosmicKey.shadow.camera.left = -12;
  cosmicKey.shadow.camera.right = 12;
  cosmicKey.shadow.camera.top = 18;
  cosmicKey.shadow.camera.bottom = -18;
  cosmicKey.shadow.camera.near = 1;
  cosmicKey.shadow.camera.far = 90;
  cosmicKey.shadow.bias = -0.0025;
  environment.add(cosmicKey);

  const coldRim = new THREE.DirectionalLight(0x6f9cc8, 0.7);
  coldRim.position.set(-8, 7, 12);
  environment.add(coldRim);

  const planetGlow = new THREE.PointLight(0xb5543d, 2.1, 0, 2);
  planetGlow.position.set(320, 40, -140);
  environment.add(planetGlow);

  function update(delta, elapsed) {
    farStars.rotation.y = elapsed * 0.000035;
    brightStars.rotation.y = -elapsed * 0.00002;
    pillars.position.y = Math.sin(elapsed * 0.008) * 1.7;
    planet.rotation.y = elapsed * 0.00015;
    moon.rotation.y += delta * 0.004;

    const positions = dust.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      let z = positions.getZ(index) + delta * 0.34;
      if (z > 54) z = -54;
      positions.setZ(index, z);
    }
    positions.needsUpdate = true;
    dust.material.opacity = 0.28 + Math.sin(elapsed * 0.19) * 0.035;
  }

  return { group: environment, update, cosmicKey, coldRim };
}
