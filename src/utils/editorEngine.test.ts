import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDIT_STATE,
  applyPixelAdjustments,
  computeAspectCropBox,
  createHistory,
  hasUnsavedEdits,
  pushHistoryState,
  redoHistory,
  undoHistory,
} from './editorEngine';
import { validateAndMergeAiResponse } from './aiSchemaValidator';

test('applyPixelAdjustments increases pixel luminance when brightness and exposure increase', () => {
  const src = new Uint8ClampedArray([100, 100, 100, 255]);
  const brighter = applyPixelAdjustments(src, 1, 1, {
    ...DEFAULT_EDIT_STATE,
    brightness: 25,
    exposure: 20,
  });
  assert.equal(brighter[0] > 100, true);
  assert.equal(brighter[1] > 100, true);
  assert.equal(brighter[2] > 100, true);
  assert.equal(brighter[3], 255);
});

test('applyPixelAdjustments desaturates to monochrome when saturation is -100', () => {
  const src = new Uint8ClampedArray([220, 80, 40, 255]);
  const mono = applyPixelAdjustments(src, 1, 1, {
    ...DEFAULT_EDIT_STATE,
    saturation: -100,
  });
  assert.equal(mono[0], mono[1]);
  assert.equal(mono[1], mono[2]);
});

test('applyPixelAdjustments blends filter preset non-destructively with filterIntensity', () => {
  const src = new Uint8ClampedArray([180, 120, 90, 255]);
  const fullBw = applyPixelAdjustments(src, 1, 1, {
    ...DEFAULT_EDIT_STATE,
    filterId: 'silver_bw',
    filterIntensity: 100,
  });
  const halfBw = applyPixelAdjustments(src, 1, 1, {
    ...DEFAULT_EDIT_STATE,
    filterId: 'silver_bw',
    filterIntensity: 50,
  });
  assert.equal(fullBw[0], fullBw[1]);
  assert.equal(halfBw[0] > fullBw[0], true);
});

test('undo, redo, and unsaved edit detection work accurately', () => {
  let stack = createHistory(DEFAULT_EDIT_STATE);
  assert.equal(hasUnsavedEdits(stack.entries[stack.index]), false);

  const edited = { ...DEFAULT_EDIT_STATE, warmth: 30, contrast: 15 };
  stack = pushHistoryState(stack, edited);
  assert.equal(stack.index, 1);
  assert.equal(hasUnsavedEdits(stack.entries[stack.index]), true);

  stack = undoHistory(stack);
  assert.equal(stack.index, 0);
  assert.equal(hasUnsavedEdits(stack.entries[stack.index]), false);

  stack = redoHistory(stack);
  assert.equal(stack.index, 1);
  assert.equal(stack.entries[stack.index].warmth, 30);
});

test('computeAspectCropBox calculates centered normalized crop rectangle', () => {
  const crop = computeAspectCropBox('1:1', 1600, 1200);
  assert.equal(crop.height, 1);
  assert.equal(Math.abs(crop.width - 0.75) < 0.001, true);
  assert.equal(Math.abs(crop.x - 0.125) < 0.001, true);
});

test('validateAndMergeAiResponse accepts valid Gemini 4 Argon structured payload and rejects out-of-range or unknown fields', () => {
  const validResult = validateAndMergeAiResponse(DEFAULT_EDIT_STATE, {
    summary: 'Warmed golden tones and lifted shadows for balanced portrait exposure.',
    exposure: 12,
    warmth: 24,
    shadows: 18,
    highlights: -10,
    filterId: 'portra',
    filterIntensity: 70,
  });
  assert.equal(validResult.valid, true);
  if (validResult.valid) {
    assert.equal(validResult.proposedState.warmth, 24);
    assert.equal(validResult.proposedState.filterId, 'portra');
    assert.equal(validResult.changedKeys.includes('warmth'), true);
  }

  const outOfRange = validateAndMergeAiResponse(DEFAULT_EDIT_STATE, {
    summary: 'Invalid brightness',
    brightness: 240,
  });
  assert.equal(outOfRange.valid, false);

  const unknownField = validateAndMergeAiResponse(DEFAULT_EDIT_STATE, {
    summary: 'Hallucinated property',
    magicPixelGenerator: true,
  });
  assert.equal(unknownField.valid, false);
});

test('applyPixelAdjustments applies pictorialGlow, fade, and pictorialist filter accurately', () => {
  const src = new Uint8ClampedArray([10, 10, 10, 255, 220, 200, 180, 255]);
  const pictorial = applyPixelAdjustments(src, 2, 1, {
    ...DEFAULT_EDIT_STATE,
    fade: 40,
    pictorialGlow: 60,
    filterId: 'pictorialist',
    filterIntensity: 100,
  });
  // Fade lifts deep blacks above 10
  assert.equal(pictorial[0] > 20, true);
  // Pictorial glow boosts highlight warmth
  assert.equal(pictorial[4] > 220, true);
});

