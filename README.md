# SimClone 🏙️

A SimCity-style city builder that runs entirely in the browser. Paint zones, lay roads,
manage the budget, and watch a low-poly city grow — and occasionally burn down.

Built with **Three.js + TypeScript + Vite**. No backend, no asset files: every building
is procedurally composed from flat-shaded boxes, and saves live in `localStorage`.

## Play

```bash
npm install
npm run dev      # open http://localhost:5173
```

## How to play

1. **Roads first** — drag with the Road tool (`T`). Everything needs road access.
2. **Power** — place a power plant (`P`) touching a road or zone. Power conducts
   through roads, zones, and buildings; each plant powers ~60 buildings.
3. **Zone** — paint Residential (`R`), Commercial (`C`), and Industrial (`I`)
   rectangles next to roads. Buildings grow on their own when demand (the RCI bars),
   power, and road access line up.
4. **Services** — fire stations suppress fires, parks and schools raise land value
   (which drives buildings to level up into denser ones), police help too.
   Keep industry away from homes — pollution tanks residential land value.
5. **Budget** — 💰 opens the tax panel. 9% is neutral; higher rates fill the
   treasury but choke demand. Roads and services cost monthly maintenance.
6. **Survive events** — fires spread building-to-building (roads are firebreaks),
   booms and recessions swing demand, and population milestones pay out grants.

### Controls

| Input | Action |
|---|---|
| Left drag | build roads / paint zones / bulldoze |
| Right or middle drag, WASD/arrows | pan camera |
| Mouse wheel | zoom |
| `Q` / `E` | rotate 90° |
| `0`–`3`, `Space` | game speed / pause |
| `Esc` | back to inspect tool |

The game autosaves monthly and on tab close. **🌱 New city** starts over.

## Development

```bash
npm test           # headless simulation test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

### Architecture

- `src/core/` + `src/sim/` — pure TypeScript simulation, zero Three.js imports.
  One `GameState`, mutated by fixed daily ticks; deterministic via a seeded RNG,
  which is what makes the headless test suite possible.
- `src/render/` — orthographic isometric renderer. One `InstancedMesh` per
  procedural building archetype; instance buffers rebuild only when the sim
  raises a dirty flag, so idle frames upload nothing.
- `src/ui/` — plain DOM/CSS HUD: toolbar, RCI meters, inspector, budget panel, toasts.
- `src/config.ts` — every cost, rate, radius, and probability. Balance lives here.
