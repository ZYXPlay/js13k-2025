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

## Post-Mortem

### Development Challenges & Lessons Learned

**Rapid Development Timeline**
The entire game was developed in just 3 days with approximately 8 hours of focused development time. This intense sprint created unique challenges—every decision had to be made quickly, and there was no time for major architectural revisions. The compressed timeline actually helped maintain focus and prevented feature creep, though it also meant some optimization opportunities were only discovered during the final hours.

**Size Optimization Battle**
The 13KB limit was the constant nemesis throughout development. Every feature addition required careful consideration of its byte cost. The dual-canvas approach, while architecturally clean, consumed precious space with duplicate context management. The custom font system, though visually consistent, required significant optimization—each glyph and rendering function was scrutinized for golf-ability.

**Technical Architecture Decisions**
- **Dual Canvas Strategy**: Separating game content (main canvas) from UI (aux canvas) simplified rendering logic but added complexity in coordinate mapping and event handling
- **Custom Font Rendering**: Building a pixel-perfect 5×7 font system provided visual consistency but required extensive character mapping and tinting logic
- **Sprite-based Animation**: Using a single spritesheet (`cat.png`) kept asset management simple but required careful sprite coordinate calculations
- **Responsive Design**: Supporting both portrait and landscape orientations while maintaining pixel crispness involved complex scaling mathematics

**Code Golfing Techniques Applied**
During the final optimization phase, aggressive code golfing saved crucial bytes:

1. **Variable Name Shortening**: `isPortrait` → `p`, `scale` → `s`, `index` → `i`
2. **Declaration Consolidation**: Multiple `const`/`let` statements combined using comma operators
3. **Mathematical Shortcuts**: `Math.floor(x)` → `x|0`, `0.00016` → `16e-5`
4. **Conditional Chaining**: Multiple `if` statements combined with `||` operators
5. **Function Inlining**: Eliminated intermediate variables where possible
6. **Comment Removal**: All explanatory text stripped in production builds

**Key Optimizations**:
- `renderPlasma()`: 950 → 360 characters (62% reduction)
- `resizeCanvases()`: 560 → 270 characters (52% reduction)  
- `drawChar()`: 800 → 580 characters (27% reduction)
- `setupAbilityUI()`: 2,100 → 1,650 characters (21% reduction)

**Plasma Background Innovation**
The animated plasma background was a late addition that nearly didn't make it due to size constraints. The effect uses three layered sine waves with time-based animation, quantized to an 8-color palette for that retro aesthetic. Originally 30+ lines, it was compressed to a single-line monster while maintaining visual fidelity.

**Animation System Evolution**
The `createAnimatable` helper started as a full-featured tween library but was progressively stripped down. Features like bounce easing, sequence chaining, and callback systems were sacrificed for size. The final version supports only essential move/scale/rotate/fade operations with basic easing.

**Mobile vs Desktop Considerations**
Supporting both touch and mouse interactions required careful event handling. Long-press detection for mobile ability tooltips added complexity, as did the responsive canvas scaling that maintains pixel-perfect rendering across device sizes.

**Build Pipeline Complexity**
The Vite configuration became increasingly complex with JS13K-specific optimizations:
- CSS inlining to reduce HTTP requests
- Asset bundling for the spritesheet
- Conditional PWA feature inclusion
- Aggressive Terser minification settings
- Bundle size monitoring and alerts

**What Worked Well**
- The theme integration felt natural—cats and superstition meshed perfectly with poker
- Dual-canvas architecture kept rendering concerns separated
- Custom font system provided consistent visual identity
- Responsive design worked seamlessly across devices
- Code golfing techniques yielded significant space savings

**What Could Be Improved**
- Earlier size budget planning—some features were cut too late in development
- More aggressive initial architecture decisions (single canvas might have been sufficient)
- Better balance between code readability and size optimization during development
- More systematic approach to feature prioritization based on byte cost

**AI-Assisted Development**
One of the most significant productivity boosts came from leveraging AI assistance throughout development, particularly with VS Code's AI agent capabilities. The AI proved invaluable in several key areas:

- **Code Optimization**: AI assistance helped identify optimization opportunities that might have been missed during manual review
- **Code Golfing Expertise**: The final push to meet size constraints was dramatically accelerated by AI-powered code golfing, achieving 20-60% size reductions across multiple functions
- **Pattern Recognition**: AI helped spot repetitive code patterns that could be consolidated or refactored for better compression
- **Alternative Approaches**: When stuck on implementation details, AI suggested alternative algorithmic approaches that were often more size-efficient
- **Documentation**: AI assistance with writing comprehensive code comments during development (later stripped for production) improved code maintainability

The collaboration was particularly effective during the final optimization phase—what might have taken days of manual code golfing was accomplished in hours. The AI's ability to quickly generate multiple optimization variants allowed for rapid iteration and comparison of different approaches.

This represents a new paradigm in game jam development where AI becomes a collaborative partner rather than just a tool, especially valuable given JS13K's extreme constraints where every character matters.

**Final Thoughts**
Developing for JS13K is equal parts creative challenge and technical puzzle. Every design decision becomes a negotiation between features, performance, and file size. The constraint forces innovative solutions—the plasma background wouldn't exist without the pressure to make every byte count. While frustrating at times, these limitations ultimately produce tighter, more focused games.

The black cat theme proved to be a perfect match for a poker game, allowing for rich thematic integration without feeling forced. Players connect with the superstition angle immediately, making the cat abilities feel natural rather than arbitrary game mechanics.

Most importantly: measure twice, golf once. Tracking bundle size throughout development prevents the panic of last-minute feature cuts. And in 2025, don't overlook AI assistance—it's become an essential tool for competitive game jam development.
