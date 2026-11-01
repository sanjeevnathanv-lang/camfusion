import {
  AspectRatioOption,
  FilterId,
  PhotoEditState,
  computeAspectCropBox,
} from './editorEngine';

export interface ValidatedAiEditProposal {
  valid: true;
  summary: string;
  proposedState: PhotoEditState;
  changedKeys: string[];
}

export interface InvalidAiEditProposal {
  valid: false;
  error: string;
}

export type AiValidationOutcome = ValidatedAiEditProposal | InvalidAiEditProposal;

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'summary',
  'brightness',
  'exposure',
  'contrast',
  'saturation',
  'vibrance',
  'warmth',
  'tint',
  'highlights',
  'shadows',
  'fade',
  'clarity',
  'pictorialGlow',
  'grain',
  'splitTone',
  'sharpness',
  'vignette',
  'straighten',
  'aspectRatio',
  'filterId',
  'filterIntensity',
  'crop',
]);

const SYMMETRIC_KEYS = [
  'brightness',
  'exposure',
  'contrast',
  'saturation',
  'vibrance',
  'warmth',
  'tint',
  'highlights',
  'shadows',
  'clarity',
  'splitTone',
] as const;

const POSITIVE_KEYS = [
  'fade',
  'pictorialGlow',
  'grain',
  'sharpness',
  'vignette',
  'filterIntensity',
] as const;

const ALLOWED_ASPECT_RATIOS = new Set<AspectRatioOption>([
  'Free',
  '1:1',
  '4:5',
  '16:9',
  '9:16',
  '3:2',
  '4:3',
]);

const ALLOWED_FILTER_IDS = new Set<FilterId>([
  'none',
  'pictorialist',
  'orton_dream',
  'cyanotype',
  'sepia_gum',
  'portra',
  'kodachrome',
  'velvia',
  'golden_dusk',
  'cine_teal',
  'tokyo_neon',
  'nordic',
  'matte_editorial',
  'silver_bw',
  'platinum_bw',
]);

/**
 * Strictly validates structured JSON output from Gemini 4 Argon (`gemini-4-argon`).
 * Rejects unknown keys, out-of-range numeric adjustments, invalid enums, or malformed objects safely.
 */
export function validateAndMergeAiResponse(
  currentState: PhotoEditState,
  rawPayload: unknown,
  imageWidth = 1200,
  imageHeight = 900
): AiValidationOutcome {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return {
      valid: false,
      error: 'AI response must be a structured JSON object.',
    };
  }

  const record = rawPayload as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return {
        valid: false,
        error: `Rejected unknown adjustment field "${key}" in AI response.`,
      };
    }
  }

  if (typeof record.summary !== 'string' || record.summary.trim().length === 0) {
    return {
      valid: false,
      error: 'AI response is missing a valid "summary" explanation string.',
    };
  }

  const nextState: PhotoEditState = structuredClone(currentState);
  const changedKeys: string[] = [];

  for (const key of SYMMETRIC_KEYS) {
    const val = record[key];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < -100 || val > 100) {
        return {
          valid: false,
          error: `Adjustment "${key}" has invalid value (${String(val)}). Expected number in [-100, 100].`,
        };
      }
      const rounded = Math.round(val);
      if (nextState[key] !== rounded) {
        nextState[key] = rounded;
        changedKeys.push(key);
      }
    }
  }

  for (const key of POSITIVE_KEYS) {
    const val = record[key];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 100) {
        return {
          valid: false,
          error: `Adjustment "${key}" has invalid value (${String(val)}). Expected number in [0, 100].`,
        };
      }
      const rounded = Math.round(val);
      if (nextState[key] !== rounded) {
        nextState[key] = rounded;
        changedKeys.push(key);
      }
    }
  }

  if (record.straighten !== undefined && record.straighten !== null) {
    const st = record.straighten;
    if (typeof st !== 'number' || !Number.isFinite(st) || st < -45 || st > 45) {
      return {
        valid: false,
        error: `Adjustment "straighten" has invalid value (${String(st)}). Expected number in [-45, 45].`,
      };
    }
    const rounded = Math.round(st * 10) / 10;
    if (nextState.straighten !== rounded) {
      nextState.straighten = rounded;
      changedKeys.push('straighten');
    }
  }

  if (record.aspectRatio !== undefined && record.aspectRatio !== null) {
    if (
      typeof record.aspectRatio !== 'string' ||
      !ALLOWED_ASPECT_RATIOS.has(record.aspectRatio as AspectRatioOption)
    ) {
      return {
        valid: false,
        error: `Invalid aspectRatio "${String(record.aspectRatio)}".`,
      };
    }
    const ratio = record.aspectRatio as AspectRatioOption;
    if (nextState.aspectRatio !== ratio) {
      nextState.aspectRatio = ratio;
      nextState.crop = computeAspectCropBox(ratio, imageWidth, imageHeight);
      changedKeys.push('aspectRatio');
    }
  }

  if (record.filterId !== undefined && record.filterId !== null) {
    if (
      typeof record.filterId !== 'string' ||
      !ALLOWED_FILTER_IDS.has(record.filterId as FilterId)
    ) {
      return {
        valid: false,
        error: `Invalid filterId "${String(record.filterId)}".`,
      };
    }
    const fid = record.filterId as FilterId;
    if (nextState.filterId !== fid) {
      nextState.filterId = fid;
      changedKeys.push('filterId');
    }
  }

  if (record.crop !== undefined && record.crop !== null) {
    if (typeof record.crop !== 'object' || Array.isArray(record.crop)) {
      return {
        valid: false,
        error: 'Field "crop" must be an object with normalized x, y, width, height.',
      };
    }
    const c = record.crop as Record<string, unknown>;
    const x = c.x;
    const y = c.y;
    const width = c.width;
    const height = c.height;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      x < 0 ||
      y < 0 ||
      width < 0.1 ||
      height < 0.1 ||
      x + width > 1.001 ||
      y + height > 1.001
    ) {
      return {
        valid: false,
        error: 'Crop coordinates must be normalized within [0, 1] with width/height >= 0.1.',
      };
    }
    nextState.crop = {
      x: Math.max(0, Math.min(0.9, x)),
      y: Math.max(0, Math.min(0.9, y)),
      width: Math.min(1 - Math.max(0, x), width),
      height: Math.min(1 - Math.max(0, y), height),
    };
    changedKeys.push('crop');
  }

  return {
    valid: true,
    summary: record.summary.trim(),
    proposedState: nextState,
    changedKeys,
  };
}
