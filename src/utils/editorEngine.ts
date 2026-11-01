export type AspectRatioOption = 'Free' | '1:1' | '4:5' | '16:9' | '9:16' | '3:2' | '4:3';

export type FilterCategory = 'All' | 'Pictorial' | 'Film' | 'Cinema' | 'B&W';

export type FilterId =
  | 'none'
  | 'pictorialist'
  | 'orton_dream'
  | 'cyanotype'
  | 'sepia_gum'
  | 'portra'
  | 'kodachrome'
  | 'velvia'
  | 'golden_dusk'
  | 'cine_teal'
  | 'tokyo_neon'
  | 'nordic'
  | 'matte_editorial'
  | 'silver_bw'
  | 'platinum_bw';

export type BorderStyleId =
  | 'none'
  | 'gallery_white'
  | 'darkroom_black'
  | 'film_frame'
  | 'polaroid'
  | 'museum_gold'
  | 'warm_linen';

export type LightLeakId =
  | 'none'
  | 'golden_flare'
  | 'prism_burn'
  | 'amber_edge'
  | 'cinema_streak';

export interface CropBox {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0.1..1
  height: number; // 0.1..1
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // 0..1
  y: number; // 0..1
  color: string;
  fontSize: number; // 14..72
  fontStyle?: 'sans' | 'serif' | 'mono';
}

export interface DrawStroke {
  id: string;
  points: Array<{ x: number; y: number }>; // normalized 0..1
  color: string;
  size: number; // 2..32
}

export interface PhotoEditState {
  // Crop & Geometry
  aspectRatio: AspectRatioOption;
  straighten: number; // -45..45
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  crop: CropBox;

  // Light & Color Adjustments
  brightness: number; // -100..100
  exposure: number; // -100..100
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  fade: number; // 0..100 (Matte lifted black point)
  saturation: number; // -100..100
  vibrance: number; // -100..100 (Smart skin-safe saturation)
  warmth: number; // -100..100
  tint: number; // -100..100

  // Pictorial & Optical Detail Adjustments
  clarity: number; // -100..100 (Midtone punch / softness)
  pictorialGlow: number; // 0..100 (Orton dream highlight bloom)
  grain: number; // 0..100 (35mm silver halide film grain)
  splitTone: number; // -100..100 (Warm highlight / cool shadow split)
  sharpness: number; // 0..100
  vignette: number; // 0..100

  // Adjustable Filter
  filterId: FilterId;
  filterIntensity: number; // 0..100

  // Light Leaks, Annotations & Borders
  lightLeakId: LightLeakId;
  lightLeakIntensity: number; // 0..100
  textOverlays: TextOverlay[];
  drawStrokes: DrawStroke[];
  borderStyle: BorderStyleId;
  borderWidth: number; // 0..100
}

export interface LookRecipe {
  id: string;
  name: string;
  category: string;
  description: string;
  isBuiltIn: boolean;
  createdAt?: string;
  overrides: Partial<PhotoEditState>;
}

export const DEFAULT_EDIT_STATE: PhotoEditState = {
  aspectRatio: 'Free',
  straighten: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  brightness: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  saturation: 0,
  vibrance: 0,
  warmth: 0,
  tint: 0,
  clarity: 0,
  pictorialGlow: 0,
  grain: 0,
  splitTone: 0,
  sharpness: 0,
  vignette: 0,
  filterId: 'none',
  filterIntensity: 100,
  lightLeakId: 'none',
  lightLeakIntensity: 65,
  textOverlays: [],
  drawStrokes: [],
  borderStyle: 'none',
  borderWidth: 0,
};

export const FILTER_CATALOG: Array<{
  id: FilterId;
  name: string;
  category: Exclude<FilterCategory, 'All'>;
  tagline: string;
  accentHex: string;
}> = [
  { id: 'none', name: 'Original', category: 'Film', tagline: 'Optical neutral', accentHex: '#71717a' },
  { id: 'pictorialist', name: 'Pictorial 1904', category: 'Pictorial', tagline: 'Soft Orton glow & platinum tone', accentHex: '#d97706' },
  { id: 'orton_dream', name: 'Orton Bloom', category: 'Pictorial', tagline: 'Luminous highlight diffusion', accentHex: '#f59e0b' },
  { id: 'sepia_gum', name: 'Gum Print', category: 'Pictorial', tagline: 'Warm bichromate pigment', accentHex: '#b45309' },
  { id: 'cyanotype', name: 'Cyanotype', category: 'Pictorial', tagline: 'Prussian blue iron print', accentHex: '#0284c7' },
  { id: 'portra', name: 'Portra 400', category: 'Film', tagline: 'Warm skin & lifted shadows', accentHex: '#ea580c' },
  { id: 'kodachrome', name: 'Kodachrome 64', category: 'Film', tagline: 'Archival reds & deep contrast', accentHex: '#dc2626' },
  { id: 'velvia', name: 'Velvia 50', category: 'Film', tagline: 'Rich landscape chroma', accentHex: '#16a34a' },
  { id: 'golden_dusk', name: 'Golden Hour', category: 'Film', tagline: 'Sunlit amber & rose gold', accentHex: '#f97316' },
  { id: 'cine_teal', name: 'Cinestill 800T', category: 'Cinema', tagline: 'Tungsten teal/amber split', accentHex: '#0d9488' },
  { id: 'tokyo_neon', name: 'Tokyo Neon', category: 'Cinema', tagline: 'Cyberpunk magenta & cyan', accentHex: '#db2777' },
  { id: 'nordic', name: 'Nordic Mist', category: 'Cinema', tagline: 'Atmospheric slate & fade', accentHex: '#38bdf8' },
  { id: 'matte_editorial', name: 'Editorial Matte', category: 'Cinema', tagline: 'Velvet black point curve', accentHex: '#a8a29e' },
  { id: 'silver_bw', name: 'Ilford HP5', category: 'B&W', tagline: 'Panchromatic silver B&W', accentHex: '#52525b' },
  { id: 'platinum_bw', name: 'Platinum B&W', category: 'B&W', tagline: 'Warm museum palladium print', accentHex: '#78716c' },
];

export const BUILT_IN_LOOK_RECIPES: LookRecipe[] = [
  {
    id: 'recipe_pictorial_salon',
    name: 'Pictorialist Salon',
    category: 'Pictorial',
    description: 'Luminous Orton highlight bloom (+48), soft clarity (-18), matte fade (+22), and fine 35mm grain (+24).',
    isBuiltIn: true,
    overrides: {
      exposure: 6,
      contrast: -10,
      highlights: 14,
      shadows: 24,
      fade: 22,
      warmth: 20,
      saturation: -16,
      clarity: -18,
      pictorialGlow: 48,
      grain: 24,
      vignette: 28,
      filterId: 'pictorialist',
      filterIntensity: 85,
      borderStyle: 'warm_linen',
      borderWidth: 24,
    },
  },
  {
    id: 'recipe_analogue_warmth',
    name: 'Portra Golden Roll',
    category: 'Film Stock',
    description: 'Warm Portra color matrix (80%), creamy highlights (-16), lifted shadows (+24), and organic film grain (+18).',
    isBuiltIn: true,
    overrides: {
      exposure: 6,
      contrast: -4,
      saturation: 10,
      vibrance: 18,
      warmth: 24,
      tint: 4,
      highlights: -16,
      shadows: 24,
      fade: 12,
      grain: 18,
      sharpness: 12,
      vignette: 16,
      filterId: 'portra',
      filterIntensity: 80,
    },
  },
  {
    id: 'recipe_street_mono',
    name: 'Leica Monochrom',
    category: 'Monochrome',
    description: 'High-silver Ilford panchromatic contrast (+34), midtone clarity (+26), silver grain (+28), and optical vignette.',
    isBuiltIn: true,
    overrides: {
      brightness: -4,
      exposure: 4,
      contrast: 34,
      saturation: -100,
      highlights: 12,
      shadows: -14,
      clarity: 26,
      grain: 28,
      sharpness: 34,
      vignette: 26,
      filterId: 'silver_bw',
      filterIntensity: 100,
    },
  },
  {
    id: 'recipe_orton_dreamscape',
    name: 'Ethereal Orton Glow',
    category: 'Pictorial',
    description: 'Dreamy highlight halation (+62), warm split-tone (+32), lush vibrance (+22), and golden sun leak.',
    isBuiltIn: true,
    overrides: {
      exposure: 8,
      contrast: -8,
      warmth: 18,
      vibrance: 22,
      shadows: 20,
      pictorialGlow: 62,
      splitTone: 32,
      filterId: 'orton_dream',
      filterIntensity: 85,
      lightLeakId: 'golden_flare',
      lightLeakIntensity: 45,
    },
  },
  {
    id: 'recipe_cine_night',
    name: 'Cinestill 800T Night',
    category: 'Cinematic',
    description: 'Tungsten teal/amber split tone (+40), highlight glow (+30), deep contrast (+20), and anamorphic streak.',
    isBuiltIn: true,
    overrides: {
      brightness: -4,
      exposure: 4,
      contrast: 20,
      saturation: 8,
      warmth: -10,
      highlights: 14,
      shadows: 16,
      pictorialGlow: 30,
      splitTone: 40,
      vignette: 24,
      filterId: 'cine_teal',
      filterIntensity: 88,
    },
  },
];

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function hasUnsavedEdits(
  state: PhotoEditState,
  baseline: PhotoEditState = DEFAULT_EDIT_STATE
): boolean {
  return (
    state.aspectRatio !== baseline.aspectRatio ||
    state.straighten !== baseline.straighten ||
    state.rotation !== baseline.rotation ||
    state.flipH !== baseline.flipH ||
    state.flipV !== baseline.flipV ||
    Math.abs(state.crop.x - baseline.crop.x) > 0.001 ||
    Math.abs(state.crop.y - baseline.crop.y) > 0.001 ||
    Math.abs(state.crop.width - baseline.crop.width) > 0.001 ||
    Math.abs(state.crop.height - baseline.crop.height) > 0.001 ||
    state.brightness !== baseline.brightness ||
    state.exposure !== baseline.exposure ||
    state.contrast !== baseline.contrast ||
    state.highlights !== baseline.highlights ||
    state.shadows !== baseline.shadows ||
    state.fade !== baseline.fade ||
    state.saturation !== baseline.saturation ||
    state.vibrance !== baseline.vibrance ||
    state.warmth !== baseline.warmth ||
    state.tint !== baseline.tint ||
    state.clarity !== baseline.clarity ||
    state.pictorialGlow !== baseline.pictorialGlow ||
    state.grain !== baseline.grain ||
    state.splitTone !== baseline.splitTone ||
    state.sharpness !== baseline.sharpness ||
    state.vignette !== baseline.vignette ||
    state.filterId !== baseline.filterId ||
    (state.filterId !== 'none' && state.filterIntensity !== baseline.filterIntensity) ||
    state.lightLeakId !== baseline.lightLeakId ||
    (state.lightLeakId !== 'none' && state.lightLeakIntensity !== baseline.lightLeakIntensity) ||
    state.borderStyle !== baseline.borderStyle ||
    (state.borderStyle !== 'none' && state.borderWidth !== baseline.borderWidth) ||
    state.textOverlays.length !== baseline.textOverlays.length ||
    state.drawStrokes.length !== baseline.drawStrokes.length
  );
}

export function computeAspectCropBox(
  aspectRatio: AspectRatioOption,
  sourceWidth: number,
  sourceHeight: number
): CropBox {
  if (aspectRatio === 'Free' || sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const ratioMap: Record<Exclude<AspectRatioOption, 'Free'>, number> = {
    '1:1': 1,
    '4:5': 4 / 5,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '3:2': 3 / 2,
    '4:3': 4 / 3,
  };

  const targetAspect = ratioMap[aspectRatio];
  const currentAspect = sourceWidth / sourceHeight;

  if (currentAspect > targetAspect) {
    const normWidth = clamp(targetAspect / currentAspect, 0.1, 1);
    return {
      x: (1 - normWidth) / 2,
      y: 0,
      width: normWidth,
      height: 1,
    };
  } else {
    const normHeight = clamp(currentAspect / targetAspect, 0.1, 1);
    return {
      x: 0,
      y: (1 - normHeight) / 2,
      width: 1,
      height: normHeight,
    };
  }
}

export interface HistoryStack<T> {
  entries: T[];
  index: number;
}

export function createHistory<T>(initial: T): HistoryStack<T> {
  return { entries: [structuredClone(initial)], index: 0 };
}

export function pushHistoryState<T>(stack: HistoryStack<T>, next: T): HistoryStack<T> {
  const sliced = stack.entries.slice(0, stack.index + 1);
  sliced.push(structuredClone(next));
  return {
    entries: sliced,
    index: sliced.length - 1,
  };
}

export function undoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.index <= 0) return stack;
  return { ...stack, index: stack.index - 1 };
}

export function redoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.index >= stack.entries.length - 1) return stack;
  return { ...stack, index: stack.index + 1 };
}

export interface RgbaHistogram {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
}

/**
 * Computes a 48-bin normalized RGB & Luminance histogram from an RGBA pixel buffer.
 */
export function computeHistogram(data: Uint8ClampedArray, bins = 48): RgbaHistogram {
  const r = new Array<number>(bins).fill(0);
  const g = new Array<number>(bins).fill(0);
  const b = new Array<number>(bins).fill(0);
  const luma = new Array<number>(bins).fill(0);

  const step = Math.max(4, Math.floor(data.length / 4 / 8000) * 4);
  const scale = (bins - 1) / 255;

  for (let i = 0; i < data.length; i += step) {
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    const lv = Math.round(0.299 * rv + 0.587 * gv + 0.114 * bv);

    r[Math.round(rv * scale)]++;
    g[Math.round(gv * scale)]++;
    b[Math.round(bv * scale)]++;
    luma[Math.round(lv * scale)]++;
  }

  const maxVal = Math.max(1, ...r, ...g, ...b, ...luma);
  return {
    r: r.map((v) => v / maxVal),
    g: g.map((v) => v / maxVal),
    b: b.map((v) => v / maxVal),
    luma: luma.map((v) => v / maxVal),
  };
}

/**
 * Pure non-destructive pixel pipeline that transforms RGBA pixel buffers according to PhotoEditState.
 * Includes Light, Color, Pictorial Glow (Orton diffusion), Clarity, Vibrance, Split-Toning, Film Grain,
 * 14 Analog/Pictorial Filter Profiles, Vignette, and Unsharp Mask.
 */
export function applyPixelAdjustments(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  state: PhotoEditState
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sourceData.length);

  const expFactor = Math.pow(2, (state.exposure ?? 0) / 50);
  const brightOffset = (state.brightness ?? 0) * 1.8;
  const contrastClamped = clamp(state.contrast ?? 0, -100, 100);
  const contrastFactor = (259 * (contrastClamped + 255)) / (255 * (259 - contrastClamped));
  const satFactor = 1 + (state.saturation ?? 0) / 100;
  const vibranceStrength = (state.vibrance ?? 0) / 100;
  const warmthShift = (state.warmth ?? 0) * 0.85;
  const tintShift = (state.tint ?? 0) * 0.75;
  const highlightGain = (state.highlights ?? 0) / 100;
  const shadowGain = (state.shadows ?? 0) / 100;
  const fadeAmount = clamp((state.fade ?? 0) / 100, 0, 1);
  const clarityAmount = (state.clarity ?? 0) / 100;
  const glowAmount = clamp((state.pictorialGlow ?? 0) / 100, 0, 1);
  const grainAmount = clamp((state.grain ?? 0) / 100, 0, 1);
  const splitToneAmount = (state.splitTone ?? 0) / 100;
  const vigStrength = clamp((state.vignette ?? 0) / 100, 0, 1);
  const filterStrength = clamp((state.filterIntensity ?? 100) / 100, 0, 1);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.max(1, Math.hypot(cx, cy));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = sourceData[i];
      let g = sourceData[i + 1];
      let b = sourceData[i + 2];
      const a = sourceData[i + 3];

      // 1. Exposure & Brightness
      r = r * expFactor + brightOffset;
      g = g * expFactor + brightOffset;
      b = b * expFactor + brightOffset;

      // 2. Highlights & Shadows tonal curve
      if (shadowGain !== 0 || highlightGain !== 0) {
        const lum = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
        const shadowWeight = Math.pow(1 - lum, 1.6);
        const highlightWeight = Math.pow(lum, 1.6);
        const delta = shadowGain * shadowWeight * 68 + highlightGain * highlightWeight * 68;
        r += delta;
        g += delta;
        b += delta;
      }

      // 3. Contrast & Midtone Clarity
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      if (clarityAmount !== 0) {
        const lum = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
        // Bell curve peaking at midtones (0.5)
        const midMask = 4 * lum * (1 - lum);
        const cBoost = 1 + clarityAmount * midMask * 0.45;
        r = (r - 128) * cBoost + 128;
        g = (g - 128) * cBoost + 128;
        b = (b - 128) * cBoost + 128;
      }

      // 4. Matte Fade (Lifted Black Point)
      if (fadeAmount > 0) {
        const lift = fadeAmount * 38;
        const scale = 1 - fadeAmount * 0.14;
        r = r * scale + lift;
        g = g * scale + lift;
        b = b * scale + lift;
      }

      // 5. Warmth (Amber/Blue) & Tint (Magenta/Green)
      r += warmthShift + tintShift * 0.35;
      g -= tintShift * 0.7;
      b -= warmthShift - tintShift * 0.35;

      // 6. Saturation & Skin-Safe Vibrance
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      let effectiveSat = satFactor;
      if (vibranceStrength !== 0) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const currentSat = clamp((maxC - minC) / 255, 0, 1);
        // Boost less-saturated pixels more than already-saturated pixels
        effectiveSat += vibranceStrength * (1 - currentSat * 0.75);
      }
      r = luma + (r - luma) * effectiveSat;
      g = luma + (g - luma) * effectiveSat;
      b = luma + (b - luma) * effectiveSat;

      // 7. Split Toning (Golden Highlights / Cool Indigo Shadows)
      if (splitToneAmount !== 0) {
        const normL = clamp(luma / 255, 0, 1);
        const hi = Math.pow(normL, 1.4) * splitToneAmount * 26;
        const sh = Math.pow(1 - normL, 1.4) * splitToneAmount * 26;
        r += hi - sh * 0.65;
        g += hi * 0.35 - sh * 0.15;
        b -= hi * 0.7 - sh;
      }

      // 8. Adjustable Pictorial / Film / Cinema Filter Profile
      if (state.filterId !== 'none' && filterStrength > 0) {
        let fr = r;
        let fg = g;
        let fb = b;
        const normL = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);

        switch (state.filterId) {
          case 'pictorialist': {
            // Classic 1904 Pictorialist warm platinum-sepia with soft matte blacks & glowing highlights
            const mono = 0.32 * r + 0.56 * g + 0.12 * b;
            const soft = 0.84 * mono + 24 + Math.pow(normL, 2.2) * 28;
            fr = soft * 1.07 + 10;
            fg = soft * 0.99 + 4;
            fb = soft * 0.87 - 4;
            break;
          }
          case 'orton_dream': {
            // Ethereal highlight bloom + warm pastel contrast
            const bloom = Math.pow(normL, 1.8) * 34;
            fr = r * 1.05 + bloom + 8;
            fg = g * 1.01 + bloom * 0.85 + 3;
            fb = b * 0.94 + bloom * 0.65;
            break;
          }
          case 'sepia_gum': {
            const mono = 0.3 * r + 0.58 * g + 0.12 * b;
            fr = mono * 1.12 + 18;
            fg = mono * 0.96 + 6;
            fb = mono * 0.76 - 8;
            break;
          }
          case 'cyanotype': {
            const mono = 0.299 * r + 0.587 * g + 0.114 * b;
            fr = mono * 0.48 + 8;
            fg = mono * 0.82 + 16;
            fb = mono * 1.18 + 32;
            break;
          }
          case 'portra':
            fr = r * 1.07 + 10;
            fg = g * 1.02 + 4;
            fb = b * 0.91;
            break;
          case 'kodachrome':
            fr = 1.15 * (r - 118) + 128;
            fg = 1.04 * (g - 124) + 124;
            fb = 0.88 * b;
            break;
          case 'velvia': {
            const boostSat = 1.32;
            fr = 1.12 * (luma + (r - luma) * boostSat - 124) + 124;
            fg = 1.1 * (luma + (g - luma) * boostSat - 124) + 124;
            fb = 1.14 * (luma + (b - luma) * boostSat - 124) + 124;
            break;
          }
          case 'silver_bw': {
            const bw = 0.31 * r + 0.57 * g + 0.12 * b;
            const curved = 1.16 * (bw - 124) + 124;
            fr = curved;
            fg = curved;
            fb = curved;
            break;
          }
          case 'platinum_bw': {
            const bw = 0.32 * r + 0.56 * g + 0.12 * b;
            const curved = 1.08 * (bw - 122) + 124;
            fr = curved + 7;
            fg = curved + 3;
            fb = curved - 4;
            break;
          }
          case 'cine_teal': {
            fr = r + normL * 20 - (1 - normL) * 14;
            fg = g + (1 - normL) * 7;
            fb = b + (1 - normL) * 24 - normL * 10;
            break;
          }
          case 'tokyo_neon': {
            fr = r + normL * 26 - (1 - normL) * 8;
            fg = g * 0.94 + (1 - normL) * 10;
            fb = b + normL * 16 + (1 - normL) * 28;
            break;
          }
          case 'nordic':
            fr = luma + (r - luma) * 0.76 - 4;
            fg = luma + (g - luma) * 0.82 + 2;
            fb = luma + (b - luma) * 0.9 + 12;
            break;
          case 'golden_dusk':
            fr = r * 1.13 + 15;
            fg = g * 1.02 + 3;
            fb = b * 0.85 + 6;
            break;
          case 'matte_editorial':
            fr = 0.85 * r + 26;
            fg = 0.85 * g + 24;
            fb = 0.87 * b + 22;
            break;
        }

        r = r + (fr - r) * filterStrength;
        g = g + (fg - g) * filterStrength;
        b = b + (fb - b) * filterStrength;
      }

      // 9. Pictorial Glow (Orton Soft Highlight Halation)
      if (glowAmount > 0) {
        const curL = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
        const halo = Math.pow(curL, 2.0) * glowAmount * 42;
        r += halo * 1.08;
        g += halo * 0.98;
        b += halo * 0.86;
      }

      // 10. 35mm Silver-Halide Film Grain (deterministic spatial hash so it doesn't flicker)
      if (grainAmount > 0) {
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise = (hash - Math.floor(hash) - 0.5) * grainAmount * 46;
        r += noise;
        g += noise;
        b += noise;
      }

      // 11. Vignette radial luminance falloff
      if (vigStrength > 0) {
        const dist = Math.hypot(x - cx, y - cy) / maxDist;
        const factor = clamp(1 - vigStrength * dist * dist * 1.15, 0.12, 1);
        r *= factor;
        g *= factor;
        b *= factor;
      }

      out[i] = clamp(Math.round(r), 0, 255);
      out[i + 1] = clamp(Math.round(g), 0, 255);
      out[i + 2] = clamp(Math.round(b), 0, 255);
      out[i + 3] = a;
    }
  }

  // 12. Unsharp Mask / 3x3 Convolution Sharpness when sharpness > 0
  const sharpAmount = clamp((state.sharpness ?? 0) / 100, 0, 1) * 1.25;
  if (sharpAmount > 0.01 && width >= 3 && height >= 3) {
    const sharpened = new Uint8ClampedArray(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const up = ((y - 1) * width + x) * 4;
        const down = ((y + 1) * width + x) * 4;
        const left = (y * width + (x - 1)) * 4;
        const right = (y * width + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const center = out[idx + c];
          const neighbors = (out[up + c] + out[down + c] + out[left + c] + out[right + c]) * 0.25;
          const detail = center - neighbors;
          sharpened[idx + c] = clamp(Math.round(center + detail * sharpAmount * 2.2), 0, 255);
        }
      }
    }
    return sharpened;
  }

  return out;
}
