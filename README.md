# Poker Mysterio
Entry for JS13K game competition 2025. Theme: Black Cat

Play here: https://zyxplay.github.io/js13k-2025/

(It's the PWA version that can be installed on your device to play it offline 🥳)

## Background
They say crossing paths with a black cat is bad luck. Poker Mysterio disagrees. In a smoky, comic‑book alley of neon signs and stacked decks, a mischievous black cat pads onto the felt and starts dealing fate with a flick of its tail. Every superstition you’ve heard is here—only this time, the cat’s on your side… mostly.

You’ll build poker hands while the cat toys with probability: a purr to peek at the next draw, a hiss that curses your next score, a pounce that swaps a card at the last second, and a scratch that scars the deck and tilts luck toward the shadows. Think Saturday‑morning comic meets late‑night card table—quick, punchy, a little mysterious.

Cross the cat, tempt superstition, and chase the perfect hand. If luck is a lady, Mysterio is her whiskered accomplice.

## Technical Overview
The game runs on two canvases: a main canvas for cards, particles, and core gameplay; and an auxiliary canvas for UI elements (ability buttons, cat sprite, title, and score). Rendering is hand‑rolled with a compact 5×7 pixel font and a tiny object/animation system built around a `createAnimatable` helper that provides move/scale/rotate/fade tweens with easing. Input uses pointer events with click, long‑press (mobile), and hover (desktop) to activate or describe abilities.

Visuals are primarily sprite‑based via a single `cat.png` spritesheet: tail‑wagging cat, paw (with/without claws), scratch marks, and a cat‑head glyph used to replace the O’s in the title. The game waits for the spritesheet to load before booting, keeping draw paths simple without scattered readiness checks. Cards and simple VFX (bursts, sparkles) render directly to the main canvas; ability UI and the cat/score live on the aux canvas.

Layout scales responsively by fixing the internal resolution (256×240) and adjusting CSS sizes, preserving pixel crispness while mapping pointer coordinates back to canvas space. Portrait stacks the canvases; landscape aligns them side‑by‑side. The build uses Vite with an aggressive Terser setup and a `js13k` mode that inlines CSS, bundles the spritesheet, and omits PWA assets; non‑competition builds re‑enable PWA (manifest + service worker) at runtime.
