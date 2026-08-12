import * as THREE from 'three';

function makeBuffer(context, duration, generator) {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = generator(index / sampleRate, index, sampleRate);
  }
  return buffer;
}

function makeHum(context, fundamental = 31) {
  return makeBuffer(context, 8, (time) => {
    const pulse = 0.86 + Math.sin(time * Math.PI * 0.31) * 0.08;
    return (
      Math.sin(time * fundamental * Math.PI * 2) * 0.34
      + Math.sin(time * fundamental * 2 * Math.PI * 2) * 0.1
      + Math.sin(time * fundamental * 3.01 * Math.PI * 2) * 0.035
      + Math.sin(time * 7.2 * Math.PI * 2) * 0.028
    ) * pulse;
  });
}

function makeVentilation(context) {
  let filtered = 0;
  let slow = 0;
  return makeBuffer(context, 9, (time) => {
    const noise = Math.random() * 2 - 1;
    filtered += (noise - filtered) * 0.035;
    slow += (filtered - slow) * 0.007;
    return (filtered - slow * 0.6) * (0.38 + Math.sin(time * 0.47) * 0.035);
  });
}

function makeRadioNoise(context) {
  let filtered = 0;
  return makeBuffer(context, 5, (time) => {
    filtered += ((Math.random() * 2 - 1) - filtered) * 0.18;
    const carrier = Math.sin(time * Math.PI * 2 * 712) * 0.014;
    return filtered * 0.08 + carrier;
  });
}

function makeCreak(context) {
  return makeBuffer(context, 2.8, (time) => {
    const envelope = Math.pow(Math.max(0, 1 - time / 2.8), 2.4) * Math.sin(Math.min(1, time * 3.2) * Math.PI);
    const bend = 71 - time * 18 + Math.sin(time * 4.1) * 4;
    return (Math.sin(time * bend * Math.PI * 2) * 0.38 + Math.sin(time * bend * 0.49 * Math.PI * 2) * 0.15) * envelope;
  });
}

function makeBeep(context) {
  return makeBuffer(context, 0.62, (time) => {
    const gate = time < 0.12 || (time > 0.23 && time < 0.36) ? 1 : 0;
    const envelope = Math.min(1, time * 90) * Math.max(0, 1 - time * 1.45);
    return Math.sin(time * 1180 * Math.PI * 2) * gate * envelope * 0.22;
  });
}

function positionalSource(buffer, volume, refDistance, rolloff = 1.35, loop = true) {
  return { buffer, volume, refDistance, rolloff, loop };
}

export class ShipAudio {
  constructor({ camera, ship, scene, onStatus, onState }) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ship = ship;
    this.scene = scene;
    this.onStatus = onStatus;
    this.onState = onState;
    this.initialized = false;
    this.radioLoaded = false;
    this.radioEnabled = false;
    this.nextCreak = 9;
    this.nextBeep = 5;
    this.creak = null;
    this.beep = null;

    this.radio = new THREE.PositionalAudio(this.listener);
    this.radio.setRefDistance(1.8);
    this.radio.setRolloffFactor(1.7);
    this.radio.setDistanceModel('exponential');
    this.ship.radioAnchor.add(this.radio);
  }

  addPositional(position, descriptor) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...position);
    this.scene.add(anchor);
    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(descriptor.buffer);
    audio.setLoop(descriptor.loop);
    audio.setVolume(descriptor.volume);
    audio.setRefDistance(descriptor.refDistance);
    audio.setRolloffFactor(descriptor.rolloff);
    audio.setDistanceModel('exponential');
    anchor.add(audio);
    return audio;
  }

  async initialize() {
    await this.listener.context.resume();
    if (this.initialized) {
      this.onState('Ship ambience is awake.');
      return;
    }

    const context = this.listener.context;
    const engine = this.addPositional(
      [0, -0.6, 18.8],
      positionalSource(makeHum(context, 27.5), 0.32, 12, 0.7),
    );
    const machinery = this.addPositional(
      [2.7, 1.1, 9.5],
      positionalSource(makeHum(context, 43), 0.12, 4.2, 1.25),
    );
    const ventilation = this.addPositional(
      [-3.25, 2.35, -0.8],
      positionalSource(makeVentilation(context), 0.21, 5, 0.85),
    );
    this.creak = this.addPositional(
      [-2.8, 2.7, 6.2],
      positionalSource(makeCreak(context), 0.3, 7, 1, false),
    );
    this.beep = this.addPositional(
      [0, 1.0, -12.1],
      positionalSource(makeBeep(context), 0.16, 3, 1.35, false),
    );

    engine.play();
    machinery.play();
    ventilation.play();
    this.radio.setBuffer(makeRadioNoise(context));
    this.radio.setLoop(true);
    this.radio.setVolume(0.06);
    this.initialized = true;
    this.onState('Ventilation, drive hum, and cabin machinery online.');
    this.onStatus('SHIP AMBIENCE ONLINE');
  }

  async loadRadioFile(file) {
    if (!file) return;
    await this.initialize();
    const bytes = await file.arrayBuffer();
    const buffer = await this.listener.context.decodeAudioData(bytes.slice(0));
    if (this.radio.isPlaying) this.radio.stop();
    this.radio.setBuffer(buffer);
    this.radio.setLoop(true);
    this.radio.setVolume(0.52);
    this.radioLoaded = true;
    this.radioEnabled = true;
    this.radio.play();
    this.onState(`Radio: ${file.name}`);
    this.onStatus('CABIN RADIO PLAYING');
  }

  async toggleRadio() {
    await this.initialize();
    if (this.radio.isPlaying) {
      this.radio.pause();
      this.radioEnabled = false;
      this.onState(this.radioLoaded ? 'Cabin radio paused.' : 'Radio receiver muted.');
      return 'CABIN RADIO PAUSED';
    }
    this.radio.play();
    this.radioEnabled = true;
    this.onState(this.radioLoaded ? 'Cabin radio playing.' : 'Radio receiver hiss playing. Load a track from Ship Systems.');
    return this.radioLoaded ? 'CABIN RADIO PLAYING' : 'RADIO RECEIVER OPEN';
  }

  update(elapsed) {
    if (!this.initialized) return;
    if (elapsed > this.nextCreak && !this.creak.isPlaying) {
      this.creak.setDetune(-110 + Math.random() * 190);
      this.creak.play();
      this.nextCreak = elapsed + 17 + Math.random() * 28;
    }
    if (elapsed > this.nextBeep && !this.beep.isPlaying) {
      this.beep.setDetune(-70 + Math.random() * 140);
      this.beep.play();
      this.nextBeep = elapsed + 12 + Math.random() * 22;
    }
  }
}
