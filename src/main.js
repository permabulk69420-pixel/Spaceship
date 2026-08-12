import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ShipAudio } from './audio.js';
import { PlayerControls } from './controls.js';
import { createSpaceEnvironment } from './environment.js';
import { createMaterials } from './materials.js';
import { createShip } from './ship.js';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import './style.css';

const app = document.querySelector('#app');
const statusToast = document.querySelector('#statusToast');
const onboarding = document.querySelector('#onboarding');
const settings = document.querySelector('#settings');
const settingsTab = document.querySelector('#settingsTab');
const audioStatus = document.querySelector('#audioStatus');
let toastTimer;

function showStatus(message) {
  if (!message) return;
  statusToast.textContent = message;
  statusToast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => statusToast.classList.remove('is-visible'), 2200);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010205);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(1);
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.035, 5200);
const overviewCamera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 5200);
const playerRig = new THREE.Group();
playerRig.name = 'Player rig';
playerRig.add(camera);
scene.add(playerRig);

const materials = createMaterials();
const ship = createShip(materials);
const space = createSpaceEnvironment();
scene.add(space.group, ship.group);

const cabinFill = new THREE.HemisphereLight(0x53606a, 0x16110d, 0.34);
scene.add(cabinFill);

const controls = new PlayerControls({
  renderer,
  camera,
  rig: playerRig,
  ship,
  scene,
  onStatus: showStatus,
});

const audio = new ShipAudio({
  camera,
  ship,
  scene,
  onStatus: showStatus,
  onState: (message) => {
    audioStatus.textContent = message;
  },
});

ship.radioButton.userData.onActivate = () => {
  audio.toggleRadio().then(showStatus).catch(() => showStatus('RADIO COULD NOT START'));
  return 'RADIO CONTROL';
};

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.48,
  0.46,
  0.82,
);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

const vrButton = VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
});
vrButton.id = 'VRButton';
document.body.appendChild(vrButton);

let exteriorPreview = false;
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyV' || event.repeat || renderer.xr.isPresenting) return;
  exteriorPreview = !exteriorPreview;
  if (document.pointerLockElement) document.exitPointerLock();
  showStatus(exteriorPreview ? 'EXTERIOR ORBIT — V TO RETURN' : 'RETURNED TO CABIN');
});

document.querySelector('#closeHelp').addEventListener('click', () => onboarding.classList.add('is-hidden'));
settingsTab.addEventListener('click', () => {
  const open = settings.classList.toggle('is-open');
  settingsTab.setAttribute('aria-expanded', String(open));
});
document.querySelector('#turnMode').addEventListener('change', (event) => {
  controls.turnMode = event.target.value;
  showStatus(event.target.value === 'snap' ? 'SNAP TURN: 30°' : 'SMOOTH TURN ENABLED');
});
document.querySelector('#moveSpeed').addEventListener('input', (event) => {
  controls.moveSpeed = Number(event.target.value);
});
document.querySelector('#audioButton').addEventListener('click', async (event) => {
  try {
    await audio.initialize();
    event.currentTarget.textContent = 'SHIP AMBIENCE ONLINE';
  } catch (error) {
    console.error(error);
    audioStatus.textContent = 'Audio could not initialize in this browser.';
  }
});
document.querySelector('#radioFile').addEventListener('change', async (event) => {
  try {
    await audio.loadRadioFile(event.target.files?.[0]);
  } catch (error) {
    console.error(error);
    audioStatus.textContent = 'That audio file could not be decoded.';
  }
});

renderer.xr.addEventListener('sessionstart', async () => {
  document.body.classList.add('xr-presenting');
  onboarding.classList.add('is-hidden');
  camera.position.set(0, 0, 0);
  try {
    renderer.xr.setFoveation(0.65);
    ship.warmLights.forEach((light) => {
      light.userData.desktopShadow = light.castShadow;
      light.castShadow = false;
    });
    space.cosmicKey.userData.desktopShadow = space.cosmicKey.castShadow;
    space.cosmicKey.castShadow = false;
    await audio.initialize();
  } catch (error) {
    console.warn('Audio waits for the next user gesture.', error);
  }
});

renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('xr-presenting');
  camera.position.set(0, 1.68, 0);
  ship.warmLights.forEach((light) => {
    light.castShadow = Boolean(light.userData.desktopShadow);
  });
  space.cosmicKey.castShadow = Boolean(space.cosmicKey.userData.desktopShadow);
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  overviewCamera.aspect = width / height;
  camera.updateProjectionMatrix();
  overviewCamera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  ship.update(delta, elapsed);
  space.update(delta, elapsed);
  audio.update(elapsed);
  if (!exteriorPreview || renderer.xr.isPresenting) controls.update(delta);

  if (renderer.xr.isPresenting) {
    renderer.render(scene, camera);
    return;
  }

  if (exteriorPreview) {
    const orbit = elapsed * 0.035;
    overviewCamera.position.set(Math.cos(orbit) * 48, 15 + Math.sin(elapsed * 0.08) * 3, Math.sin(orbit) * 48 + 2);
    overviewCamera.lookAt(0, 0.8, 1.5);
    renderPass.camera = overviewCamera;
  } else {
    renderPass.camera = camera;
  }
  composer.render();
});

console.info('Lone Light ready — WebXR locomotion, procedural ship, and Kestrel Drift loaded.');
