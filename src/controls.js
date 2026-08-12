import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const WORLD_POSITION = new THREE.Vector3();
const PREVIOUS_POSITION = new THREE.Vector3();
const RAY_ORIGIN = new THREE.Vector3();
const RAY_DIRECTION = new THREE.Vector3();
const ROTATION_MATRIX = new THREE.Matrix4();

function findTaggedObject(object, tag) {
  let current = object;
  while (current) {
    if (current.userData?.[tag]) return current;
    current = current.parent;
  }
  return null;
}

function thumbstick(gamepad) {
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  const offset = gamepad.axes.length >= 4 ? 2 : 0;
  const deadzone = 0.16;
  const rawX = gamepad.axes[offset] ?? 0;
  const rawY = gamepad.axes[offset + 1] ?? 0;
  return {
    x: Math.abs(rawX) > deadzone ? rawX : 0,
    y: Math.abs(rawY) > deadzone ? rawY : 0,
  };
}

export class PlayerControls {
  constructor({ renderer, camera, rig, ship, scene, onStatus }) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = rig;
    this.ship = ship;
    this.scene = scene;
    this.onStatus = onStatus;
    this.keys = new Set();
    this.controllers = [];
    this.moveSpeed = 1.45;
    this.turnMode = 'snap';
    this.snapAngle = THREE.MathUtils.degToRad(30);
    this.snapReady = true;
    this.spawn = new THREE.Vector3(0.35, 0, -8.3);
    this.rig.position.copy(this.spawn);
    this.camera.position.set(0, 1.68, 0);
    this.camera.rotation.order = 'YXZ';
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 4.5;
    this.lastSecondary = new WeakMap();

    this.onKeyDown = (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyR' && !event.repeat) this.resetToSpawn();
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onMouseMove = (event) => {
      if (document.pointerLockElement !== renderer.domElement || renderer.xr.isPresenting) return;
      this.camera.rotation.y -= event.movementX * 0.0017;
      this.camera.rotation.x -= event.movementY * 0.0015;
      this.camera.rotation.x = THREE.MathUtils.clamp(this.camera.rotation.x, -1.35, 1.35);
    };
    this.onPointerLockChange = () => {
      document.body.classList.toggle('pointer-locked', document.pointerLockElement === renderer.domElement);
    };
    this.onCanvasClick = () => {
      if (!renderer.xr.isPresenting && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    renderer.domElement.addEventListener('click', this.onCanvasClick);

    this.setupControllers();
  }

  setupControllers() {
    const modelFactory = new XRControllerModelFactory();
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);

    for (let index = 0; index < 2; index += 1) {
      const controller = this.renderer.xr.getController(index);
      controller.userData.index = index;
      controller.userData.hovered = null;
      controller.addEventListener('connected', (event) => {
        controller.userData.inputSource = event.data;
      });
      controller.addEventListener('disconnected', () => {
        controller.userData.inputSource = null;
      });
      controller.addEventListener('selectstart', () => this.activateFrom(controller));
      controller.addEventListener('squeezestart', () => this.grabFrom(controller));
      controller.addEventListener('squeezeend', () => this.releaseFrom(controller));

      const rayMaterial = new THREE.LineBasicMaterial({
        color: 0xdba577,
        transparent: true,
        opacity: 0.55,
      });
      const ray = new THREE.Line(rayGeometry, rayMaterial);
      ray.name = 'interaction-ray';
      ray.scale.z = 2.8;
      controller.add(ray);
      this.rig.add(controller);

      const grip = this.renderer.xr.getControllerGrip(index);
      grip.add(modelFactory.createControllerModel(grip));
      this.rig.add(grip);

      this.controllers.push(controller);
    }
  }

  getRayHit(controller, includeGrabbables = true) {
    ROTATION_MATRIX.identity().extractRotation(controller.matrixWorld);
    RAY_ORIGIN.setFromMatrixPosition(controller.matrixWorld);
    RAY_DIRECTION.set(0, 0, -1).applyMatrix4(ROTATION_MATRIX).normalize();
    this.raycaster.set(RAY_ORIGIN, RAY_DIRECTION);
    const targets = includeGrabbables
      ? [...this.ship.interactables, ...this.ship.grabbables]
      : this.ship.interactables;
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits[0] ?? null;
  }

  activateFrom(controller) {
    const hit = this.getRayHit(controller, false);
    if (!hit) return;
    const target = findTaggedObject(hit.object, 'interactable');
    if (!target) return;
    const result = target.userData.onActivate?.();
    this.onStatus(result || `${target.userData.label || 'CONTROL'} ACTIVATED`);
  }

  grabFrom(controller) {
    if (controller.userData.held) return;
    const controllerPosition = controller.getWorldPosition(WORLD_POSITION);
    let target = null;
    let nearestDistance = 0.34;

    for (const item of this.ship.grabbables) {
      item.getWorldPosition(PREVIOUS_POSITION);
      const distance = PREVIOUS_POSITION.distanceTo(controllerPosition);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = item;
      }
    }

    if (!target) {
      const hit = this.getRayHit(controller, true);
      if (hit && hit.distance < 2.35) target = findTaggedObject(hit.object, 'grabbable');
    }
    if (!target) return;

    target.userData.previousParent = target.parent;
    controller.attach(target);
    controller.userData.held = target;
    target.position.set(0, -0.03, -0.09);
    target.rotation.set(0, 0, 0);
    this.onStatus(`HOLDING: ${target.userData.label || 'OBJECT'}`);
  }

  releaseFrom(controller) {
    const target = controller.userData.held;
    if (!target) return;
    this.scene.attach(target);
    controller.userData.held = null;
    this.onStatus(`${target.userData.label || 'OBJECT'} RELEASED`);
  }

  rotateAroundHead(deltaYaw) {
    this.camera.getWorldPosition(WORLD_POSITION);
    const beforeX = WORLD_POSITION.x;
    const beforeZ = WORLD_POSITION.z;
    this.rig.rotation.y += deltaYaw;
    this.rig.updateMatrixWorld(true);
    this.camera.getWorldPosition(WORLD_POSITION);
    this.rig.position.x += beforeX - WORLD_POSITION.x;
    this.rig.position.z += beforeZ - WORLD_POSITION.z;
  }

  recenterOrientation() {
    this.camera.getWorldDirection(FORWARD);
    FORWARD.y = 0;
    if (FORWARD.lengthSq() < 0.001) return;
    FORWARD.normalize();
    const heading = Math.atan2(-FORWARD.x, -FORWARD.z);
    this.rotateAroundHead(-heading);
    this.onStatus('ORIENTATION RECENTERED');
  }

  resetToSpawn() {
    this.rig.position.copy(this.spawn);
    this.rig.rotation.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.onStatus('RETURNED TO FLIGHT DECK');
  }

  updateDesktop(delta) {
    const forwardInput = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const rightInput = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    this.move(forwardInput, rightInput, delta);
  }

  updateXR(delta) {
    let leftController = null;
    let rightController = null;
    for (const controller of this.controllers) {
      const source = controller.userData.inputSource;
      if (source?.handedness === 'left') leftController = controller;
      if (source?.handedness === 'right') rightController = controller;

      const ray = controller.getObjectByName('interaction-ray');
      if (ray) ray.visible = Boolean(source);
      if (!source) continue;

      const secondary = Boolean(source?.gamepad?.buttons?.[5]?.pressed);
      const wasPressed = this.lastSecondary.get(controller) || false;
      if (secondary && !wasPressed) this.recenterOrientation();
      this.lastSecondary.set(controller, secondary);

      const hit = this.getRayHit(controller, true);
      if (ray) {
        ray.scale.z = hit ? Math.max(0.1, hit.distance) : 2.8;
        ray.material.color.set(hit ? 0xffd0a2 : 0xdba577);
        ray.material.opacity = hit ? 0.92 : 0.42;
      }
    }

    const movement = thumbstick(leftController?.userData.inputSource?.gamepad);
    this.move(-movement.y, movement.x, delta);

    const turning = thumbstick(rightController?.userData.inputSource?.gamepad);
    if (this.turnMode === 'smooth') {
      if (Math.abs(turning.x) > 0.08) this.rotateAroundHead(-turning.x * delta * THREE.MathUtils.degToRad(82));
    } else if (Math.abs(turning.x) > 0.72 && this.snapReady) {
      this.rotateAroundHead(-Math.sign(turning.x) * this.snapAngle);
      this.snapReady = false;
    } else if (Math.abs(turning.x) < 0.28) {
      this.snapReady = true;
    }
  }

  move(forwardInput, rightInput, delta) {
    if (!forwardInput && !rightInput) return;
    this.camera.getWorldDirection(FORWARD);
    FORWARD.y = 0;
    FORWARD.normalize();
    RIGHT.crossVectors(FORWARD, this.camera.up).normalize();
    MOVE.set(0, 0, 0)
      .addScaledVector(FORWARD, forwardInput)
      .addScaledVector(RIGHT, rightInput);
    if (MOVE.lengthSq() > 1) MOVE.normalize();

    PREVIOUS_POSITION.copy(this.rig.position);
    this.rig.position.addScaledVector(MOVE, this.moveSpeed * delta);
    this.ship.constrainPlayer(this.rig.position, PREVIOUS_POSITION);
  }

  update(delta) {
    if (this.renderer.xr.isPresenting) this.updateXR(delta);
    else this.updateDesktop(delta);
  }
}
