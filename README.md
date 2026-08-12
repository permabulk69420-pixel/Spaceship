# Lone Light

**Lone Light** is a first-playable WebXR visual prototype about being the only awake person aboard a substantial long-range spacecraft, surrounded by an ancient and overwhelming universe.

This pass deliberately prioritizes atmosphere over game systems: a believable ship, comfortable Quest controls, dramatic windows, astronomical scale, and spatial ambience.

## What is in the prototype

- A **48 m spacecraft** with a **30 m traversable pressure deck** and human-scale architecture
- Distinct flight deck, observation lounge, galley, bunk, work bay, cargo volume, and airlock
- Empty crew stations and spare ship capacity that reinforce the player's isolation
- Procedural PBR interior surfaces, structural detail, clutter, warm practical lighting, and exterior hull silhouette
- Layered star volumes, near dust, enormous gas structures, shadowed pillars, a distant moon, and a partially framed gas giant
- WebXR smooth locomotion, 30° snap turn, optional smooth turn, recentering, controller rays, and grabbable props
- Interactive cabin lights, inner airlock door, and physical ship radio
- Generated spatial drive, ventilation, machinery, creak, and console ambience
- A local audio-file input so a user-provided track plays from the radio's physical position
- A desktop walk-through and exterior inspection view

No music file is included in the repository.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Desktop controls are:

- `WASD` — walk
- Mouse — look after clicking the scene
- `R` — return to the flight-deck spawn
- `V` — toggle the exterior orbit view

The Ship Systems panel controls turning mode, walking speed, ship ambience, and the radio file.

## Meta Quest / WebXR

WebXR requires a secure context. Before the first deployment, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once. The included workflow then builds and publishes the project over HTTPS after it reaches `main` (or when manually dispatched). Open that Pages URL in Meta Quest Browser and choose **Enter VR**.

Quest Touch controls:

- Left thumbstick — smooth locomotion relative to head direction
- Right thumbstick — 30° snap turn by default, or optional smooth turn
- Trigger — activate a highlighted control
- Grip — directly grab a nearby prop or pull one with the interaction ray
- `B` or `Y` — recenter orientation toward the ship's bow

The headset remains fully tracking-driven. There is no forced camera motion in VR. Bloom is desktop-only; the XR path renders directly with fixed foveation and reduced shadow cost.

## Validation

```bash
npm run check
```

This syntax-checks the source and produces a production Vite build.

## Project structure

- `src/ship.js` — procedural vessel, interior zones, details, interactive objects, collision bounds
- `src/environment.js` — stars, parallax dust, nebula layers, pillars, celestial bodies, cosmic light
- `src/controls.js` — desktop and Quest locomotion, turning, rays, grabbing, recentering
- `src/audio.js` — generated spatial ambience and user-loaded radio audio
- `src/materials.js` — PBR surface textures, displays, emissive and glass materials
- `src/main.js` — renderer, WebXR lifecycle, UI wiring, update loop, desktop post-processing

## Scope

This is intentionally a visual/vibe vertical slice. It does not contain crafting, survival meters, combat, inventory, procedural planets, quests, NPCs, multiplayer, or a generalized content framework.
