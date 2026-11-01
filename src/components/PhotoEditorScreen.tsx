import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Crop,
  Sliders,
  Sparkles,
  Type as TypeIcon,
  Undo2,
  Redo2,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Eye,
  Download,
  Camera,
  Upload,
  Check,
  X,
  Plus,
  Trash2,
  BookmarkPlus,
  AlertCircle,
  Palette,
  Frame,
  PenTool,
  Sun,
  Columns2,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  AspectRatioOption,
  BorderStyleId,
  BUILT_IN_LOOK_RECIPES,
  computeAspectCropBox,
  computeHistogram,
  createHistory,
  DEFAULT_EDIT_STATE,
  DrawStroke,
  FILTER_CATALOG,
  FilterCategory,
  FilterId,
  hasUnsavedEdits,
  HistoryStack,
  LightLeakId,
  LookRecipe,
  PhotoEditState,
  pushHistoryState,
  redoHistory,
  RgbaHistogram,
  undoHistory,
  applyPixelAdjustments,
} from '../utils/editorEngine';
import { validateAndMergeAiResponse } from '../utils/aiSchemaValidator';
import { PhotoAsset, loadFileWithExifNormalized } from '../utils/samplePhotos';
import { getApiUrl, savePhotoNativeOrWeb } from '../utils/nativeBridge';

export interface SavedFrameFlowPhoto {
  id: string;
  filename: string;
  folderPath: 'Pictures/FrameFlow';
  dataUrl: string;
  width: number;
  height: number;
  savedAt: string;
  summary: string;
}

interface PhotoEditorScreenProps {
  photo: PhotoAsset;
  customRecipes: LookRecipe[];
  onSaveCustomRecipe: (recipe: LookRecipe) => void;
  onDeleteCustomRecipe: (id: string) => void;
  onSaveFinishedPhoto: (saved: SavedFrameFlowPhoto) => void;
  onBackToCamera: () => void;
  onReplacePhoto: (photo: PhotoAsset) => void;
  onOpenAiStudio?: () => void;
}

type EditorTab = 'crop' | 'adjust' | 'filters' | 'annotate' | 'ai';
type AdjustGroup = 'all' | 'light' | 'color' | 'pictorial';

interface PendingProposal {
  sourceTitle: string;
  summary: string;
  proposedState: PhotoEditState;
  changedKeys: string[];
}

type NumericAdjustmentKey =
  | 'exposure'
  | 'brightness'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'fade'
  | 'warmth'
  | 'tint'
  | 'saturation'
  | 'vibrance'
  | 'splitTone'
  | 'pictorialGlow'
  | 'clarity'
  | 'grain'
  | 'sharpness'
  | 'vignette';

const ADJUSTMENT_CONTROLS: Array<{
  key: NumericAdjustmentKey;
  label: string;
  group: Exclude<AdjustGroup, 'all'>;
  min: number;
  max: number;
}> = [
  // Light
  { key: 'exposure', label: 'Exposure', group: 'light', min: -100, max: 100 },
  { key: 'brightness', label: 'Brightness', group: 'light', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', group: 'light', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', group: 'light', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', group: 'light', min: -100, max: 100 },
  { key: 'fade', label: 'Matte Fade', group: 'light', min: 0, max: 100 },
  // Color
  { key: 'warmth', label: 'Warmth', group: 'color', min: -100, max: 100 },
  { key: 'tint', label: 'Tint', group: 'color', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', group: 'color', min: -100, max: 100 },
  { key: 'vibrance', label: 'Vibrance', group: 'color', min: -100, max: 100 },
  { key: 'splitTone', label: 'Split Tone', group: 'color', min: -100, max: 100 },
  // Pictorial & Optical Detail
  { key: 'pictorialGlow', label: 'Pictorial Glow', group: 'pictorial', min: 0, max: 100 },
  { key: 'clarity', label: 'Clarity', group: 'pictorial', min: -100, max: 100 },
  { key: 'grain', label: '35mm Grain', group: 'pictorial', min: 0, max: 100 },
  { key: 'sharpness', label: 'Sharpness', group: 'pictorial', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', group: 'pictorial', min: 0, max: 100 },
];

const FILTER_CSS_PREVIEW: Record<FilterId, string> = {
  none: 'none',
  pictorialist: 'sepia(36%) contrast(92%) brightness(106%) saturate(85%)',
  orton_dream: 'brightness(108%) contrast(95%) saturate(112%) sepia(14%)',
  sepia_gum: 'sepia(65%) contrast(106%) brightness(98%)',
  cyanotype: 'grayscale(100%) sepia(80%) hue-rotate(175deg) saturate(160%)',
  portra: 'contrast(104%) saturate(116%) sepia(12%) brightness(103%)',
  kodachrome: 'contrast(118%) saturate(122%) sepia(15%)',
  velvia: 'contrast(116%) saturate(142%)',
  golden_dusk: 'sepia(28%) saturate(128%) brightness(104%)',
  cine_teal: 'contrast(112%) hue-rotate(-8deg) saturate(110%)',
  tokyo_neon: 'contrast(118%) hue-rotate(18deg) saturate(135%)',
  nordic: 'saturate(72%) contrast(104%) brightness(102%)',
  matte_editorial: 'contrast(86%) brightness(106%) saturate(90%)',
  silver_bw: 'grayscale(100%) contrast(120%)',
  platinum_bw: 'grayscale(100%) sepia(18%) contrast(108%)',
};

export const PhotoEditorScreen: React.FC<PhotoEditorScreenProps> = ({
  photo,
  customRecipes,
  onSaveCustomRecipe,
  onDeleteCustomRecipe,
  onSaveFinishedPhoto,
  onBackToCamera,
  onReplacePhoto,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryStack<PhotoEditState>>(() =>
    createHistory(DEFAULT_EDIT_STATE)
  );
  const [lastSavedState, setLastSavedState] = useState<PhotoEditState>(DEFAULT_EDIT_STATE);
  const [activeTab, setActiveTab] = useState<EditorTab>('adjust');
  const [adjustGroup, setAdjustGroup] = useState<AdjustGroup>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('All');

  // Interactive Canvas Inspect: Hold Compare, Split-Screen Wipe, and Live RGB Histogram
  const [showOriginalCompare, setShowOriginalCompare] = useState<boolean>(false);
  const [splitWipeEnabled, setSplitWipeEnabled] = useState<boolean>(false);
  const [splitWipePos, setSplitWipePos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [showHistogram, setShowHistogram] = useState<boolean>(true);
  const [histogram, setHistogram] = useState<RgbaHistogram | null>(null);

  const [confirmExitOpen, setConfirmExitOpen] = useState<boolean>(false);
  const [saveBannerText, setSaveBannerText] = useState<string | null>(null);

  // Annotate & Creative Darkroom sub-mode (Light Leaks, Frames, Text/Stamps, Brush)
  const [annotateMode, setAnnotateMode] = useState<
    'leaks' | 'border' | 'text' | 'draw'
  >('leaks');
  const [textDraft, setTextDraft] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(32);

  const [brushEnabled, setBrushEnabled] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#f59e0b');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [activeStrokePoints, setActiveStrokePoints] = useState<
    Array<{ x: number; y: number }>
  >([]);

  // AI Edit & Look Recipes state
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoadingMode, setAiLoadingMode] = useState<string | null>(null);
  const [aiDiagnostic, setAiDiagnostic] = useState<{
    model: string;
    message: string;
    setupSteps: string[];
  } | null>(null);
  const [customRecipeName, setCustomRecipeName] = useState<string>('');

  const committedState = history.entries[history.index];
  const effectiveState = pendingProposal ? pendingProposal.proposedState : committedState;
  const isDirty = hasUnsavedEdits(committedState, lastSavedState);

  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => {
      sourceImageRef.current = img;
      setHistory(createHistory(DEFAULT_EDIT_STATE));
      setLastSavedState(DEFAULT_EDIT_STATE);
      setPendingProposal(null);
      setImageLoaded(true);
    };
    img.src = photo.dataUrl;
  }, [photo]);

  const commitNextState = useCallback((next: PhotoEditState) => {
    setPendingProposal(null);
    setHistory((prev) => pushHistoryState(prev, next));
  }, []);

  const updateCurrentField = <K extends keyof PhotoEditState>(
    key: K,
    value: PhotoEditState[K]
  ) => {
    const next: PhotoEditState = {
      ...committedState,
      [key]: value,
    };
    commitNextState(next);
  };

  // Render pipeline onto HTML5 Canvas
  const renderToCanvas = useCallback(
    (
      targetCanvas: HTMLCanvasElement,
      stateToRender: PhotoEditState,
      forExport = false
    ) => {
      const img = sourceImageRef.current;
      if (!img) return;

      // Step 1: Apply rotation, flip, straighten, and crop on an intermediate geometry canvas
      const quarterTurns = (((stateToRender.rotation / 90) % 4) + 4) % 4;
      const swapWH = quarterTurns % 2 === 1;
      const baseW = swapWH ? img.naturalHeight : img.naturalWidth;
      const baseH = swapWH ? img.naturalWidth : img.naturalHeight;

      const geomCanvas = document.createElement('canvas');
      geomCanvas.width = baseW;
      geomCanvas.height = baseH;
      const gCtx = geomCanvas.getContext('2d');
      if (!gCtx) return;

      gCtx.save();
      gCtx.translate(baseW / 2, baseH / 2);
      const totalRad =
        ((stateToRender.rotation + stateToRender.straighten) * Math.PI) / 180;
      gCtx.rotate(totalRad);
      const straightenRad = Math.abs((stateToRender.straighten * Math.PI) / 180);
      const autoScale =
        straightenRad > 0.001 ? 1 + Math.sin(straightenRad) * 0.65 : 1;
      gCtx.scale(
        (stateToRender.flipH ? -1 : 1) * autoScale,
        (stateToRender.flipV ? -1 : 1) * autoScale
      );
      gCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      gCtx.restore();

      // Crop rectangle extraction
      const cx = Math.round(stateToRender.crop.x * baseW);
      const cy = Math.round(stateToRender.crop.y * baseH);
      const cw = Math.max(48, Math.round(stateToRender.crop.width * baseW));
      const ch = Math.max(48, Math.round(stateToRender.crop.height * baseH));

      targetCanvas.width = cw;
      targetCanvas.height = ch;
      const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(geomCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

      // Step 2: Apply non-destructive pixel adjustments & filter profile
      const rawImgData = ctx.getImageData(0, 0, cw, ch);
      const processedPixels = applyPixelAdjustments(
        rawImgData.data,
        cw,
        ch,
        stateToRender
      );

      if (!forExport) {
        setHistogram(computeHistogram(processedPixels));
      }

      // If Split-Screen Wipe is active (and not exporting), blend Original on left and Edited on right
      if (!forExport && splitWipeEnabled && !showOriginalCompare) {
        const splitX = Math.round(splitWipePos * cw);
        const composite = new Uint8ClampedArray(processedPixels.length);
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const idx = (y * cw + x) * 4;
            const src = x < splitX ? rawImgData.data : processedPixels;
            composite[idx] = src[idx];
            composite[idx + 1] = src[idx + 1];
            composite[idx + 2] = src[idx + 2];
            composite[idx + 3] = src[idx + 3];
          }
        }
        rawImgData.data.set(composite);
      } else {
        rawImgData.data.set(processedPixels);
      }

      ctx.putImageData(rawImgData, 0, 0);

      // Step 3: Render Optical Light Leak Overlay
      if (
        stateToRender.lightLeakId !== 'none' &&
        stateToRender.lightLeakIntensity > 0
      ) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (stateToRender.lightLeakIntensity / 100) * 0.78;

        if (stateToRender.lightLeakId === 'golden_flare') {
          const grad = ctx.createRadialGradient(
            cw * 0.12,
            ch * 0.18,
            10,
            cw * 0.18,
            ch * 0.25,
            Math.max(cw, ch) * 0.7
          );
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
          grad.addColorStop(0.35, 'rgba(249, 115, 22, 0.65)');
          grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
        } else if (stateToRender.lightLeakId === 'prism_burn') {
          const grad = ctx.createLinearGradient(0, 0, cw, ch);
          grad.addColorStop(0, 'rgba(244, 63, 94, 0.75)');
          grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.45)');
          grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.4)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
        } else if (stateToRender.lightLeakId === 'amber_edge') {
          const grad = ctx.createLinearGradient(cw * 0.65, 0, cw, 0);
          grad.addColorStop(0, 'rgba(234, 88, 12, 0)');
          grad.addColorStop(0.6, 'rgba(249, 115, 22, 0.65)');
          grad.addColorStop(1, 'rgba(254, 215, 170, 0.95)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
        } else if (stateToRender.lightLeakId === 'cinema_streak') {
          const streak = ctx.createLinearGradient(0, ch * 0.42, 0, ch * 0.58);
          streak.addColorStop(0, 'rgba(56, 189, 248, 0)');
          streak.addColorStop(0.5, 'rgba(125, 211, 252, 0.85)');
          streak.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = streak;
          ctx.fillRect(0, ch * 0.38, cw, ch * 0.24);
        }
        ctx.restore();
      }

      // Step 4: Render Freehand Drawing Strokes
      const allStrokes: DrawStroke[] =
        activeStrokePoints.length > 1
          ? [
              ...stateToRender.drawStrokes,
              {
                id: 'live',
                points: activeStrokePoints,
                color: brushColor,
                size: brushSize,
              },
            ]
          : stateToRender.drawStrokes;

      for (const stroke of allStrokes) {
        if (stroke.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * (cw / 720);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * cw, stroke.points[0].y * ch);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * cw, stroke.points[i].y * ch);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Step 5: Render Text & Date Stamps
      for (const item of stateToRender.textOverlays) {
        ctx.save();
        const scaledFont = Math.round(item.fontSize * (cw / 720));
        const fontFamily =
          item.fontStyle === 'mono'
            ? '"JetBrains Mono", monospace'
            : item.fontStyle === 'serif'
              ? 'Georgia, serif'
              : '"Plus Jakarta Sans", sans-serif';
        ctx.font = `700 ${scaledFont}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x * cw, item.y * ch);
        ctx.restore();
      }

      // Step 6: Render Gallery & Darkroom Borders
      if (stateToRender.borderStyle !== 'none' && stateToRender.borderWidth > 0) {
        const minDim = Math.min(cw, ch);
        const thickness = Math.max(
          4,
          Math.round(minDim * (stateToRender.borderWidth / 100) * 0.1)
        );
        ctx.save();
        if (stateToRender.borderStyle === 'gallery_white') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = thickness * 2;
          ctx.strokeRect(0, 0, cw, ch);
        } else if (stateToRender.borderStyle === 'darkroom_black') {
          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = thickness * 2;
          ctx.strokeRect(0, 0, cw, ch);
        } else if (stateToRender.borderStyle === 'warm_linen') {
          ctx.strokeStyle = '#f5f0e6';
          ctx.lineWidth = thickness * 2.1;
          ctx.strokeRect(0, 0, cw, ch);
          ctx.strokeStyle = 'rgba(120, 113, 108, 0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            thickness,
            thickness,
            cw - thickness * 2,
            ch - thickness * 2
          );
        } else if (stateToRender.borderStyle === 'museum_gold') {
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = thickness * 1.8;
          ctx.strokeRect(0, 0, cw, ch);
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            thickness * 0.9,
            thickness * 0.9,
            cw - thickness * 1.8,
            ch - thickness * 1.8
          );
        } else if (stateToRender.borderStyle === 'film_frame') {
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = thickness * 2.2;
          ctx.strokeRect(0, 0, cw, ch);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            thickness,
            thickness,
            cw - thickness * 2,
            ch - thickness * 2
          );
        } else if (stateToRender.borderStyle === 'polaroid') {
          ctx.fillStyle = '#fafaf9';
          ctx.fillRect(0, 0, cw, thickness);
          ctx.fillRect(0, 0, thickness, ch);
          ctx.fillRect(cw - thickness, 0, thickness, ch);
          ctx.fillRect(0, ch - thickness * 2.6, cw, thickness * 2.6);
        }
        ctx.restore();
      }
    },
    [
      activeStrokePoints,
      brushColor,
      brushSize,
      splitWipeEnabled,
      splitWipePos,
      showOriginalCompare,
    ]
  );

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current) return;
    const stateForDisplay = showOriginalCompare ? DEFAULT_EDIT_STATE : effectiveState;
    renderToCanvas(canvasRef.current, stateForDisplay, false);
  }, [imageLoaded, effectiveState, showOriginalCompare, renderToCanvas]);

  const getNormalizedCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedCanvasPoint(e);
    if (splitWipeEnabled && !(activeTab === 'annotate' && annotateMode === 'draw' && brushEnabled)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingSplit(true);
      setSplitWipePos(pt.x);
      return;
    }
    if (activeTab !== 'annotate' || annotateMode !== 'draw' || !brushEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveStrokePoints([pt]);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedCanvasPoint(e);
    if (isDraggingSplit) {
      setSplitWipePos(pt.x);
      return;
    }
    if (activeStrokePoints.length === 0) return;
    setActiveStrokePoints((prev) => [...prev, pt]);
  };

  const handleCanvasPointerUp = () => {
    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      return;
    }
    if (activeStrokePoints.length < 2) {
      setActiveStrokePoints([]);
      return;
    }
    const newStroke: DrawStroke = {
      id: `stroke_${Date.now()}`,
      points: activeStrokePoints,
      color: brushColor,
      size: brushSize,
    };
    setActiveStrokePoints([]);
    updateCurrentField('drawStrokes', [...committedState.drawStrokes, newStroke]);
  };

  const handleSaveToFrameFlow = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderToCanvas(canvas, effectiveState, true);
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `FrameFlow_${timestamp}.jpg`;

    savePhotoNativeOrWeb(jpegUrl, filename);

    const savedItem: SavedFrameFlowPhoto = {
      id: `saved_${Date.now()}`,
      filename,
      folderPath: 'Pictures/FrameFlow',
      dataUrl: jpegUrl,
      width: canvas.width,
      height: canvas.height,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      summary: `${canvas.width}×${canvas.height}px · ${effectiveState.filterId}`,
    };

    if (pendingProposal) {
      commitNextState(pendingProposal.proposedState);
      setLastSavedState(pendingProposal.proposedState);
    } else {
      setLastSavedState(committedState);
    }

    onSaveFinishedPhoto(savedItem);
    setSaveBannerText(`Saved ${filename} to Pictures/FrameFlow`);
    setTimeout(() => setSaveBannerText(null), 4000);
  };

  const handleRunGeminiArgon = async (
    mode: 'auto_enhance' | 'smart_crop' | 'prompt',
    userPromptText = ''
  ) => {
    setAiLoadingMode(mode);
    setAiDiagnostic(null);
    try {
      const response = await fetch(getApiUrl('/api/ai/edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photo.dataUrl,
          mimeType: 'image/jpeg',
          mode,
          prompt: userPromptText,
          currentState: committedState,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.available) {
        setAiDiagnostic({
          model: data.model || 'gemini-4-argon',
          message:
            data.message ||
            'Configure GEMINI_API_KEY in Settings > Secrets to enable AI Edit.',
          setupSteps: Array.isArray(data.setupSteps) ? data.setupSteps : [],
        });
        return;
      }

      const validation = validateAndMergeAiResponse(
        committedState,
        data.proposal,
        photo.width,
        photo.height
      );

      if (!validation.valid) {
        setAiDiagnostic({
          model: 'gemini-4-argon',
          message: `Rejected invalid AI response: ${validation.error}`,
          setupSteps: [],
        });
        return;
      }

      setPendingProposal({
        sourceTitle:
          mode === 'auto_enhance'
            ? 'Auto Enhance'
            : mode === 'smart_crop'
              ? 'Smart Crop'
              : `"${userPromptText}"`,
        summary: validation.summary,
        proposedState: validation.proposedState,
        changedKeys: validation.changedKeys,
      });
    } catch (err) {
      setAiDiagnostic({
        model: 'gemini-4-argon',
        message:
          err instanceof Error
            ? err.message
            : 'Network error while contacting AI endpoint.',
        setupSteps: [],
      });
    } finally {
      setAiLoadingMode(null);
    }
  };

  const handleApplyLookRecipePreview = (recipe: LookRecipe) => {
    const nextState: PhotoEditState = {
      ...committedState,
      ...recipe.overrides,
    };
    setPendingProposal({
      sourceTitle: `Recipe · ${recipe.name}`,
      summary: recipe.description,
      proposedState: nextState,
      changedKeys: Object.keys(recipe.overrides),
    });
  };

  const handleSaveNewCustomRecipe = () => {
    const trimmed = customRecipeName.trim();
    if (!trimmed) return;
    const newRecipe: LookRecipe = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      category: 'Custom',
      description: `Exp ${committedState.exposure}, Glow ${committedState.pictorialGlow}, Filter: ${committedState.filterId}`,
      isBuiltIn: false,
      overrides: {
        brightness: committedState.brightness,
        exposure: committedState.exposure,
        contrast: committedState.contrast,
        highlights: committedState.highlights,
        shadows: committedState.shadows,
        fade: committedState.fade,
        saturation: committedState.saturation,
        vibrance: committedState.vibrance,
        warmth: committedState.warmth,
        tint: committedState.tint,
        clarity: committedState.clarity,
        pictorialGlow: committedState.pictorialGlow,
        grain: committedState.grain,
        splitTone: committedState.splitTone,
        sharpness: committedState.sharpness,
        vignette: committedState.vignette,
        filterId: committedState.filterId,
        filterIntensity: committedState.filterIntensity,
        lightLeakId: committedState.lightLeakId,
        lightLeakIntensity: committedState.lightLeakIntensity,
        borderStyle: committedState.borderStyle,
        borderWidth: committedState.borderWidth,
      },
    };
    onSaveCustomRecipe(newRecipe);
    setCustomRecipeName('');
  };

  const handleDeviceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const nextAsset = await loadFileWithExifNormalized(file);
      onReplacePhoto(nextAsset);
    } finally {
      e.target.value = '';
    }
  };

  const visibleAdjustments =
    adjustGroup === 'all'
      ? ADJUSTMENT_CONTROLS
      : ADJUSTMENT_CONTROLS.filter((c) => c.group === adjustGroup);

  const visibleFilters =
    filterCategory === 'All'
      ? FILTER_CATALOG
      : FILTER_CATALOG.filter((f) => f.category === filterCategory || f.id === 'none');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3.5">
      <input
        ref={filePickerRef}
        type="file"
        accept="image/*"
        onChange={handleDeviceFileChange}
        className="hidden"
        aria-label="Open another photo"
      />

      {/* Sleek Single-Row Darkroom Command Bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111317] shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                setConfirmExitOpen(true);
              } else {
                onBackToCamera();
              }
            }}
            aria-label="Back to Camera"
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Camera</span>
          </button>

          <button
            type="button"
            onClick={() => filePickerRef.current?.click()}
            aria-label="Open Photo"
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Photo</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">
              {photo.name}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                isDirty
                  ? 'text-amber-500 font-medium'
                  : 'text-emerald-500 font-medium'
              }
            >
              {isDirty ? 'Edited' : 'Original'}
            </span>
          </div>
        </div>

        {/* History, Split-Wipe, Compare, and Save Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setHistory((prev) => undoHistory(prev))}
            disabled={history.index <= 0}
            aria-label="Undo edit"
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={() => setHistory((prev) => redoHistory(prev))}
            disabled={history.index >= history.entries.length - 1}
            aria-label="Redo edit"
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Redo</span>
          </button>

          <button
            type="button"
            onClick={() => commitNextState(DEFAULT_EDIT_STATE)}
            disabled={!hasUnsavedEdits(committedState, DEFAULT_EDIT_STATE)}
            aria-label="Reset all edits"
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitWipeEnabled((prev) => !prev)}
            aria-label="Toggle Split Screen Wipe Comparison"
            className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              splitWipeEnabled
                ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOriginalCompare((prev) => !prev)}
            onPointerDown={() => setShowOriginalCompare(true)}
            onPointerUp={() => setShowOriginalCompare(false)}
            onPointerLeave={() => setShowOriginalCompare(false)}
            aria-label="Compare Before and After"
            className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              showOriginalCompare
                ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToFrameFlow}
            aria-label="Save to Pictures/FrameFlow"
            className="min-h-[36px] px-3 sm:px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Save to Pictures/FrameFlow</span>
          </button>
        </div>
      </div>

      {/* Unsaved Exit Confirmation Banner */}
      {confirmExitOpen && (
        <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-800 dark:text-zinc-100">
            <strong>Unsaved edits.</strong> Discard current adjustments and return to Camera?
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmExitOpen(false)}
              className="min-h-[36px] px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmExitOpen(false);
                onBackToCamera();
              }}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Save Confirmation Banner */}
      {saveBannerText && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{saveBannerText}</span>
          <button
            type="button"
            onClick={() => setSaveBannerText(null)}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* AI / Look Recipe Approval Banner when a non-destructive preview is active */}
      {pendingProposal && (
        <div className="p-3.5 rounded-2xl border border-amber-500/50 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-amber-600 dark:text-amber-300">
              Previewing: {pendingProposal.sourceTitle}
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">
              {pendingProposal.summary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingProposal(null)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              onClick={() => commitNextState(pendingProposal.proposedState)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Edit</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Darkroom Grid: Canvas Viewport (Left 7 cols) + Tool Deck (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Left 7 Columns: Live Non-Destructive Canvas + Histogram + Quick Pictorial Strip */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-[#090A0C] p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
          {/* Top Canvas Overlay: Live RGB Histogram & Split-Wipe Indicator */}
          <div className="w-full flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHistogram((prev) => !prev)}
                className={`min-h-[28px] px-2 py-0.5 rounded-lg text-[11px] font-mono flex items-center gap-1 border transition-colors ${
                  showHistogram
                    ? 'bg-zinc-900 text-amber-400 border-zinc-700'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                <span>RGB</span>
              </button>

              {showHistogram && histogram && (
                <svg
                  width="112"
                  height="28"
                  viewBox="0 0 48 20"
                  className="rounded bg-black/80 border border-zinc-800 px-1 py-0.5"
                  aria-label="Live RGB Histogram"
                >
                  <polyline
                    fill="none"
                    stroke="rgba(239,68,68,0.75)"
                    strokeWidth="1"
                    points={histogram.r
                      .map((v, idx) => `${idx},${20 - v * 18}`)
                      .join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="rgba(34,197,94,0.75)"
                    strokeWidth="1"
                    points={histogram.g
                      .map((v, idx) => `${idx},${20 - v * 18}`)
                      .join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="rgba(59,130,246,0.75)"
                    strokeWidth="1"
                    points={histogram.b
                      .map((v, idx) => `${idx},${20 - v * 18}`)
                      .join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="rgba(250,250,250,0.85)"
                    strokeWidth="1"
                    points={histogram.luma
                      .map((v, idx) => `${idx},${20 - v * 18}`)
                      .join(' ')}
                  />
                </svg>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <span>{showOriginalCompare ? 'BEFORE' : splitWipeEnabled ? `SPLIT ${Math.round(splitWipePos * 100)}%` : 'AFTER'}</span>
              <span>·</span>
              <span className="text-amber-400">
                {FILTER_CATALOG.find((f) => f.id === effectiveState.filterId)?.name ?? 'Original'}
              </span>
            </div>
          </div>

          {/* Interactive Photo Canvas */}
          <div className="relative flex items-center justify-center min-h-[220px] sm:min-h-[380px] w-full">
            <canvas
              ref={canvasRef}
              data-testid="editor-photo-canvas"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              className={`max-h-[36vh] sm:max-h-[56vh] max-w-full w-auto h-auto object-contain rounded-lg shadow-2xl ${
                splitWipeEnabled
                  ? 'cursor-ew-resize touch-none'
                  : activeTab === 'annotate' &&
                      annotateMode === 'draw' &&
                      brushEnabled
                    ? 'cursor-crosshair touch-none'
                    : 'cursor-default'
              }`}
            />

            {splitWipeEnabled && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/75 border border-amber-500/40 text-[10px] font-mono text-amber-300 pointer-events-none">
                Drag across photo to compare Before | After
              </div>
            )}
          </div>

          {/* Quick Pictorial & Film Look Strip directly under Canvas */}
          <div className="w-full flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-zinc-800/80 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'none', label: 'Original' },
                  { id: 'pictorialist', label: 'Pictorial 1904' },
                  { id: 'orton_dream', label: 'Orton Bloom' },
                  { id: 'portra', label: 'Portra 400' },
                  { id: 'cine_teal', label: 'Cinestill 800T' },
                  { id: 'silver_bw', label: 'Ilford HP5' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => updateCurrentField('filterId', preset.id)}
                  className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                    effectiveState.filterId === preset.id
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono tabular-nums text-zinc-500 whitespace-nowrap shrink-0">
              {effectiveState.aspectRatio} · {effectiveState.straighten}°
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Organized Darkroom Inspector */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111317] overflow-hidden shadow-xs flex flex-col">
          {/* 5 Section Tabs */}
          <div
            role="tablist"
            aria-label="Photo editor sections"
            className="grid grid-cols-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-[#0B0C0E] p-1 gap-1"
          >
            {[
              { id: 'crop' as const, label: 'Crop', icon: Crop },
              { id: 'adjust' as const, label: 'Adjust', icon: Sliders },
              { id: 'filters' as const, label: 'Filters', icon: Palette },
              { id: 'annotate' as const, label: 'Tools', icon: TypeIcon },
              { id: 'ai' as const, label: 'AI Edit', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[42px] py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section Content Area */}
          <div className="p-4 sm:p-5 flex flex-col gap-4 max-h-[58vh] overflow-y-auto">
            {/* TAB 1: CROP, STRAIGHTEN, ROTATE, FLIP */}
            {activeTab === 'crop' && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Aspect Ratio Presets
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {(
                      ['Free', '1:1', '4:5', '16:9', '9:16', '3:2', '4:3'] as AspectRatioOption[]
                    ).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => {
                          const nextCrop = computeAspectCropBox(
                            ratio,
                            photo.width,
                            photo.height
                          );
                          commitNextState({
                            ...committedState,
                            aspectRatio: ratio,
                            crop: nextCrop,
                          });
                        }}
                        className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                          effectiveState.aspectRatio === ratio
                            ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Straighten Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="slider-straighten"
                      className="font-semibold text-zinc-900 dark:text-zinc-100"
                    >
                      Straighten Horizon
                    </label>
                    <button
                      type="button"
                      onClick={() => updateCurrentField('straighten', 0)}
                      className="font-mono tabular-nums text-amber-500 hover:underline"
                    >
                      {effectiveState.straighten > 0
                        ? `+${effectiveState.straighten}°`
                        : `${effectiveState.straighten}°`}
                    </button>
                  </div>
                  <input
                    id="slider-straighten"
                    type="range"
                    min={-45}
                    max={45}
                    step={0.5}
                    value={effectiveState.straighten}
                    onChange={(e) =>
                      updateCurrentField('straighten', parseFloat(e.target.value))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Rotate & Flip Controls */}
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Rotate & Mirror
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentField(
                          'rotation',
                          (committedState.rotation - 90 + 360) % 360
                        )
                      }
                      className="min-h-[38px] px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>-90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentField('rotation', (committedState.rotation + 90) % 360)
                      }
                      className="min-h-[38px] px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>+90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateCurrentField('flipH', !committedState.flipH)}
                      className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        effectiveState.flipH
                          ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <FlipHorizontal2 className="w-3.5 h-3.5" />
                      <span>Flip H</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateCurrentField('flipV', !committedState.flipV)}
                      className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        effectiveState.flipV
                          ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <FlipVertical2 className="w-3.5 h-3.5" />
                      <span>Flip V</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 16 LIGHT, COLOR & PICTORIAL ADJUSTMENTS */}
            {activeTab === 'adjust' && (
              <div className="flex flex-col gap-3.5">
                {/* Adjustment Sub-Group Filter Bar */}
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#0B0C0E] border border-zinc-200 dark:border-zinc-800">
                  {(
                    [
                      { id: 'all', label: 'All (16)' },
                      { id: 'light', label: 'Light' },
                      { id: 'color', label: 'Color' },
                      { id: 'pictorial', label: 'Pictorial' },
                    ] as const
                  ).map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setAdjustGroup(grp.id)}
                      className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        adjustGroup === grp.id
                          ? 'bg-amber-500 text-zinc-950'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>

                {visibleAdjustments.map((ctrl) => {
                  const currentVal = effectiveState[ctrl.key];
                  return (
                    <div key={ctrl.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor={`slider-${ctrl.key}`}
                          className="font-medium text-zinc-800 dark:text-zinc-200"
                        >
                          {ctrl.label}
                        </label>
                        <button
                          type="button"
                          title="Tap to reset to 0"
                          onClick={() => updateCurrentField(ctrl.key, 0)}
                          className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[11px] transition-colors ${
                            currentVal !== 0
                              ? 'bg-amber-500/15 text-amber-500 font-semibold'
                              : 'text-zinc-500'
                          }`}
                        >
                          {currentVal > 0 && ctrl.min < 0 ? `+${currentVal}` : currentVal}
                        </button>
                      </div>
                      <input
                        id={`slider-${ctrl.key}`}
                        aria-label={ctrl.label}
                        type="range"
                        min={ctrl.min}
                        max={ctrl.max}
                        step={1}
                        value={currentVal}
                        onChange={(e) =>
                          updateCurrentField(ctrl.key, parseInt(e.target.value, 10))
                        }
                        onDoubleClick={() => updateCurrentField(ctrl.key, 0)}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: 15 PICTORIAL, FILM, CINEMA & B&W FILTERS WITH LIVE VISUAL THUMBNAILS */}
            {activeTab === 'filters' && (
              <div className="flex flex-col gap-4">
                {/* Filter Category Selector */}
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#0B0C0E] border border-zinc-200 dark:border-zinc-800">
                  {(['All', 'Pictorial', 'Film', 'Cinema', 'B&W'] as FilterCategory[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFilterCategory(cat)}
                        className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          filterCategory === cat
                            ? 'bg-amber-500 text-zinc-950'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>

                {/* Live Thumbnail Filter Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {visibleFilters.map((filter) => {
                    const selected = effectiveState.filterId === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => updateCurrentField('filterId', filter.id)}
                        className={`group rounded-xl border overflow-hidden text-left transition-all flex flex-col ${
                          selected
                            ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-[#0B0C0E]'
                        }`}
                      >
                        <div className="aspect-[4/3] w-full bg-zinc-900 overflow-hidden relative">
                          <img
                            src={photo.dataUrl}
                            alt={filter.name}
                            referrerPolicy="no-referrer"
                            style={{ filter: FILTER_CSS_PREVIEW[filter.id] }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/65 text-[9px] font-mono text-zinc-200">
                            {filter.category}
                          </span>
                        </div>
                        <div className="p-2">
                          <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {filter.name}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {filter.tagline}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Filter Intensity Slider */}
                {effectiveState.filterId !== 'none' && (
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0C0E]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label
                        htmlFor="slider-filterIntensity"
                        className="font-semibold text-zinc-900 dark:text-zinc-100"
                      >
                        Filter Intensity
                      </label>
                      <span className="font-mono tabular-nums text-amber-500 font-semibold">
                        {effectiveState.filterIntensity}%
                      </span>
                    </div>
                    <input
                      id="slider-filterIntensity"
                      aria-label="Filter Intensity"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={effectiveState.filterIntensity}
                      onChange={(e) =>
                        updateCurrentField(
                          'filterIntensity',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CREATIVE DARKROOM TOOLS (LIGHT LEAKS, FRAMES, STAMPS/TEXT, BRUSH) */}
            {activeTab === 'annotate' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#0B0C0E] border border-zinc-200 dark:border-zinc-800">
                  {[
                    { id: 'leaks' as const, label: 'Leaks', icon: Sun },
                    { id: 'border' as const, label: 'Frames', icon: Frame },
                    { id: 'text' as const, label: 'Stamps', icon: TypeIcon },
                    { id: 'draw' as const, label: 'Brush', icon: PenTool },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAnnotateMode(m.id)}
                        className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                          annotateMode === m.id
                            ? 'bg-amber-500 text-zinc-950'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Icon className="w-3 h-3 shrink-0" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 1. PICTORIAL LIGHT LEAKS */}
                {annotateMode === 'leaks' && (
                  <div className="flex flex-col gap-3.5">
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'none', label: 'No Light Leak' },
                          { id: 'golden_flare', label: 'Golden Sun Flare' },
                          { id: 'prism_burn', label: 'Prism Film Burn' },
                          { id: 'amber_edge', label: 'Amber Edge Leak' },
                          { id: 'cinema_streak', label: 'Anamorphic Streak' },
                        ] as Array<{ id: LightLeakId; label: string }>
                      ).map((leak) => (
                        <button
                          key={leak.id}
                          type="button"
                          onClick={() => updateCurrentField('lightLeakId', leak.id)}
                          className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors whitespace-nowrap shrink-0 ${
                            effectiveState.lightLeakId === leak.id
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                              : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {leak.label}
                        </button>
                      ))}
                    </div>

                    {effectiveState.lightLeakId !== 'none' && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <label htmlFor="slider-leak-intensity">Leak Opacity</label>
                          <span className="font-mono tabular-nums text-amber-500">
                            {effectiveState.lightLeakIntensity}%
                          </span>
                        </div>
                        <input
                          id="slider-leak-intensity"
                          type="range"
                          min={0}
                          max={100}
                          value={effectiveState.lightLeakIntensity}
                          onChange={(e) =>
                            updateCurrentField(
                              'lightLeakIntensity',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. GALLERY & DARKROOM FRAMES */}
                {annotateMode === 'border' && (
                  <div className="flex flex-col gap-3.5">
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'none', label: 'No Border' },
                          { id: 'warm_linen', label: 'Pictorial Linen' },
                          { id: 'gallery_white', label: 'Gallery White' },
                          { id: 'darkroom_black', label: 'Darkroom Black' },
                          { id: 'museum_gold', label: 'Museum Gold' },
                          { id: 'film_frame', label: '35mm Film Frame' },
                          { id: 'polaroid', label: 'Instant Polaroid' },
                        ] as Array<{ id: BorderStyleId; label: string }>
                      ).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            commitNextState({
                              ...committedState,
                              borderStyle: b.id,
                              borderWidth:
                                b.id === 'none'
                                  ? 0
                                  : committedState.borderWidth || 24,
                            });
                          }}
                          className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors whitespace-nowrap shrink-0 ${
                            effectiveState.borderStyle === b.id
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold'
                              : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    {effectiveState.borderStyle !== 'none' && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <label htmlFor="slider-border-width">Border Thickness</label>
                          <span className="font-mono tabular-nums text-amber-500">
                            {effectiveState.borderWidth}%
                          </span>
                        </div>
                        <input
                          id="slider-border-width"
                          type="range"
                          min={5}
                          max={100}
                          value={effectiveState.borderWidth}
                          onChange={(e) =>
                            updateCurrentField(
                              'borderWidth',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. STAMPS & TYPOGRAPHY */}
                {annotateMode === 'text' && (
                  <div className="flex flex-col gap-3">
                    {/* Quick One-Tap Retro Date & EXIF Stamps */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const stamp: PhotoEditState['textOverlays'][number] = {
                            id: `stamp_${Date.now()}`,
                            text: "'98 11 01",
                            x: 0.82,
                            y: 0.9,
                            color: '#f97316',
                            fontSize: 26,
                            fontStyle: 'mono',
                          };
                          updateCurrentField('textOverlays', [
                            ...committedState.textOverlays,
                            stamp,
                          ]);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 text-xs font-mono text-amber-500 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>+ &apos;98 Date Stamp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const stamp: PhotoEditState['textOverlays'][number] = {
                            id: `exif_${Date.now()}`,
                            text: 'LEICA 35MM F/1.4 · ISO 100',
                            x: 0.5,
                            y: 0.93,
                            color: '#fafaf9',
                            fontSize: 18,
                            fontStyle: 'mono',
                          };
                          updateCurrentField('textOverlays', [
                            ...committedState.textOverlays,
                            stamp,
                          ]);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <span>+ EXIF Stamp</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={textDraft}
                        onChange={(e) => setTextDraft(e.target.value)}
                        placeholder="Custom caption..."
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!textDraft.trim()) return;
                          updateCurrentField('textOverlays', [
                            ...committedState.textOverlays,
                            {
                              id: `txt_${Date.now()}`,
                              text: textDraft.trim(),
                              x: 0.5,
                              y: 0.5,
                              color: textColor,
                              fontSize: textSize,
                              fontStyle: 'sans',
                            },
                          ]);
                          setTextDraft('');
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {['#ffffff', '#f59e0b', '#f97316', '#ef4444', '#38bdf8', '#090d16'].map(
                          (hex) => (
                            <button
                              key={hex}
                              type="button"
                              aria-label={`Select text color ${hex}`}
                              onClick={() => setTextColor(hex)}
                              style={{ backgroundColor: hex }}
                              className={`w-6 h-6 rounded-full border ${
                                textColor === hex
                                  ? 'ring-2 ring-amber-500 border-white'
                                  : 'border-zinc-400'
                              }`}
                            />
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-zinc-500">Size</span>
                        <input
                          type="range"
                          min={16}
                          max={64}
                          value={textSize}
                          onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </div>

                    {effectiveState.textOverlays.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {effectiveState.textOverlays.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs"
                          >
                            <span className="truncate font-mono">{item.text}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCurrentField(
                                  'textOverlays',
                                  committedState.textOverlays.filter((t) => t.id !== item.id)
                                )
                              }
                              className="text-red-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. FREEHAND BRUSH */}
                {annotateMode === 'draw' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Canvas Brush Mode</span>
                      <button
                        type="button"
                        onClick={() => setBrushEnabled((prev) => !prev)}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold ${
                          brushEnabled
                            ? 'bg-amber-500 text-zinc-950'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {brushEnabled ? 'Drawing Active' : 'Enable Brush'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {['#f59e0b', '#ffffff', '#ef4444', '#10b981', '#38bdf8', '#a855f7'].map(
                        (hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setBrushColor(hex)}
                            style={{ backgroundColor: hex }}
                            className={`w-6 h-6 rounded-full border ${
                              brushColor === hex
                                ? 'ring-2 ring-amber-500 border-white'
                                : 'border-zinc-500'
                            }`}
                          />
                        )
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label htmlFor="slider-brush-size">Stroke Width</label>
                        <span className="font-mono tabular-nums">{brushSize}px</span>
                      </div>
                      <input
                        id="slider-brush-size"
                        type="range"
                        min={2}
                        max={28}
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    {effectiveState.drawStrokes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => updateCurrentField('drawStrokes', [])}
                        className="min-h-[34px] px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 text-xs font-medium self-start"
                      >
                        Clear All Strokes ({effectiveState.drawStrokes.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: AI EDIT & LOOK RECIPES */}
            {activeTab === 'ai' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={aiLoadingMode !== null}
                    onClick={() => handleRunGeminiArgon('auto_enhance')}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {aiLoadingMode === 'auto_enhance' ? 'Analyzing...' : 'Auto Enhance'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={aiLoadingMode !== null}
                    onClick={() => handleRunGeminiArgon('smart_crop')}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Crop className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {aiLoadingMode === 'smart_crop' ? 'Framing...' : 'Smart Crop'}
                    </span>
                  </button>
                </div>

                {/* Edit with Words */}
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0C0E] flex flex-col gap-2">
                  <label
                    htmlFor="ai-word-prompt"
                    className="text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Edit with Words
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="ai-word-prompt"
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., dreamy pictorial glow with warm shadows"
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    />
                    <button
                      type="button"
                      disabled={aiLoadingMode !== null || !aiPrompt.trim()}
                      onClick={() => handleRunGeminiArgon('prompt', aiPrompt.trim())}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-semibold disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {aiDiagnostic && (
                  <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs flex items-start gap-2 break-words">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {aiDiagnostic.message}
                    </span>
                  </div>
                )}

                {/* Built-in & Custom Look Recipes */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Look Recipes
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customRecipeName}
                      onChange={(e) => setCustomRecipeName(e.target.value)}
                      placeholder="Save current look as recipe..."
                      className="flex-1 min-h-[36px] px-3 py-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                    />
                    <button
                      type="button"
                      disabled={!customRecipeName.trim()}
                      onClick={handleSaveNewCustomRecipe}
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {[...customRecipes, ...BUILT_IN_LOOK_RECIPES].map((recipe) => (
                      <div
                        key={recipe.id}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0C0E] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {recipe.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-300">
                              {recipe.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {recipe.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyLookRecipePreview(recipe)}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            Preview
                          </button>
                          {!recipe.isBuiltIn && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomRecipe(recipe.id)}
                              aria-label={`Delete recipe ${recipe.name}`}
                              className="min-h-[32px] px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
