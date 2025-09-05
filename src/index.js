import song from './song';
import Player from './player';
import { zzfx } from './zzfx';
import { cardFx, handFx, overFx, clickFx } from './sounds';

const player = new Player();
let genDone = false;
player.init(song);
setInterval(function () {
  if (genDone) {
    return;
  }

  genDone = player.generate() >= 1;

  if (genDone) {
    const wave = player.createWave();
    audio.src = URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));
  }
}, 0);


// player.generate();
const audio = document.createElement("audio");
audio.autoplay = true;
audio.loop = true;

const body = document.body;
body.appendChild(audio);
function startMusic() {
  audio.play();
  body.removeEventListener('click', startMusic);
}
body.addEventListener('click', startMusic);

const canvas = document.getElementById('canvas-main');
const ctx = canvas.getContext('2d');
// Auxiliary canvas for UI / abilities
const canvasAux = document.getElementById('canvas-aux');
const ctxAux = canvasAux.getContext('2d');
// Background plasma canvas
const canvasBg = document.getElementById('canvas-bg');
const ctxBg = canvasBg.getContext('2d');

function setupCanvas(c) {
  c.imageSmoothingEnabled = false;
}

setupCanvas(ctx);
setupCanvas(ctxAux);
setupCanvas(ctxBg);

// Input handling
let mousePos = { x: 0, y: 0 };

function getEventPosInCanvas(e, c) {
  const rect = c.getBoundingClientRect();
  const xCss = e.clientX - rect.left;
  const yCss = e.clientY - rect.top;
  const scaleX = c.width / rect.width;
  const scaleY = c.height / rect.height;
  return { x: xCss * scaleX, y: yCss * scaleY };
}

canvas.addEventListener('click', (e) => {
  if (typeof booted !== 'undefined' && !booted) return;
  const p = getEventPosInCanvas(e, canvas);
  mousePos.x = p.x;
  mousePos.y = p.y;

  // Close any open popup on any click, but continue unless suppressed
  if (activePopup) closeActivePopup();

  // Suppress click if it followed a long-press
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  // Ability targeting: handle Pounce card selection on combo row first
  if (gameState === 'playing' && abilityState.pounceSelecting && comboRow.length > 0) {
    for (let i = 0; i < comboRow.length; i++) {
      const c = comboRow[i];
      if (mousePos.x >= c.x && mousePos.x <= c.x + c.w &&
        mousePos.y >= c.y && mousePos.y <= c.y + c.h) {
        // Attempt pounce replace
        if (abilities.pounce > 0) {
          performPounceAt(i);
          abilities.pounce--;
          abilityState.pounceSelecting = false;
          updateAbilityButtons();
        }
        return; // consume click
      }
    }
    // Click outside any combo card cancels selection
    abilityState.pounceSelecting = false;
    return;
  }

  // Check for card clicks
  gameObjects.forEach(obj => {
    if (obj.clickable && obj.x && obj.y && obj.w && obj.h) {
      if (mousePos.x >= obj.x && mousePos.x <= obj.x + obj.w &&
        mousePos.y >= obj.y && mousePos.y <= obj.y + obj.h) {
        if (obj.onClick) obj.onClick();
      }
    }
  });

  // Check for start game click in title state
  if (gameState === 'title') {
    initGame();
  } else if (gameState === 'gameOver') {
    enterTitle();
  }
});

// Pointer-based long-press detection for ability buttons
let longPressTimer = null;
let pointerDownPos = { x: 0, y: 0 };
let suppressNextClick = false;

const abilityDescriptions = {
  pounce: ['POUNCE', 'Replace a combo card', 'with top deck card.'],
  purr: ['PURR', 'Peek next top deck card.'],
  hiss: ['HISS', 'Redeal hand. Next combo', 'Less 20pct score.'],
  scratch: ['SCRATCH', 'Burn top 3 cards.', 'Next draw favors black.']
};

function hitTest(obj, x, y) {
  return obj && x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = getEventPosInCanvas(e, canvas);
  pointerDownPos = { x: p.x, y: p.y };
});

// Aux canvas: long-press detection for ability buttons
canvasAux.addEventListener('pointerdown', (e) => {
  const p = getEventPosInCanvas(e, canvasAux);
  pointerDownPos = { x: p.x, y: p.y };

  const entries = Object.entries(abilityButtons);
  for (const [key, btn] of entries) {
    if (btn && hitTest(btn, p.x, p.y) && abilities[key] > 0 && gameState === 'playing') {
      longPressTimer = setTimeout(() => {
        suppressNextClick = true;
        showAbilityPopup(key);
      }, 550);
      return;
    }
  }
});

canvasAux.addEventListener('pointermove', (e) => {
  const p = getEventPosInCanvas(e, canvasAux);
  // If tracking long-press, cancel on move threshold
  if (longPressTimer) {
    const dx = p.x - pointerDownPos.x;
    const dy = p.y - pointerDownPos.y;
    if ((dx * dx + dy * dy) > 36) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // Desktop hover popup on mouse pointer
  if (e.pointerType === 'mouse' && gameState === 'playing') {
    let hoveredKey = null;
    for (const [key, btn] of Object.entries(abilityButtons)) {
      if (btn && hitTest(btn, p.x, p.y) && abilities[key] > 0) {
        hoveredKey = key;
        break;
      }
    }
    if (hoveredKey) {
      if (!activePopup || !activePopupFromHover || activePopupKind !== hoveredKey) {
        zzfx(...overFx);
        showAbilityPopup(hoveredKey, true);
      }
    } else if (activePopup && activePopupFromHover) {
      closeActivePopup();
    }
  }
});

['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
  canvasAux.addEventListener(type, () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (type === 'pointerleave' && activePopupFromHover) {
      closeActivePopup();
    }
  });
});

// Aux canvas: handle taps/clicks on ability buttons
canvasAux.addEventListener('click', (e) => {
  if (typeof booted !== 'undefined' && !booted) return;
  const p = getEventPosInCanvas(e, canvasAux);
  mousePos.x = p.x;
  mousePos.y = p.y;

  // Close any open popup on any click, but continue unless suppressed
  if (activePopup) closeActivePopup();

  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (gameState !== 'playing') return;

  const entries = Object.entries(abilityButtons);
  for (const [key, btn] of entries) {
    if (!btn) continue;
    if (hitTest(btn, p.x, p.y)) {
      // respect remaining charges
      if (abilities[key] > 0 && typeof btn.onClick === 'function') {
        zzfx(...clickFx);
        btn.onClick();
      }
      break;
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!longPressTimer) return;
  const p = getEventPosInCanvas(e, canvas);
  const dx = p.x - pointerDownPos.x;
  const dy = p.y - pointerDownPos.y;
  if ((dx * dx + dy * dy) > 36) { // moved > 6px
    clearTimeout(longPressTimer);
    longPressTimer = null;

  }
});

['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
  canvas.addEventListener(type, () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

  });
});

// Font spritesheet renderer (5x7 glyphs)
const GLYPH_W = 5, GLYPH_H = 7, GLYPH_SPACE = 1;
let _fontBuf = null, _fontBufCtx = null, _fontBufW = 0, _fontBufH = 0;

function glyphIndex(ch) {
  if (!ch) return -1;
  const up = ch.toUpperCase();
  // 0-25: A-Z
  if (up >= 'A' && up <= 'Z') return up.charCodeAt(0) - 65;
  // 26-35: 0-9
  if (ch >= '0' && ch <= '9') return 26 + (ch.charCodeAt(0) - 48);
  // 36: ♠, 37: ♣, 38: ♥, 39: ♦
  if (ch === '♠') return 36;
  if (ch === '♣') return 37;
  if (ch === '♥') return 38;
  if (ch === '♦') return 39;
  return -1;
}

function drawChar(char, x, y, color = '#fff', scale = 1, context = ctx) {
  let i = glyphIndex(char),
      w = (GLYPH_W + GLYPH_SPACE) * scale;
  if (i < 0) return x + w;
  let sw = GLYPH_W, sh = GLYPH_H,
      dw = sw * scale, dh = sh * scale,
      sx = i * GLYPH_W;
  if (!_fontBuf || _fontBufW !== dw || _fontBufH !== dh) {
    _fontBufW = dw; _fontBufH = dh;
    _fontBuf = document.createElement('canvas');
    _fontBuf.width = dw; _fontBuf.height = dh;
    _fontBufCtx = _fontBuf.getContext('2d');
    _fontBufCtx.imageSmoothingEnabled = false;
  } else _fontBufCtx.clearRect(0, 0, _fontBufW, _fontBufH);
  _fontBufCtx.globalCompositeOperation = 'source-over';
  _fontBufCtx.drawImage(fontImg, sx, 0, sw, sh, 0, 0, dw, dh);
  _fontBufCtx.globalCompositeOperation = 'source-in';
  _fontBufCtx.fillStyle = color;
  _fontBufCtx.fillRect(0, 0, dw, dh);
  context.imageSmoothingEnabled = false;
  context.drawImage(_fontBuf, x, y);
  return x + w;
}

function drawText(text, x, y, color = '#fff', scale = 1, alignment = 'left', context = ctx) {
  let startX = x;
  const charW = (GLYPH_W + GLYPH_SPACE) * scale;
  const charH = GLYPH_H * scale;
  if (alignment === 'center') {
    startX = x - (text.length * charW) / 2;
    y = y - charH / 2;
  }
  let currentX = startX;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') currentX += charW; else currentX = drawChar(ch, currentX, y, color, scale, context);
  }
  return currentX;
}

// Game state
let lastTime = 0;
let gameTime = 0;
let gameObjects = [];
let titleObjects = [];

// Game logic state
let gameState = 'title'; // 'title', 'playing', 'evaluating', 'gameOver'
let score = 0;
let highScore = parseInt(localStorage.getItem('pokerHighScore') || '0');
let cardsLeft = 52;
let playerHand = [];
let comboRow = [];
let deck = [];
let deckPosition = { x: 0, y: 0 }; // Will be set to center

// Abilities state
let abilities = { pounce: 1, purr: 1, hiss: 1, scratch: 1 };
let abilityButtons = { pounce: null, purr: null, hiss: null, scratch: null };
let auxObjects = []; // objects rendered on aux canvas (ability buttons)
let catSprite = null;
let auxTitle = null;
let auxScore = null;
// Load cat sprite sheet (3 frames, 32x32 each, 96x32 total)
import catUrl from './assets/cat.png';
import fontUrl from './assets/font.png';
const catImg = new Image();
catImg.src = catUrl;
const fontImg = new Image();
fontImg.src = fontUrl;

// Sprites consolidated in cat.png; mapping helpers
const CAT_FRAME_W = 32;
const CAT_FRAMES = {
  wag0: 0, wag1: 1, wag2: 2,     // tail wag
  pawMove0: 3, pawMove1: 4,      // right paw up animation
  paw: 6,                        // paw (no claws)
  pawClaw: 7,                    // paw with claws
  scratch: 8                     // scratch marks
};
function catFrameCount() { return (catImg && catImg.naturalWidth > 0) ? Math.floor(catImg.naturalWidth / CAT_FRAME_W) : 0; }
function frameOrClamp(i) { const n = catFrameCount(); return n ? Math.max(0, Math.min(n - 1, i)) : 0; }
function catScratchFrame() { return frameOrClamp(CAT_FRAMES.scratch); }
function catPawClawsFrame() { return frameOrClamp(CAT_FRAMES.pawClaw); }
function catPawFrame() { return frameOrClamp(CAT_FRAMES.paw); }
let abilityState = { pounceSelecting: false };
let nextScoreMultiplier = 1; // Hiss applies a temporary penalty
let scratchBiasActive = false; // Scratch biases the next draw to black
let activePopup = null;
let activePopupKind = null;
let activePopupFromHover = false;

// Card definitions
const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a shuffled deck
const createDeck = () => {
  const newDeck = [];
  suits.forEach(suit => {
    values.forEach(value => {
      newDeck.push({ suit, value });
    });
  });

  // Shuffle deck
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }

  return newDeck;
};

// Poker hand evaluation
const evaluateHand = (cards) => {
  const valueMap = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
  const counts = {};
  const suitCounts = {};

  cards.forEach(card => {
    counts[card.value] = (counts[card.value] || 0) + 1;
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  });

  const values = Object.values(counts).sort((a, b) => b - a);
  const isFlush = Object.values(suitCounts)[0] === 5;
  const sortedValues = cards.map(c => valueMap[c.value]).sort((a, b) => a - b);
  const isStraight = sortedValues.every((v, i) => i === 0 || v === sortedValues[i - 1] + 1) ||
    (sortedValues.join(',') === '1,10,11,12,13'); // A,10,J,Q,K

  if (isStraight && isFlush) return { name: 'Royal Flush', score: 1000 };
  if (isFlush) return { name: 'Flush', score: 500 };
  if (isStraight) return { name: 'Straight', score: 400 };
  if (values[0] === 4) return { name: 'Four of a Kind', score: 800 };
  if (values[0] === 3 && values[1] === 2) return { name: 'Full House', score: 700 };
  if (values[0] === 3) return { name: 'Three of a Kind', score: 300 };
  if (values[0] === 2 && values[1] === 2) return { name: 'Two Pair', score: 200 };
  if (values[0] === 2) return { name: 'Pair', score: 100 };
  return { name: 'High Card', score: 10 };
};

// Game initialization
const initGame = () => {
  // Clear any title animations
  titleObjects = [];
  gameState = 'playing';
  score = 0;
  deck = createDeck();
  cardsLeft = 52;
  playerHand = [];
  comboRow = [];
  nextScoreMultiplier = 1;
  scratchBiasActive = false;
  // Reset abilities each run
  abilities = { pounce: 1, purr: 1, hiss: 1, scratch: 1 };

  // Set deck position (center of screen)
  deckPosition.x = canvas.width / 2 - 20;
  deckPosition.y = canvas.height / 2 - 30;

  // Deal initial 5 cards
  dealCards();

  // Setup ability UI buttons
  setupAbilityUI();
  // Setup aux score HUD
  ensureAuxScore();

  // Close any popup
  if (activePopup) closeActivePopup();
};

const dealCards = () => {
  // Clear existing hand (only used at start of new game)
  playerHand.forEach(card => {
    const index = gameObjects.indexOf(card);
    if (index > -1) gameObjects.splice(index, 1);
  });
  playerHand = [];

  // Deal 5 new cards
  for (let i = 0; i < 5; i++) {
    if (deck.length > 0) {
      const cardData = deck.pop();
      cardsLeft--;

      const card = createCard(
        deckPosition.x,
        deckPosition.y,
        cardData.suit,
        cardData.value
      );

      // Add click handler
      card.onClick = () => playCard(card);
      card.clickable = true;

      // Animate to hand position
      const handX = (canvas.width / 2) + (i - 2) * 50 - 20;
      const handY = canvas.height - 80;

      setTimeout(() => {
        zzfx(...cardFx);
        card.moveTo(handX, handY, 400, 'easeOut', () => {

        });
      }, i * 100);

      playerHand.push(card);
      gameObjects.push(card);
    }
  }
};

const playCard = (card) => {
  if (gameState !== 'playing' || comboRow.length >= 5) return;

  // Remove from hand
  const handIndex = playerHand.indexOf(card);
  if (handIndex > -1) {
    const removedPosition = handIndex; // Store the position before removal
    playerHand.splice(handIndex, 1);

    // Add to combo row BEFORE animation so length is correct in callback
    comboRow.push(card);
    card.clickable = false;

    // Animate to combo row
    const comboX = (canvas.width / 2) + ((comboRow.length - 1) - 2) * 50 - 20;
    const comboY = 10;

    zzfx(...cardFx);
    card.moveTo(comboX, comboY, 300, 'easeOut', () => {
      // Check if combo row is full
      if (comboRow.length === 5) {
        // Draw replacement card for 5th card before evaluating
        drawNewCard(removedPosition);
        setTimeout(() => evaluateCombo(), 500);
      } else {
        // Draw card immediately for any other situation
        drawNewCard(removedPosition);
      }
    });

    // Add particle effect
    particleSystem.spawnAt(card.x + card.w / 2, card.y + card.h / 2, 5, {
      colors: ['#ff0', '#ffa500'],
      speed: 60,
      spread: 20,
      life: 800
    });
  }
};

// Function to draw a new card from deck to hand
const drawNewCard = (removedPosition) => {
  if (deck.length > 0) {
    // Apply one-time scratch bias to make next card more likely black
    if (scratchBiasActive) {
      for (let i = deck.length - 1; i >= Math.max(0, deck.length - 5); i--) {
        const s = deck[i].suit;
        if (s === '♠' || s === '♣') {
          const [found] = deck.splice(i, 1);
          deck.push(found);
          break;
        }
      }
      scratchBiasActive = false;
    }

    const cardData = deck.pop();
    cardsLeft--;

    // First, animate existing cards sliding left to close the gap
    slideHandCardsLeft(removedPosition, () => {
      // After sliding animation completes, create and draw new card
      const newCard = createCard(
        deckPosition.x,
        deckPosition.y,
        cardData.suit,
        cardData.value
      );

      // Add click handler
      newCard.onClick = () => playCard(newCard);
      newCard.clickable = true;

      // Add new card to the rightmost position in hand array
      playerHand.push(newCard);
      gameObjects.push(newCard);

      // Animate new card to rightmost position (position 4, index 4)
      const rightmostX = (canvas.width / 2) + (4 - 2) * 50 - 20; // position 4
      const handY = canvas.height - 80;

      zzfx(...cardFx);
      // Add a little bounce effect when card arrives
      newCard.moveTo(rightmostX, handY, 400, 'easeOut', () => {

      })
        .scaleTo(1.1, 150, 'easeOut', () => {
          newCard.scaleTo(1, 150, 'easeOut');
        })
        .rotateTo(Math.PI / 10, 200, 'easeOut', newCard => {
          newCard.rotateTo(0, 200, 'easeOut');
        });

      // Add sparkle effect when new card is drawn
      particleSystem.spawnAt(newCard.x + newCard.w / 2, newCard.y + newCard.h / 2, 3, {
        colors: ['#fff', '#ff0'],
        speed: 40,
        spread: 15,
        life: 600
      });
    });

  } else {
    // No cards left in deck - just slide cards left to close gap

    slideHandCardsLeft(removedPosition);

    // Check if we need to end the game early
    if (playerHand.length + comboRow.length < 5) {

      // Will be handled by the next combo evaluation
    }
  }
};

// === Abilities ===
function setupAbilityUI() {
  const bw = 64;
  const bh = 16;
  const gap = 6;
  // 2x2 grid layout at the bottom of aux canvas
  const totalW = 2 * bw + 1 * gap;
  const startX = Math.floor((canvasAux.width - totalW) / 2);
  const yTop = canvasAux.height - (2 * bh + gap) - 4; // 4px padding from bottom
  const yBottom = yTop + bh + gap;

  // Clear any existing buttons (defensive)
  ['pounce', 'purr', 'hiss', 'scratch'].forEach(k => {
    const btn = abilityButtons[k];
    if (btn) {
      const i = auxObjects.indexOf(btn);
      if (i > -1) auxObjects.splice(i, 1);
      abilityButtons[k] = null;
    }
  });

  // Row 1
  abilityButtons.pounce = createButton(startX + 0 * (bw + gap), yTop, bw, bh, 'POUND 1', () => {
    if (gameState !== 'playing') return;
    if (abilities.pounce <= 0) return;
    if (comboRow.length === 0) return;
    abilityState.pounceSelecting = true;
    // Show hint in main canvas near the bottom
    flashText('POUNCE: PICK A CARD', canvas.width / 2, canvas.height - 10, '#ff0');
  });
  abilityButtons.pounce.context = ctxAux;
  abilityButtons.pounce.isAbilityButton = true;
  abilityButtons.purr = createButton(startX + 1 * (bw + gap), yTop, bw, bh, 'PURR 1', () => {
    if (gameState !== 'playing') return;
    if (abilities.purr <= 0) return;
    performPurr();
    abilities.purr--;
    updateAbilityButtons();
  });
  abilityButtons.purr.context = ctxAux;
  abilityButtons.purr.isAbilityButton = true;
  // Row 2
  abilityButtons.hiss = createButton(startX + 0 * (bw + gap), yBottom, bw, bh, 'HISS 1', () => {
    if (gameState !== 'playing') return;
    if (abilities.hiss <= 0) return;
    performHiss();
    abilities.hiss--;
    updateAbilityButtons();
  });
  abilityButtons.hiss.context = ctxAux;
  abilityButtons.hiss.isAbilityButton = true;
  abilityButtons.scratch = createButton(startX + 1 * (bw + gap), yBottom, bw, bh, 'SCRT 1', () => {
    if (gameState !== 'playing') return;
    if (abilities.scratch <= 0) return;
    performScratch();
    abilities.scratch--;
    updateAbilityButtons();
  });
  abilityButtons.scratch.context = ctxAux;
  abilityButtons.scratch.isAbilityButton = true;

  auxObjects.push(
    abilityButtons.pounce,
    abilityButtons.purr,
    abilityButtons.hiss,
    abilityButtons.scratch
  );

  updateAbilityButtons();

  // Ensure cat sprite exists during gameplay
  ensureCatSprite();
}

function updateAbilityButtons() {
  const set = (btn, label, n) => {
    if (!btn) return;
    btn.text = `${label} ${n}`;
    btn.alpha = n > 0 ? 1 : 0.5;
    btn.cacheImage();
  };
  set(abilityButtons.pounce, 'POUND  ', abilities.pounce);
  set(abilityButtons.purr, 'PURR   ', abilities.purr);
  set(abilityButtons.hiss, 'HISS   ', abilities.hiss);
  set(abilityButtons.scratch, 'SCRATCH', abilities.scratch);
}

// === Cat Sprite (aux canvas) ===
function ensureCatSprite() {
  // Create or re-add cat sprite positioned at top-right of aux canvas
  if (catSprite) {
    // already created; ensure it exists in auxObjects
    if (!auxObjects.includes(catSprite)) auxObjects.push(catSprite);
    // also ensure centered
    centerCatSprite();
    return;
  }
  // 3x scale of 32px frame => 96px
  const size = 96;
  const cx = Math.floor((canvasAux.width - size) / 2);
  // move slightly up to make room for score below
  const cy = Math.floor((canvasAux.height - size) / 2) - 8;
  catSprite = createCatSprite(cx, cy, size);
  catSprite.context = ctxAux;
  auxObjects.push(catSprite);
  ensureAuxTitle();
}

function centerCatSprite() {
  if (!catSprite) return;
  const size = catSprite.w; // square
  catSprite.x = Math.floor((canvasAux.width - size) / 2);
  catSprite.y = Math.floor((canvasAux.height - size) / 2) - 8;
  // keep title just above the cat
  if (auxTitle) auxTitle.y = Math.max(4, catSprite.y - 18);
  // position score below the cat
  if (auxScore) auxScore.y = Math.min(canvasAux.height - 10, catSprite.y + catSprite.h + 8);
}

// Title: "POKER MYSTERIO" with cat head replacing the 'O's
function ensureAuxTitle() {
  if (auxTitle) {
    if (!auxObjects.includes(auxTitle)) auxObjects.push(auxTitle);
    // update Y relative to cat
    auxTitle.y = Math.max(4, catSprite ? catSprite.y - 18 : 12);
    return;
  }

  auxTitle = createAnimatable({
    x: 0, // computed in render for centering
    y: Math.max(4, catSprite ? catSprite.y - 18 : 12),
    text: 'POKER MYSTERIO',
    scale: 3,
    alpha: 1,
    rotation: 0,
    clickable: false,
    context: ctxAux,
    update: (self, dt) => { self.updateAnimations(dt); },
    render: (self) => {
      const rctx = self.context || ctxAux;
      // compute total width (every char counts as one cell)
      drawText(self.text, rctx.canvas.width / 2, self.y, '#ff0', self.scale, 'center', rctx);
      if (gameState === 'title') {
        drawText('Game by Vonloxx', rctx.canvas.width / 2, self.y + 130, '#fff', 2, 'center', rctx);
        drawText('Music by Esa Ruoho', rctx.canvas.width / 2, self.y + 150, '#fff', 2, 'center', rctx);
        drawText('Tap to start', rctx.canvas.width / 2, self.y + 180, '#fff', 2, 'center', rctx);
      }
    }
  });
  auxObjects.push(auxTitle);
}

function ensureAuxScore() {
  if (auxScore) {
    if (!auxObjects.includes(auxScore)) auxObjects.push(auxScore);
    // reposition relative to cat
    auxScore.y = Math.min(canvasAux.height - 10, catSprite ? catSprite.y + catSprite.h + 8 : canvasAux.height - 20);
    return;
  }
  auxScore = createAnimatable({
    x: 0,
    y: Math.min(canvasAux.height - 10, catSprite ? catSprite.y + catSprite.h + 18 : canvasAux.height - 20),
    alpha: 1,
    clickable: false,
    context: ctxAux,
    isHudScore: true,
    update: (self, dt) => { self.updateAnimations(dt); },
    render: (self) => {
      const rctx = self.context || ctxAux;
      drawText(`SCORE ${score}`, Math.floor(canvasAux.width / 2), self.y, '#fff', 2, 'center', rctx);
    }
  });
  auxObjects.push(auxScore);
}

// removeCatSprite currently unused (cat persists across states)

function showAbilityPopup(kind, fromHover = false) {
  // Replace any existing popup first
  closeActivePopup();
  const lines = abilityDescriptions[kind] || [kind.toUpperCase()];
  // Compute panel size from lines for aux canvas
  const padding = 6;
  const lineW = Math.max(...lines.map(l => l.length)) * 6;
  const w = Math.min(canvasAux.width - 12, lineW + padding * 2);
  const h = lines.length * 10 + padding * 2;
  const x = Math.floor((canvasAux.width - w) / 2);
  // Place above the bottom button row
  const y = Math.max(4, canvasAux.height - (2 * 16 + 6) - h - 6);

  activePopup = createPanel(x, y, w, h, lines);
  activePopup.context = ctxAux;
  auxObjects.push(activePopup);
  activePopupKind = kind;
  activePopupFromHover = !!fromHover;
}

function closeActivePopup() {
  if (!activePopup) return;
  let idx = gameObjects.indexOf(activePopup);
  if (idx > -1) gameObjects.splice(idx, 1);
  idx = auxObjects.indexOf(activePopup);
  if (idx > -1) auxObjects.splice(idx, 1);
  activePopup = null;
  activePopupKind = null;
  activePopupFromHover = false;
}

function performPounceAt(index) {
  if (index < 0 || index >= comboRow.length) return;
  if (deck.length === 0) { flashText('NO CARDS', canvas.width / 2, deckPosition.y - 8, '#f00'); return; }

  const oldCard = comboRow[index];
  const targetX = (canvas.width / 2) + ((index) - 2) * 50 - 20;
  const targetY = 10;

  // Create a paw that pounces the card, then perform replacement on impact (use sprite at ~3x scale if available)
  const pawSize = 96;
  const cardW = 40, cardH = 60;
  const pawX = Math.floor(targetX + (cardW - pawSize) / 2);
  const pawY = Math.floor(targetY + (cardH - pawSize) / 2);
  const paw = createPawSprite(pawX, -pawSize, pawSize, pawSize);
  gameObjects.push(paw);
  paw.moveTo(pawX, pawY, 250, 'easeIn', () => {
    // Arrival squash
    paw.scaleTo(0.9, 80, 'easeIn', () => paw.scaleTo(1, 120, 'easeOut'));
    // Impact particles
    particleSystem.spawnAt(targetX + 20, targetY + 30, 12, { colors: ['#000', '#444'], speed: 120, life: 500 });

    // Animate old card off-screen, then remove
    oldCard.moveTo(-60, oldCard.y - 10, 250, 'easeIn', () => {
      const i = gameObjects.indexOf(oldCard);
      if (i > -1) gameObjects.splice(i, 1);
    }).fadeTo(0, 250, 'easeIn');

    // Draw a replacement from the top of the deck
    const cardData = deck.pop();
    cardsLeft--;
    const newCard = createCard(deckPosition.x, deckPosition.y, cardData.suit, cardData.value);
    newCard.clickable = false;
    gameObjects.push(newCard);
    // Ensure paw renders on top
    const piBring = gameObjects.indexOf(paw);
    if (piBring > -1) { gameObjects.splice(piBring, 1); gameObjects.push(paw); }
    newCard.scale = 0.8;
    newCard.moveTo(targetX, targetY, 300, 'easeIn').scaleTo(1, 200, 'easeOut');
    comboRow[index] = newCard;

    // Paw exit
    setTimeout(() => {
      paw.moveTo(paw.x, -80, 250, 'easeOut').fadeTo(0, 250, 'easeOut', () => {
        const pi = gameObjects.indexOf(paw);
        if (pi > -1) gameObjects.splice(pi, 1);
      });
    }, 120);
  });
  // Cat paw animation on aux
  if (catSprite && catSprite.pawUp) catSprite.pawUp(600);
}

function performPurr() {
  if (deck.length === 0) { flashText('NO CARDS', canvas.width / 2, deckPosition.y - 8, '#f00'); return; }
  const peek = deck[deck.length - 1];
  const peekCard = createCard(deckPosition.x + 46, deckPosition.y - 10, peek.suit, peek.value);
  peekCard.alpha = 0.9;
  peekCard.clickable = false;
  gameObjects.push(peekCard);
  flashText('PURR', deckPosition.x + 66, deckPosition.y - 20, '#0f0');
  // Float up and fade
  peekCard.moveTo(peekCard.x, peekCard.y - 20, 700, 'easeOut').fadeTo(0, 700, 'easeOut', () => {
    const i = gameObjects.indexOf(peekCard);
    if (i > -1) gameObjects.splice(i, 1);
  });
}

function performHiss() {
  nextScoreMultiplier = 0.8; // -20% on next combo
  flashText('HISS LESS 20PCT NEXT', canvas.width / 2, deckPosition.y + 80, '#f80');
  particleSystem.spawnAt(deckPosition.x + 20, deckPosition.y + 30, 10, { colors: ['#f80', '#f44'], speed: 120, life: 900 });
  // Redeal the hand
  dealCards();
}

function performScratch() {
  // Animate clawed paw hitting the deck and creating scratch marks
  const targetX = deckPosition.x;
  const targetY = deckPosition.y;
  const pawSize = 96;
  const cardW = 40, cardH = 60;
  const pawX = Math.floor(targetX + (cardW - pawSize) / 2);
  const pawY = Math.floor(targetY + (cardH - pawSize) / 2);
  const paw = createPawSprite(pawX, -pawSize, pawSize, pawSize, { claws: true });
  gameObjects.push(paw);
  // Cat paw animation on aux
  if (catSprite && catSprite.pawUp) {
    catSprite.pawUp(700);
  }
  paw.moveTo(pawX, pawY, 250, 'easeIn', () => {
    // Arrival squash
    paw.scaleTo(0.9, 80, 'easeIn', () => paw.scaleTo(1, 120, 'easeOut'));
    // Create scratch marks lasting ~3 seconds
    const marks = createScratchMarks(targetX + 2, targetY + 2, 36, 56);
    gameObjects.push(marks);
    // Ensure paw renders above marks
    const piBring = gameObjects.indexOf(paw);
    if (piBring > -1) { gameObjects.splice(piBring, 1); gameObjects.push(paw); }

    // Burn top up to 3 cards and enable next-draw bias
    let burned = 0;
    for (let i = 0; i < 3; i++) {
      if (deck.length === 0) break;
      deck.pop();
      burned++;
    }
    if (burned > 0) {
      cardsLeft -= burned;
      scratchBiasActive = true;
      flashText(`SCRATCH -${burned}`, deckPosition.x + 20, deckPosition.y - 20, '#ff0');
      particleSystem.spawnAt(deckPosition.x + 20, deckPosition.y + 30, 12, { colors: ['#ff0', '#f00'], speed: 150, life: 1000 });
    }

    // Paw retreat
    setTimeout(() => {
      paw.moveTo(paw.x, -80, 250, 'easeOut').fadeTo(0, 250, 'easeOut', () => {
        const pi = gameObjects.indexOf(paw);
        if (pi > -1) gameObjects.splice(pi, 1);
      });
    }, 120);
  });
}

function flashText(text, x, y, color = '#fff') {
  const t = createText(x - (text.length * 3), y, text, color, 1, 'left');
  gameObjects.push(t);
  t.fadeTo(0, 2000, 'easeOut', () => {
    const i = gameObjects.indexOf(t);
    if (i > -1) gameObjects.splice(i, 1);
  });
}

// === Title Screen Helpers ===
function enterTitle() {
  gameState = 'title';
  // Clear gameplay objects and popups
  gameObjects = [];
  titleObjects = [];
  if (activePopup) closeActivePopup();
  // Prepare aux canvas elements: cat + title (no ability buttons)
  auxObjects = [];
  catSprite = null;
  auxTitle = null;
  ensureCatSprite();
  ensureAuxTitle();
  // Create orbiting cards animation
  setupTitleAnimation();
}

function setupTitleAnimation() {
  titleObjects = [];
  const centers = [
    { x: canvas.width / 2 - 60, y: canvas.height / 2 - 30 },
    { x: canvas.width / 2 + 60, y: canvas.height / 2 - 30 },
    { x: canvas.width / 2, y: canvas.height / 2 + 10 }
  ];
  const radii = [40, 48, 56];
  const speeds = [0.0012, 0.0010, 0.0009];
  let k = 0;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < 2; j++) {
      const suit = suits[(i * 2 + j) % suits.length];
      const value = values[(k * 3) % values.length];
      const angle = Math.random() * Math.PI * 2;
      const card = createOrbitCard(centers[i].x, centers[i].y, radii[i], speeds[i] * (j ? -1 : 1), angle, suit, value);
      titleObjects.push(card);
      k++;
    }
  }
}

function createOrbitCard(cx, cy, radius, speed, angle, suit, value) {
  // Start at computed position
  const startX = cx + radius * Math.cos(angle) - 20;
  const startY = cy + radius * Math.sin(angle) - 30;
  const card = createCard(startX, startY, suit, value);
  card.clickable = false;
  card.alpha = 0.95;
  card.orbit = { cx, cy, r: radius, a: angle, v: speed };
  const originalUpdate = card.update;
  card.update = (self, dt) => {
    // Advance angle
    self.orbit.a += self.orbit.v * dt;
    const x = self.orbit.cx + self.orbit.r * Math.cos(self.orbit.a) - self.w / 2;
    const y = self.orbit.cy + self.orbit.r * Math.sin(self.orbit.a) - self.h / 2;
    self.x = x;
    self.y = y;
    // Rotation bounce
    self.rotation = 0.25 * Math.sin(self.orbit.a * 3);
    // Pulsing scale subtle
    self.scale = 1 + 0.03 * Math.sin(self.orbit.a * 2);
    if (originalUpdate) originalUpdate(self, dt);
  };
  return card;
}

// Function to slide hand cards left to close gap after card is removed
const slideHandCardsLeft = (removedPosition, onComplete = null) => {
  // Move all cards that were to the right of removed card one position left
  let animationsCompleted = 0;
  let totalAnimations = 0;

  playerHand.forEach((card, currentIndex) => {
    const targetX = (canvas.width / 2) + (currentIndex - 2) * 50 - 20;
    const targetY = canvas.height - 80;

    // Only animate cards that need to move
    if (Math.abs(card.x - targetX) > 5) {
      totalAnimations++;
      setTimeout(() => {
        card.moveTo(targetX, targetY, 400, 'easeOut', () => {
          animationsCompleted++;
          // Call onComplete when all animations finish
          if (onComplete && animationsCompleted === totalAnimations) {
            onComplete();
          }
        }).rotateTo(-Math.PI / 10, 200, 'easeOut', card => {
          card.rotateTo(0, 200, 'easeOut');
        });
      }, currentIndex * 100);
    }
  });

  // If no animations needed, call onComplete immediately
  if (totalAnimations === 0 && onComplete) {
    onComplete();
  }
};

const evaluateCombo = () => {
  if (comboRow.length !== 5) return;

  gameState = 'evaluating';
  const result = evaluateHand(comboRow);

  const finalScore = Math.max(0, Math.round(result.score * (nextScoreMultiplier || 1)));
  score += finalScore;

  // Clear temporary multiplier after use
  nextScoreMultiplier = 1;

  // Show result text
  const textLength = result.name.length * 6;
  const resultText = createText(canvas.width / 2, canvas.height / 2,
    `${result.name}!`, '#ff0', 1, 'left');
  const scoreText = createText(canvas.width / 2, canvas.height / 2 + 20,
    `+${finalScore}`, '#0f0', 1, 'left');

  gameObjects.push(resultText, scoreText);

  // Animate result text with removal after fade
  resultText.rotation = Math.PI / 2
  resultText.scale = 1;
  zzfx(...handFx);
  resultText.scaleTo(3, 500, 'easeOut').rotateTo(0, 500, 'easeOut', obj => {
    setTimeout(() => {
      obj.scaleTo(0, 300, 'easeOut', () => {
        // Remove from gameObjects after fade completes
        const index = gameObjects.indexOf(resultText);
        if (index > -1) gameObjects.splice(index, 1);
      });
    }, 300);
  });

  scoreText.moveTo(scoreText.x, scoreText.y - 30, 1000, 'easeOut').fadeTo(0, 2000, 'easeOut', () => {
    // Remove from gameObjects after fade completes
    const index = gameObjects.indexOf(scoreText);
    if (index > -1) gameObjects.splice(index, 1);
  });

  // Cat tail wag on any scoring
  if (catSprite && catSprite.wag) {
    catSprite.wag(800);
  }

  // Fireworks for good hands
  if (result.score >= 500) {
    if (catSprite && catSprite.wag) catSprite.wag(1200);
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        particleSystem.burst(
          canvas.width / 2 + (Math.random() - 0.5) * 200,
          canvas.height / 2 + (Math.random() - 0.5) * 100,
          20,
          {
            colors: ['#ff0', '#f0f', '#0ff', '#f00', '#0f0'],
            speed: 150,
            spread: 50,
            life: 2000
          }
        );
      }, i * 300);
    }
  }

  // Clean up combo row after delay
  setTimeout(() => {
    comboRow.forEach((card, i) => {
      setTimeout(() => {
        zzfx(...cardFx);
        card.moveTo(-100, card.y - (i * 30), 400, 'easeIn', () => {
          const index = gameObjects.indexOf(card);
          if (index > -1) gameObjects.splice(index, 1);
        })
          .rotateTo(-Math.PI / 6, 200, 'easeOut', card => {
            card.rotateTo(0, 200, 'easeOut');
          });
      }, 100 * i);
    });

    comboRow = [];

    // Check if game should continue
    setTimeout(() => {
      // Check if we have enough cards in hand and deck to continue playing
      const totalAvailableCards = playerHand.length + deck.length;

      if (totalAvailableCards >= 5) {
        gameState = 'playing';
        // No need to deal new cards here since they're drawn individually as played
      } else {
        // Game over - not enough cards to complete another combo
        gameState = 'gameOver';
        if (activePopup) closeActivePopup();
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('pokerHighScore', highScore.toString());
        }

      }
    }, 1000);

  }, 2000);
};

// Factory functions for creating game objects (no classes needed!)

// Generic animation component - can be mixed into any object
const createAnimatable = (obj) => {
  obj.animations = [];
  obj._imageCache = null; // Will store pre-rendered image

  // Pre-render the object to an off-screen canvas for crisp scaling
  obj.cacheImage = () => {
    if (!obj.renderToCache) return; // Skip if no cache renderer defined

    // Create off-screen canvas
    const cacheCanvas = document.createElement('canvas');
    const cacheCtx = cacheCanvas.getContext('2d');

    // Disable antialiasing for the cache canvas too
    cacheCtx.imageSmoothingEnabled = false;
    cacheCtx.mozImageSmoothingEnabled = false;
    cacheCtx.webkitImageSmoothingEnabled = false;
    cacheCtx.msImageSmoothingEnabled = false;
    cacheCtx.oImageSmoothingEnabled = false;

    // Set canvas size (allow object to define its cache size)
    cacheCanvas.width = obj.cacheWidth || obj.w || 64;
    cacheCanvas.height = obj.cacheHeight || obj.h || 64;

    // Render object to cache using the cache context
    obj.renderToCache(obj, cacheCtx);

    obj._imageCache = cacheCanvas;
  };

  // Add animation methods to the object
  obj.moveTo = (targetX, targetY, duration, easing = 'linear', onComplete = null) => {
    obj.animations.push({
      type: 'move',
      startX: obj.x, startY: obj.y,
      targetX, targetY,
      duration, elapsed: 0, easing, onComplete
    });
    return obj; // chainable
  };

  obj.scaleTo = (targetScale, duration, easing = 'linear', onComplete = null) => {
    obj.animations.push({
      type: 'scale',
      startScale: obj.scale || 1,
      targetScale,
      duration, elapsed: 0, easing, onComplete
    });
    return obj; // chainable
  };

  obj.rotateTo = (targetRotation, duration, easing = 'linear', onComplete = null) => {
    obj.animations.push({
      type: 'rotate',
      startRotation: obj.rotation || 0,
      targetRotation,
      duration, elapsed: 0, easing, onComplete
    });
    return obj; // chainable
  };

  obj.fadeTo = (targetAlpha, duration, easing = 'linear', onComplete = null) => {
    obj.animations.push({
      type: 'fade',
      startAlpha: obj.alpha || 1,
      targetAlpha,
      duration, elapsed: 0, easing, onComplete
    });
    return obj; // chainable
  };

  // Update animations (call this in object's update method)
  obj.updateAnimations = (dt) => {
    for (let i = obj.animations.length - 1; i >= 0; i--) {
      const anim = obj.animations[i];
      anim.elapsed += dt;

      const progress = Math.min(anim.elapsed / anim.duration, 1);
      const easedProgress = easeFunction(progress, anim.easing);

      switch (anim.type) {
        case 'move':
          obj.x = lerp(anim.startX, anim.targetX, easedProgress);
          obj.y = lerp(anim.startY, anim.targetY, easedProgress);
          break;
        case 'scale':
          obj.scale = lerp(anim.startScale, anim.targetScale, easedProgress);
          break;
        case 'rotate':
          obj.rotation = lerp(anim.startRotation, anim.targetRotation, easedProgress);
          break;
        case 'fade':
          obj.alpha = lerp(anim.startAlpha, anim.targetAlpha, easedProgress);
          break;
      }

      if (progress >= 1) {
        // Call completion callback if provided
        if (anim.onComplete && typeof anim.onComplete === 'function') {
          anim.onComplete(obj, anim);
        }
        obj.animations.splice(i, 1); // Remove completed animation
      }
    }
  };

  // Enhanced render method that uses cached image when available
  obj.renderCached = (fallbackRender) => {
    const renderCtx = obj.context || ctx; // allow objects to target aux context
    if (obj._imageCache) {
      // Use cached image for crisp scaling
      renderCtx.save();
      renderCtx.globalAlpha = obj.alpha || 1;
      renderCtx.translate(obj.x + (obj.w || obj.cacheWidth || 64) / 2,
        obj.y + (obj.h || obj.cacheHeight || 64) / 2);
      renderCtx.scale(obj.scale || 1, obj.scale || 1);
      renderCtx.rotate(obj.rotation || 0);

      renderCtx.drawImage(obj._imageCache,
        -(obj.w || obj.cacheWidth || 64) / 2,
        -(obj.h || obj.cacheHeight || 64) / 2);

      renderCtx.restore();
    } else {
      // Fall back to regular rendering
      fallbackRender(obj);
    }
  };

  return obj;
};

// Helper functions for animations
const lerp = (start, end, t) => start + (end - start) * t;

const easeFunction = (t, type) => {
  switch (type) {
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    default: return t; // linear
  }
};

// Card factory - returns plain object with methods
const createCard = (x, y, suit, value) => {
  const card = createAnimatable({
    x, y, suit, value,
    w: 40, h: 60,
    vx: 0, vy: 0,
    scale: 1,
    alpha: 1,
    rotation: 0,
    cacheWidth: 40,
    cacheHeight: 60,

    // Render method for caching (draws to off-screen canvas)
    renderToCache: (self, cacheCtx) => {
      // Draw card to cache canvas using the cache context
      cacheCtx.fillStyle = '#333';
      cacheCtx.fillRect(0, 0, self.w, self.h);
      cacheCtx.fillStyle = '#fff';
      cacheCtx.fillRect(2, 2, self.w - 4, self.h - 4);

      const color = self.suit === '♥' || self.suit === '♦' ? '#f00' : '#000';
      drawText(self.value, 5, 5, color, 2, 'left', cacheCtx);
      drawText(self.suit, 15, 25, color, 2, 'left', cacheCtx);
    },

    // Using arrow functions to avoid 'this' binding issues
    update: (self, dt) => {
      self.x += self.vx * dt * 0.1;
      self.y += self.vy * dt * 0.1;
      self.vx *= 0.95; // friction
      self.vy *= 0.95;

      // Update animations
      self.updateAnimations(dt);
    },

    render: (self) => {
      // Use cached rendering for crisp scaling, with fallback
      self.renderCached((self) => {
        // Fallback rendering (original method)
        ctx.save();
        ctx.globalAlpha = self.alpha;
        ctx.translate(self.x + self.w / 2, self.y + self.h / 2);
        ctx.scale(self.scale, self.scale);
        ctx.rotate(self.rotation);
        ctx.translate(-self.w / 2, -self.h / 2);

        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, self.w, self.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(2, 2, self.w - 4, self.h - 4);

        drawText(self.value, 5, 5, '#000', 1);
        drawText(self.suit, 5, 15, self.suit === '♥' || self.suit === '♦' ? '#f00' : '#000', 1);

        ctx.restore();
      });
    }
  });

  // Cache the card image immediately
  card.cacheImage();

  return card;
};

// Animated text object factory
const createText = (x, y, text, color = '#fff', scale = 1, alignment = 'left') => {
  // Calculate text dimensions for caching
  const textWidth = text.length * 6 * scale;
  const textHeight = 7 * scale;

  const textObj = createAnimatable({
    x, y, text, color,
    scale: scale,
    alpha: 1,
    rotation: 0,
    alignment: alignment,
    w: textWidth,
    h: textHeight,
    cacheWidth: textWidth,
    cacheHeight: textHeight,

    // Render method for caching
    renderToCache: (self, cacheCtx) => {
      drawText(self.text, 0, 0, self.color, scale, alignment, cacheCtx);
    },

    update: (self, dt) => {
      self.updateAnimations(dt);
    },

    render: (self) => {
      // Use cached rendering for crisp scaling
      self.renderCached((self) => {
        // Fallback rendering
        ctx.save();
        ctx.globalAlpha = self.alpha;
        ctx.translate(self.x, self.y);
        ctx.scale(self.scale, self.scale);
        ctx.rotate(self.rotation);

        drawText(self.text, 0, 0, self.color, 1, self.alignment);

        ctx.restore();
      });
    }
  });

  // Cache the text image immediately
  textObj.cacheImage();

  return textObj;
};

// 16x16 cat sprite built from bit patterns, scaled to 32x32 (scale=2)
function createCatSprite(x, y, size = 32) {
  const frameW = 32;
  const frameH = 32;
  const w = size;
  const h = size;

  const cat = createAnimatable({
    x, y, w, h,
    scale: 1,
    alpha: 1,
    rotation: 0,
    clickable: false,
    context: ctxAux,
    _wagging: false,
    _wagElapsed: 0,
    _wagDuration: 0,
    _wagSpeed: 120, // ms per step
    // paw raise animation (frames 3,4)
    _pawAnimating: false,
    _pawElapsed: 0,
    _pawDuration: 0,
    _pawSpeed: 120,

    wag: function (duration = 1000) {
      this._wagging = true;
      this._wagElapsed = 0;
      this._wagDuration = duration;
      return this;
    },
    pawUp: function (duration = 500) {
      this._pawAnimating = true;
      this._pawElapsed = 0;
      this._pawDuration = duration;
      return this;
    },

    update: (self, dt) => {
      self.updateAnimations(dt);
      if (self._wagging) {
        self._wagElapsed += dt;
        if (self._wagElapsed >= self._wagDuration) {
          self._wagging = false;
        } else {
          // keep elapsed running; frame chosen in render
        }
      }
      if (self._pawAnimating) {
        self._pawElapsed += dt;
        if (self._pawElapsed >= self._pawDuration) {
          self._pawAnimating = false;
        }
      }
    },

    render: (self) => {
      const rctx = self.context || ctxAux;
      if (catFrameCount() === 0) return;
      rctx.save();
      rctx.globalAlpha = self.alpha;
      let frameIndex;
      if (self._pawAnimating) {
        const step = Math.floor(self._pawElapsed / self._pawSpeed) % 4; // 0..3
        frameIndex = frameOrClamp([CAT_FRAMES.pawMove0, CAT_FRAMES.pawMove1, CAT_FRAMES.pawMove0, CAT_FRAMES.wag1][step]);
      } else {
        // tail wag cycle (includes frame 0)
        if (self._wagging) {
          const cycle = [CAT_FRAMES.wag0, CAT_FRAMES.wag1, CAT_FRAMES.wag2, CAT_FRAMES.wag1];
          const step = Math.floor(self._wagElapsed / self._wagSpeed) % cycle.length;
          frameIndex = frameOrClamp(cycle[step]);
        } else {
          frameIndex = frameOrClamp(CAT_FRAMES.wag1); // neutral center
        }
      }
      const sx = frameIndex * frameW;
      const sy = 0;
      rctx.drawImage(catImg, sx, sy, frameW, frameH, self.x, self.y, self.w, self.h);
      rctx.restore();
    }
  });

  // Start neutral tail (center)
  return cat;
}

// Particle factory for effects
const createParticle = (x, y, vx, vy, color = '#ff0', life = 1000) => ({
  x, y, vx, vy, color, life,
  maxLife: life,

  update: (self, dt) => {
    self.x += self.vx * dt * 0.01;
    self.y += self.vy * dt * 0.01;
    self.vy += 1 * dt * 0.01; // gravity
    self.vx *= 0.99; // air resistance
    self.life -= dt;
    return self.life > 0; // return false when dead
  },

  render: (self) => {
    const alpha = self.life / self.maxLife;
    const size = Math.max(1, alpha * 4); // shrink over time
    ctx.globalAlpha = alpha;
    ctx.fillStyle = self.color;
    ctx.fillRect(self.x - size / 2, self.y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
});

// Button factory
const createButton = (x, y, w, h, text, onClick) => {
  const button = createAnimatable({
    x, y, w, h, text, onClick,
    pressed: false,
    clickable: true,
    scale: 1,
    alpha: 1,
    rotation: 0,
    cacheWidth: w,
    cacheHeight: h,

    // Render method for caching
    renderToCache: (self, cacheCtx) => {
      cacheCtx.fillStyle = self.pressed ? '#666' : '#999';
      cacheCtx.fillRect(0, 0, self.w, self.h);
      cacheCtx.fillStyle = '#fff';
      cacheCtx.fillRect(2, 2, self.w - 4, self.h - 4);

      drawText(self.text, self.w / 2, self.h / 2, '#000', 1, 'center', cacheCtx);
    },

    update: (self, dt) => {
      self.updateAnimations(dt);
      // Handle click detection here if needed
    },

    render: (self) => {
      // Use cached rendering for crisp scaling
      self.renderCached((self) => {
        // Fallback rendering
        ctx.save();
        ctx.globalAlpha = self.alpha;
        ctx.translate(self.x + self.w / 2, self.y + self.h / 2);
        ctx.scale(self.scale, self.scale);
        ctx.rotate(self.rotation);
        ctx.translate(-self.w / 2, -self.h / 2);

        ctx.fillStyle = self.pressed ? '#666' : '#999';
        ctx.fillRect(0, 0, self.w, self.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(2, 2, self.w - 4, self.h - 4);

        const textX = (self.w - self.text.length * 6) / 2;
        drawText(self.text, textX, 10, '#000', 1);

        ctx.restore();
      });
    }
  });

  // Cache the button image immediately
  button.cacheImage();

  return button;
};

// Simple panel for popups
const createPanel = (x, y, w, h, lines) => {
  const panel = createAnimatable({
    x, y, w, h,
    lines,
    alpha: 1,
    scale: 1,
    rotation: 0,
    cacheWidth: w,
    cacheHeight: h,
    clickable: true,
    onClick: () => closeActivePopup(),

    renderToCache: (self, cacheCtx) => {
      // Background and border
      cacheCtx.fillStyle = '#222';
      cacheCtx.fillRect(0, 0, self.w, self.h);
      cacheCtx.strokeStyle = '#fff';
      cacheCtx.lineWidth = 2;
      cacheCtx.strokeRect(0, 0, self.w, self.h);

      // Text lines
      const padding = 6;
      for (let i = 0; i < self.lines.length; i++) {
        const line = self.lines[i];
        const tx = Math.floor((self.w - line.length * 6) / 2);
        const ty = padding + i * 10 + 1;
        drawText(line, tx, ty, '#ff0', 1, 'left', cacheCtx);
      }
    },

    update: (self, dt) => {
      self.updateAnimations(dt);
    },

    render: (self) => {
      self.renderCached((self) => {
        ctx.save();
        ctx.globalAlpha = self.alpha;
        ctx.translate(self.x + self.w / 2, self.y + self.h / 2);
        ctx.scale(self.scale, self.scale);
        ctx.rotate(self.rotation);
        ctx.translate(-self.w / 2, -self.h / 2);

        // Fallback draw
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, self.w, self.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, self.w, self.h);
        const padding = 6;
        for (let i = 0; i < self.lines.length; i++) {
          const line = self.lines[i];
          const tx = Math.floor((self.w - line.length * 6) / 2);
          const ty = padding + i * 10 + 1;
          drawText(line, tx, ty, '#ff0', 1);
        }

        ctx.restore();
      });
    }
  });
  panel.cacheImage();
  return panel;
};

function createPawSprite(x, y, w = 96, h = 96, options = { claws: false }) {
  const paw = createAnimatable({
    x, y, w, h,
    alpha: 1,
    scale: 1,
    rotation: 0,
    clickable: false,
    update: (self, dt) => { self.updateAnimations(dt); },
    render: (self) => {
      ctx.save();
      ctx.globalAlpha = self.alpha;
      const useClaws = options && options.claws;
      if (catFrameCount() > CAT_FRAMES.pawClaw) {
        const fi = useClaws ? catPawClawsFrame() : catPawFrame();
        const sx = fi * CAT_FRAME_W;
        ctx.drawImage(catImg, sx, 0, CAT_FRAME_W, CAT_FRAME_W, self.x, self.y, self.w, self.h);
      }
      ctx.restore();
    }
  });
  return paw;
}

// Scratch marks object
function createScratchMarks(x, y, w, h) {
  const lifetime = 3000;
  const marks = createAnimatable({
    x, y, w, h,
    t: 0,
    alpha: 1,
    clickable: false,
    update: (self, dt) => {
      self.t += dt;
      const remain = Math.max(0, lifetime - self.t);
      self.alpha = remain < 600 ? remain / 600 : 1;
      // end after lifetime
      if (self.t >= lifetime) return false;
    },
    render: (self) => {
      if (catFrameCount() === 0) return; // no-op until ready
      ctx.save();
      ctx.globalAlpha = self.alpha;
      const fi = catScratchFrame();
      const sx = fi * CAT_FRAME_W;
      ctx.drawImage(catImg, sx, 0, CAT_FRAME_W, CAT_FRAME_W, self.x, self.y, self.w, self.h);
      ctx.restore();
    }
  });
  return marks;
}

// Generic object pool for recycling (size optimization)
const pool = {
  particles: [],
  get: () => pool.particles.pop(),
  put: (obj) => {
    // Reset particle properties for reuse
    obj.life = obj.maxLife;
    pool.particles.push(obj);
  }
};

// Particle system component
const createParticleSystem = () => ({
  lastSpawnTime: 0,
  spawnInterval: 20, // ms between spawns

  // Spawn a single particle with given parameters
  spawn: (x, y, vx, vy, color, life = 2000) => {
    let particle = pool.get();
    if (!particle) {
      particle = createParticle(0, 0, 0, 0, '#fff', life);
    }

    // Set particle properties
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.color = color;
    particle.life = particle.maxLife = life;

    gameObjects.push(particle);
    return particle;
  },

  // Spawn particles at a specific location
  spawnAt: (x, y, count = 1, options = {}) => {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const particle = particleSystem.spawn(
        x + (Math.random() - 0.5) * (options.spread || 20),
        y + (Math.random() - 0.5) * (options.spread || 20),
        (Math.random() - 0.5) * (options.speed || 100),
        (Math.random() - 0.5) * (options.speed || 100),
        options.colors ? options.colors[Math.floor(Math.random() * options.colors.length)] : '#ff0',
        options.life || 2000
      );
      particles.push(particle);
    }
    return particles;
  },

  // Burst effect - spawn many particles at once
  burst: (x, y, count = 10, options = {}) => {
    return particleSystem.spawnAt(x, y, count, {
      spread: options.spread || 30,
      speed: options.speed || 150,
      colors: options.colors || ['#ff0', '#f0f', '#0ff', '#f00', '#0f0'],
      life: options.life || 1500
    });
  },

  // Continuous spawning update (call in game update loop)
  update: (dt, gameTime) => {
    // No auto-spawn on title screen anymore
  }
});

// Create global particle system instance
const particleSystem = createParticleSystem();

// Helper function to update all objects
const updateObjects = (objects, dt) => {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const alive = obj.update(obj, dt);
    if (alive === false) {
      // Recycle particle to pool
      if (obj.maxLife !== undefined) {
        pool.put(obj);
      }
      objects.splice(i, 1);
    }
  }
};

// Helper function to render all objects  
const renderObjects = (objects) => {
  objects.forEach(obj => obj.render(obj));
};

// Game update function
function update(deltaTime) {
  gameTime += deltaTime;

  if (gameState === 'title') {
    updateObjects(titleObjects, deltaTime);
  } else {
    // Update all game objects
    updateObjects(gameObjects, deltaTime);
  }
  // Update auxiliary UI objects
  updateObjects(auxObjects, deltaTime);

  // Update particle system (handles spawning automatically)
  particleSystem.update(deltaTime, gameTime);
}

// Game render function
function render() {
  // Render plasma background (low-res canvas scaled by CSS)
  renderPlasma(gameTime);
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctxAux.clearRect(0, 0, canvasAux.width, canvasAux.height);

  if (gameState === 'title') {
    // Title screen: render orbiting cards animation on main canvas only
    renderObjects(titleObjects);
  } else if (gameState === 'gameOver') {
    // Game over screen - centered texts
    drawText('GAME OVER', canvas.width / 2, canvas.height / 2 - 28, '#f00', 3, 'center');
    const finalLine = `FINAL SCORE ${score}`;
    drawText(finalLine, canvas.width / 2, canvas.height / 2 + 2, '#fff', 2, 'center');
    if (score === highScore) {
      drawText('NEW HIGH SCORE!', canvas.width / 2, canvas.height / 2 + 28, '#ff0', 2, 'center');
    }
    drawText('TAP TO CONTINUE', canvas.width / 2, canvas.height / 2 + 56, '#0f0', 1, 'center');

  } else {
    // Playing state - render game UI
    // Draw deck (if cards left)
    if (cardsLeft > 0) {
      ctx.fillStyle = '#333';
      ctx.fillRect(deckPosition.x, deckPosition.y, 40, 60);
      ctx.fillStyle = '#666';
      ctx.fillRect(deckPosition.x + 2, deckPosition.y + 2, 36, 56);
      // Overlay remaining cards count centered on the deck
      const deckCenterX = deckPosition.x + 20;
      const deckCenterY = deckPosition.y + 30;
      drawText(`${cardsLeft}`.toString(), deckCenterX, deckCenterY, '#fff', 2, 'center');
    }

    // Game UI (main canvas): only non-score info
    const hudX = deckPosition.x + 60;
    const hudY = deckPosition.y + 20;
    if (nextScoreMultiplier < 1) {
      drawText('CURSE -20% NEXT', hudX, hudY + 10, '#f80', 1);
    }

    // Instructions
    if (gameState === 'playing' && comboRow.length === 0) {
      drawText('TAP CARDS TO PLAY', canvas.width / 2, canvas.height - 28, '#888', 1, 'center');
    }
    if (gameState === 'playing' && abilityState.pounceSelecting) {
      drawText('SELECT A COMBO CARD', canvas.width / 2, 10, '#ff0', 1, 'center');
    }
  }

  // Render layers based on state
  if (gameState === 'playing' || gameState === 'evaluating') {
    renderObjects(gameObjects);
    renderObjects(auxObjects);
  } else if (gameState === 'title') {
    // cat + title on aux, hide score/buttons
    auxObjects.forEach(obj => { if (!obj.isAbilityButton && !obj.isHudScore) obj.render(obj); });
  } else if (gameState === 'gameOver') {
    // Hide remaining cards and ability buttons during game over
    // Only render aux elements that are not ability buttons or HUD score
    auxObjects.forEach(obj => { if (!obj.isAbilityButton && !obj.isHudScore) obj.render(obj); });
  }
}

// Main game loop using requestAnimationFrame
function gameLoop(currentTime) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Update game logic
  update(deltaTime);

  // Render game
  render();

  // Request next frame
  requestAnimationFrame(gameLoop);
}

function renderPlasma(t) {
  if (canvasBg) {
    let w = canvasBg.width | 0,
        h = canvasBg.height | 0,
        g = ctxBg.getImageData(0, 0, w, h), 
        d = g.data, 
        m = t * 16e-5, 
        x, y, i, u;
    
    for (y = 0; y < h; y++)
      for (x = 0; x < w; x++)
        i = (y * w + x) * 4,
        u = ((Math.sin(x / w * 12.566) + Math.sin((y / h * 4 - m * 1.2) * 3.14159) + Math.sin(((x / w + y / h) * 3 + m * .7) * 3.14159)) / (3 * (Math.cos(m * 3) + 2)) + 1) * .5,
        u = ((u * 7 + .5) | 0) / 7, 
        d[i] = 5 + 15 * u | 0,
        d[i + 1] = 40 + 80 * u | 0,
        d[i + 2] = 28 + 58 * u | 0,
        d[i + 3] = 255; 

    ctxBg.putImageData(g, 0, 0)
  }
}

function resizeCanvases() {
  let p = matchMedia('(orientation: portrait)').matches,
      c = p ? 1 : 2,
      r = p ? 2 : 1,
      s = Math.min(innerWidth / (256 * c), innerHeight / (240 * r)),
      w = 256 * s + 'px',
      h = 240 * s + 'px';
  canvas.style.width = canvasAux.style.width = w;
  canvas.style.height = canvasAux.style.height = h;
  centerCatSprite();
}

window.addEventListener('resize', resizeCanvases);
window.addEventListener('orientationchange', resizeCanvases);
resizeCanvases();

// Inject PWA links and SW only for non-js13k builds
function setupPWA() {
  if (import.meta.env.MODE === 'js13k') return;
  const head = document.head;
  const base = (import.meta.env.BASE_URL || '/');
  const m = document.createElement('link');
  m.rel = 'manifest';
  m.href = base + 'manifest.webmanifest';
  head.appendChild(m);
  const a = document.createElement('link');
  a.rel = 'apple-touch-icon';
  a.href = base + 'icons/icon-192.png';
  head.appendChild(a);
  const favIcon = document.createElement('link');
  favIcon.rel = 'icon';
  favIcon.href = '/favicon.ico';
  favIcon.sizes = 'any';
  head.appendChild(favIcon);
  const meta1 = document.createElement('meta');
  meta1.name = 'theme-color';
  meta1.content = '#0f5f3f';
  head.appendChild(meta1);
  const meta2 = document.createElement('meta');
  meta2.name = 'apple-mobile-web-app-capable';
  meta2.content = 'yes';
  head.appendChild(meta2);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(base + 'sw.js').catch(() => { });
    });
  }
}
setupPWA();

// Defer starting until spritesheet is loaded
let booted = false;
function waitForSprites() {
  const waitImage = (img) => new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
  return Promise.all([waitImage(catImg), waitImage(fontImg)]);
}

(async function boot() {
  await waitForSprites();
  booted = true;
  enterTitle();
  requestAnimationFrame(gameLoop);
})();
