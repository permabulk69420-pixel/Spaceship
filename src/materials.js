import * as THREE from 'three';

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSurfaceTexture({
  size = 256,
  seed = 1,
  base = [96, 99, 98],
  variation = 18,
  flecks = 180,
  weave = false,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = mulberry32(seed);
  const image = context.createImageData(size, size);

  for (let i = 0; i < image.data.length; i += 4) {
    const pixel = i / 4;
    const x = pixel % size;
    const y = Math.floor(pixel / size);
    const woven = weave ? ((x % 4 < 2 ? 1 : -1) + (y % 5 < 2 ? 1 : -1)) * 2.6 : 0;
    const grain = (random() - 0.5) * variation + woven;
    image.data[i] = THREE.MathUtils.clamp(base[0] + grain, 0, 255);
    image.data[i + 1] = THREE.MathUtils.clamp(base[1] + grain, 0, 255);
    image.data[i + 2] = THREE.MathUtils.clamp(base[2] + grain, 0, 255);
    image.data[i + 3] = 255;
  }

  context.putImageData(image, 0, 0);

  for (let i = 0; i < flecks; i += 1) {
    const alpha = random() * 0.16;
    const radius = 0.2 + random() * 1.35;
    context.fillStyle = random() > 0.55 ? `rgba(255,245,226,${alpha})` : `rgba(3,5,7,${alpha})`;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeLabelTexture({
  title,
  subtitle = '',
  accent = '#d68351',
  background = '#101317',
  width = 512,
  height = 192,
  align = 'left',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const inset = width * 0.065;

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < height; y += 5) context.fillRect(0, y, width, 1);

  context.strokeStyle = accent;
  context.lineWidth = Math.max(3, width / 140);
  context.beginPath();
  context.moveTo(inset, height * 0.25);
  context.lineTo(width - inset, height * 0.25);
  context.stroke();

  context.textAlign = align;
  context.fillStyle = '#eadfcf';
  context.font = `600 ${Math.floor(height * 0.25)}px monospace`;
  context.letterSpacing = '4px';
  const x = align === 'center' ? width / 2 : inset;
  context.fillText(title, x, height * 0.61);

  if (subtitle) {
    context.fillStyle = 'rgba(226,217,201,0.55)';
    context.font = `500 ${Math.floor(height * 0.1)}px monospace`;
    context.fillText(subtitle, x, height * 0.79);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeScreenTexture(seed = 1, mode = 'nav') {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  const random = mulberry32(seed);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  function draw(time = 0) {
    const width = canvas.width;
    const height = canvas.height;
    context.fillStyle = mode === 'amber' ? '#160d08' : '#061417';
    context.fillRect(0, 0, width, height);

    const gridColor = mode === 'amber' ? 'rgba(221,130,72,.12)' : 'rgba(91,211,204,.11)';
    context.strokeStyle = gridColor;
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    const primary = mode === 'amber' ? '#db8751' : '#6fd8d1';
    const soft = mode === 'amber' ? 'rgba(219,135,81,.34)' : 'rgba(111,216,209,.34)';
    context.strokeStyle = primary;
    context.fillStyle = soft;
    context.lineWidth = 3;

    if (mode === 'nav') {
      const cx = width * 0.48;
      const cy = height * 0.53;
      for (let ring = 1; ring < 5; ring += 1) {
        context.beginPath();
        context.ellipse(cx, cy, ring * 54, ring * 29, -0.24, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(cx - 210, cy + 45);
      context.bezierCurveTo(cx - 80, cy - 170, cx + 80, cy + 130, cx + 245, cy - 64);
      context.stroke();
      context.beginPath();
      context.arc(cx + Math.sin(time * 0.0004) * 116, cy - 15, 8, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      for (let x = 0; x < width; x += 6) {
        const wave = Math.sin(x * 0.032 + time * 0.0012) * 38 + Math.sin(x * 0.009 - time * 0.0005) * 23;
        const jitter = (random() - 0.5) * 8;
        const y = height * 0.53 + wave + jitter;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      for (let bar = 0; bar < 11; bar += 1) {
        const value = 22 + ((Math.sin(time * 0.001 + bar) + 1) * 0.5) * 78;
        context.fillRect(52 + bar * 30, height - 52 - value, 13, value);
      }
    }

    context.fillStyle = primary;
    context.font = '600 22px monospace';
    context.fillText(mode === 'nav' ? 'DRIFT SOLUTION / L-07' : 'CABIN SYSTEMS / NOMINAL', 28, 37);
    context.fillStyle = 'rgba(224,235,225,.55)';
    context.font = '500 14px monospace';
    context.fillText('LOCAL  14:07:31    RANGE  8.24E+16 KM', 29, height - 24);
    texture.needsUpdate = true;
  }

  draw(0);
  return { texture, draw };
}

export function createMaterials() {
  const paintTexture = makeSurfaceTexture({ seed: 7, base: [93, 96, 93], variation: 14, flecks: 240 });
  paintTexture.repeat.set(3, 3);
  const darkTexture = makeSurfaceTexture({ seed: 13, base: [30, 33, 35], variation: 10, flecks: 150 });
  darkTexture.repeat.set(4, 4);
  const floorTexture = makeSurfaceTexture({ seed: 27, base: [44, 45, 43], variation: 16, flecks: 350 });
  floorTexture.repeat.set(5, 10);
  const fabricTexture = makeSurfaceTexture({ seed: 52, base: [84, 76, 66], variation: 13, flecks: 70, weave: true });
  fabricTexture.repeat.set(5, 5);
  const blanketTexture = makeSurfaceTexture({ seed: 77, base: [120, 70, 52], variation: 17, flecks: 60, weave: true });
  blanketTexture.repeat.set(6, 7);

  const paint = new THREE.MeshStandardMaterial({
    color: 0xa3a49d,
    map: paintTexture,
    roughness: 0.72,
    metalness: 0.38,
  });
  const creamPaint = paint.clone();
  creamPaint.color.set(0xb8b1a2);
  const darkPaint = new THREE.MeshStandardMaterial({
    color: 0x34383a,
    map: darkTexture,
    roughness: 0.79,
    metalness: 0.4,
  });
  const exterior = new THREE.MeshStandardMaterial({
    color: 0x555b5c,
    map: darkTexture,
    roughness: 0.58,
    metalness: 0.7,
  });
  const bareMetal = new THREE.MeshStandardMaterial({
    color: 0x9ba2a1,
    roughness: 0.27,
    metalness: 0.92,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: 0x8f5437,
    roughness: 0.38,
    metalness: 0.83,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: 0x51504b,
    map: floorTexture,
    roughness: 0.92,
    metalness: 0.23,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.88, metalness: 0.05 });
  const fabric = new THREE.MeshStandardMaterial({
    color: 0x8d7967,
    map: fabricTexture,
    roughness: 1,
    metalness: 0,
  });
  const blanket = new THREE.MeshStandardMaterial({
    color: 0xb35f42,
    map: blanketTexture,
    roughness: 1,
    metalness: 0,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8bb0b3,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.13,
    transmission: 0.06,
    thickness: 0.025,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const darkGlass = new THREE.MeshPhysicalMaterial({
    color: 0x13262b,
    roughness: 0.2,
    metalness: 0.15,
    transparent: true,
    opacity: 0.52,
    clearcoat: 0.9,
  });
  const screen = new THREE.MeshStandardMaterial({
    color: 0x73d8d0,
    emissive: 0x3dbcb5,
    emissiveIntensity: 2.1,
    roughness: 0.26,
    metalness: 0.06,
  });
  const amberGlow = new THREE.MeshStandardMaterial({
    color: 0xffae70,
    emissive: 0xe06c32,
    emissiveIntensity: 5,
    roughness: 0.28,
  });
  const greenGlow = new THREE.MeshStandardMaterial({
    color: 0x9bd4aa,
    emissive: 0x48a466,
    emissiveIntensity: 3.2,
    roughness: 0.3,
  });
  const redGlow = new THREE.MeshStandardMaterial({
    color: 0xea7660,
    emissive: 0xbe3f2c,
    emissiveIntensity: 3.8,
    roughness: 0.28,
  });

  return {
    paint,
    creamPaint,
    darkPaint,
    exterior,
    bareMetal,
    copper,
    floor,
    rubber,
    fabric,
    blanket,
    glass,
    darkGlass,
    screen,
    amberGlow,
    greenGlow,
    redGlow,
  };
}
