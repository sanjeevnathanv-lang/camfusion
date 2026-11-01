import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Zap,
  ZapOff,
  Sun,
  Image as ImageIcon,
  ZoomIn,
  Upload,
  Focus,
  FolderOpen,
  Wand2,
  Film,
  Grid,
  Timer,
  Sparkles,
} from 'lucide-react';
import { PhotoAsset, loadFileWithExifNormalized } from '../utils/samplePhotos';

interface CameraScreenProps {
  samplePhotos: PhotoAsset[];
  savedCount: number;
  onPhotoCaptured: (photo: PhotoAsset) => void;
  onPhotoSelectedForEdit: (photo: PhotoAsset) => void;
  onOpenSavedGallery: () => void;
  onOpenAiStudio: () => void;
}

type CameraStatus =
  | 'initializing'
  | 'ready'
  | 'permission_denied'
  | 'no_hardware'
  | 'error';

type ViewfinderLook = 'neutral' | 'pictorial' | 'portra' | 'mono';
type GridOverlayMode = 'thirds' | 'golden' | 'crosshair' | 'off';

const VIEWFINDER_LOOKS: Array<{
  id: ViewfinderLook;
  label: string;
  cssFilter: string;
}> = [
  { id: 'neutral', label: 'STD', cssFilter: 'none' },
  {
    id: 'pictorial',
    label: 'PICTORIAL',
    cssFilter: 'sepia(32%) contrast(92%) brightness(106%) saturate(88%)',
  },
  {
    id: 'portra',
    label: 'PORTRA',
    cssFilter: 'contrast(104%) saturate(118%) sepia(12%)',
  },
  {
    id: 'mono',
    label: 'HP5 B&W',
    cssFilter: 'grayscale(100%) contrast(122%)',
  },
];

export const CameraScreen: React.FC<CameraScreenProps> = ({
  samplePhotos,
  savedCount,
  onPhotoCaptured,
  onPhotoSelectedForEdit,
  onOpenSavedGallery,
  onOpenAiStudio,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackImgRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<CameraStatus>('initializing');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);

  const [zoom, setZoom] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(3);
  const [hardwareZoomSupported, setHardwareZoomSupported] = useState<boolean>(false);

  const [flashMode, setFlashMode] = useState<'off' | 'auto' | 'on'>('off');
  const [hardwareTorchSupported, setHardwareTorchSupported] = useState<boolean>(false);
  const [isScreenFlashing, setIsScreenFlashing] = useState<boolean>(false);

  const [evCompensation, setEvCompensation] = useState<number>(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [viewfinderLook, setViewfinderLook] = useState<ViewfinderLook>('neutral');
  const [gridMode, setGridMode] = useState<GridOverlayMode>('thirds');
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const activeSampleScene = samplePhotos[activeSceneIdx] ?? samplePhotos[0] ?? null;
  const activeLookObj =
    VIEWFINDER_LOOKS.find((l) => l.id === viewfinderLook) ?? VIEWFINDER_LOOKS[0];

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (requestedFacing: 'environment' | 'user') => {
      stopCurrentStream();
      setStatus('initializing');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setStatus('no_hardware');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as Record<string, unknown>;
          if (
            caps.zoom &&
            typeof caps.zoom === 'object' &&
            caps.zoom !== null &&
            'max' in caps.zoom
          ) {
            const maxZ = Number((caps.zoom as { max: number }).max) || 3;
            setHardwareZoomSupported(maxZ > 1);
            setMaxZoom(Math.min(Math.max(maxZ, 2), 6));
          } else {
            setHardwareZoomSupported(false);
            setMaxZoom(3);
          }
          setHardwareTorchSupported(Boolean(caps.torch));
        }

        setStatus('ready');
      } catch (err: unknown) {
        const errorName = err instanceof DOMException ? err.name : '';
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (
          errorName === 'NotAllowedError' ||
          errorName === 'PermissionDeniedError' ||
          errorMsg.toLowerCase().includes('permission')
        ) {
          setStatus('permission_denied');
        } else {
          setStatus('no_hardware');
        }
      }
    },
    [stopCurrentStream]
  );

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCurrentStream();
    };
  }, [facingMode, startCamera, stopCurrentStream]);

  const handleZoomChange = async (nextZoom: number) => {
    setZoom(nextZoom);
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (track && hardwareZoomSupported) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: nextZoom } as unknown as MediaTrackConstraintSet],
        });
      } catch {
        // Fallback to optical crop zoom on capture
      }
    }
  };

  const handleToggleFlash = async () => {
    const next: 'off' | 'auto' | 'on' =
      flashMode === 'off' ? 'auto' : flashMode === 'auto' ? 'on' : 'off';
    setFlashMode(next);

    const track = streamRef.current?.getVideoTracks()?.[0];
    if (track && hardwareTorchSupported) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: next === 'on' } as unknown as MediaTrackConstraintSet],
        });
      } catch {
        // Ignore unsupported torch constraint
      }
    }
  };

  const handleCycleGrid = () => {
    const order: GridOverlayMode[] = ['thirds', 'golden', 'crosshair', 'off'];
    const next = order[(order.indexOf(gridMode) + 1) % order.length];
    setGridMode(next);
  };

  const handleCycleTimer = () => {
    const next = timerSeconds === 0 ? 3 : timerSeconds === 3 ? 10 : 0;
    setTimerSeconds(next);
  };

  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFocusPoint({ x, y });
  };

  const executeFrameCapture = () => {
    const video = videoRef.current;
    const fallbackImg = fallbackImgRef.current;

    const doCapture = () => {
      const isLiveVideo = status === 'ready' && video && video.videoWidth > 0;
      const vw = isLiveVideo
        ? video.videoWidth
        : fallbackImg?.naturalWidth || activeSampleScene?.width || 960;
      const vh = isLiveVideo
        ? video.videoHeight
        : fallbackImg?.naturalHeight || activeSampleScene?.height || 640;

      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      const brightnessPct = Math.round(100 + evCompensation * 28);
      const lookFilter =
        activeLookObj.cssFilter === 'none' ? '' : ` ${activeLookObj.cssFilter}`;
      ctx.filter = `brightness(${brightnessPct}%)${lookFilter}`;

      if (facingMode === 'user') {
        ctx.translate(vw, 0);
        ctx.scale(-1, 1);
      }

      const cropScale = isLiveVideo && hardwareZoomSupported ? 1 : zoom;
      const sw = vw / cropScale;
      const sh = vh / cropScale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;

      if (isLiveVideo && video) {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
      } else if (fallbackImg) {
        ctx.drawImage(fallbackImg, sx, sy, sw, sh, 0, 0, vw, vh);
      }
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      onPhotoCaptured({
        id: `capture_${Date.now()}`,
        name: `L100_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`,
        sourceType: 'camera',
        dataUrl,
        width: vw,
        height: vh,
        capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exifSummary: `${vw}×${vh}px · ${zoom.toFixed(1)}x · EV ${
          evCompensation >= 0 ? `+${evCompensation.toFixed(1)}` : evCompensation.toFixed(1)
        } · ${activeLookObj.label}`,
      });
    };

    setIsScreenFlashing(true);
    setTimeout(() => {
      doCapture();
      setIsScreenFlashing(false);
    }, 110);
  };

  const handleCapturePhoto = () => {
    if (countdown !== null) return;
    if (timerSeconds > 0) {
      let remaining = timerSeconds;
      setCountdown(remaining);
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(null);
          executeFrameCapture();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    } else {
      executeFrameCapture();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const asset = await loadFileWithExifNormalized(file);
      onPhotoCaptured(asset);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Could not load the selected photo.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const combinedPreviewFilter = `brightness(${Math.round(100 + evCompensation * 28)}%)${
    activeLookObj.cssFilter === 'none' ? '' : ` ${activeLookObj.cssFilter}`
  }`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 items-start">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Upload photo from device"
      />

      {/* Left 8 Cols: Tactile Optical Camera Viewfinder */}
      <div className="lg:col-span-8 flex flex-col rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-[#090A0C] text-white overflow-hidden shadow-lg">
        {/* Top Optical Telemetry & Quick Controls Bar */}
        <div className="flex items-center justify-between gap-1.5 px-2.5 sm:px-4 py-2 border-b border-zinc-800/90 bg-[#111317]">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-300 font-mono tabular-nums whitespace-nowrap shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 font-semibold">
              DNG
            </span>
            <span>{facingMode === 'environment' ? '24mm' : 'Front'}</span>
            <span className="text-amber-400">{zoom.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCycleGrid}
              aria-label={`Grid mode ${gridMode}`}
              className={`min-h-[32px] px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                gridMode !== 'off'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{gridMode.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={handleCycleTimer}
              aria-label={`Self timer ${timerSeconds}s`}
              className={`min-h-[32px] px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                timerSeconds > 0
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{timerSeconds > 0 ? `${timerSeconds}s` : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFlash}
              aria-label={`Flash mode ${flashMode}`}
              className="min-h-[32px] px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[10px] sm:text-[11px] font-mono flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              {flashMode === 'off' ? (
                <ZapOff className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{flashMode.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              aria-label="Switch front and rear camera"
              className="min-h-[32px] px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[10px] sm:text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
            </button>
          </div>
        </div>

        {/* Optical Viewfinder Viewport */}
        <div
          onClick={handleViewfinderTap}
          className="relative w-full aspect-[4/3] max-h-[38vh] sm:max-h-[500px] bg-black flex items-center justify-center overflow-hidden select-none cursor-crosshair"
        >
          {/* Hardware Camera Stream when active */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-150 ${
              status === 'ready' ? 'block' : 'hidden'
            }`}
            style={{
              transform: `${facingMode === 'user' ? 'scaleX(-1) ' : ''}scale(${
                hardwareZoomSupported ? 1 : zoom
              })`,
              filter: combinedPreviewFilter,
            }}
          />

          {/* Interactive Optical Sensor Preview when hardware camera is not attached */}
          {status !== 'ready' && activeSampleScene && (
            <img
              ref={fallbackImgRef}
              src={activeSampleScene.dataUrl}
              alt={activeSampleScene.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-150"
              style={{
                transform: `${facingMode === 'user' ? 'scaleX(-1) ' : ''}scale(${zoom})`,
                filter: combinedPreviewFilter,
              }}
            />
          )}

          {/* Shutter Flash Effect */}
          {isScreenFlashing && (
            <div className="absolute inset-0 bg-white z-30 pointer-events-none" />
          )}

          {/* Countdown Timer Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-20 bg-black/45 flex items-center justify-center pointer-events-none">
              <span className="text-6xl font-mono font-bold text-amber-400 drop-shadow-lg">
                {countdown}
              </span>
            </div>
          )}

          {/* Composition Grid Overlays */}
          {gridMode === 'thirds' && (
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>
          )}

          {gridMode === 'golden' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-y-0 left-[38.2%] border-l border-amber-400/25" />
              <div className="absolute inset-y-0 left-[61.8%] border-l border-amber-400/25" />
              <div className="absolute inset-x-0 top-[38.2%] border-t border-amber-400/25" />
              <div className="absolute inset-x-0 top-[61.8%] border-t border-amber-400/25" />
            </div>
          )}

          {gridMode === 'crosshair' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-12 h-[1px] bg-amber-400/60" />
              <div className="h-12 w-[1px] bg-amber-400/60 absolute" />
              <div className="w-6 h-6 rounded-full border border-amber-400/50 absolute" />
            </div>
          )}

          {/* Optical Corner Frame Brackets */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-white/50 pointer-events-none" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-white/50 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-white/50 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-white/50 pointer-events-none" />

          {/* Tap-to-Focus AF Lock Reticle */}
          {focusPoint && (
            <div
              style={{
                left: `${focusPoint.x * 100}%`,
                top: `${focusPoint.y * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-amber-400 rounded-lg pointer-events-none flex items-center justify-center shadow-sm"
            >
              <Focus className="w-4 h-4 text-amber-400" />
              <span className="absolute -top-4 text-[9px] font-mono bg-amber-400 text-zinc-950 px-1 rounded font-bold">
                AF-S
              </span>
            </div>
          )}

          {/* Bottom-Left Hardware Sensor Pill & Scene Switcher when no webcam is connected */}
          {status !== 'ready' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15"
            >
              <div className="flex items-center gap-1.5">
                {samplePhotos.map((sp, idx) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setActiveSceneIdx(idx)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                      activeSceneIdx === idx
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    }`}
                  >
                    Scene {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium text-white flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Camera className="w-3 h-3 text-amber-400" />
                <span>Connect Lens</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Optical Film Look Selector Bar */}
        <div className="px-3.5 py-2 bg-[#0E1014] border-t border-zinc-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 whitespace-nowrap shrink-0">
            Optical Look
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {VIEWFINDER_LOOKS.map((look) => (
              <button
                key={look.id}
                type="button"
                onClick={() => setViewfinderLook(look.id)}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                  viewfinderLook === look.id
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {look.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tactile Camera Dials & Shutter Deck */}
        <div className="px-4 py-3 bg-[#111317] border-t border-zinc-800/90 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleZoomChange(preset)}
                    className={`min-h-[28px] px-2 py-0.5 rounded text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      Math.abs(zoom - preset) < 0.15
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
              <input
                type="range"
                aria-label="Camera Zoom Ratio"
                min={1}
                max={maxZoom}
                step={0.1}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <Sun className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="text-xs font-mono text-zinc-400 shrink-0">EV</span>
              <input
                type="range"
                aria-label="Exposure Compensation EV"
                min={-2}
                max={2}
                step={0.1}
                value={evCompensation}
                onChange={(e) => setEvCompensation(parseFloat(e.target.value))}
                onDoubleClick={() => setEvCompensation(0)}
                className="w-full accent-amber-400"
              />
              <span className="text-xs font-mono tabular-nums text-amber-400 w-12 text-right shrink-0">
                {evCompensation >= 0 ? `+${evCompensation.toFixed(1)}` : evCompensation.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Open Photo</span>
            </button>

            <button
              type="button"
              onClick={handleCapturePhoto}
              aria-label="Capture Photo with Camera"
              className="w-15 h-15 sm:w-16 sm:h-16 rounded-full border-4 border-zinc-200 flex items-center justify-center p-1 transition-transform active:scale-90 shadow-md"
            >
              <span className="w-full h-full rounded-full bg-white hover:bg-amber-400 transition-colors flex items-center justify-center">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-950" />
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenSavedGallery}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Saved ({savedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right 4 Cols: Film Contact Sheet & AI Darkroom Quick Launch */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-[#111317] p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Contact Sheet
              </h2>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          </div>

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {uploadError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {samplePhotos.map((sample) => (
              <div
                key={sample.id}
                className="group rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-zinc-50 dark:bg-[#0B0C0E] p-2 flex items-center justify-between gap-2.5 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={sample.dataUrl}
                    alt={sample.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-11 rounded-lg object-cover shrink-0 bg-zinc-900 border border-zinc-800"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {sample.name.replace(/^IMG_\d+_/, '')}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 truncate">
                      {sample.capturedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPhotoCaptured(sample)}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => onPhotoSelectedForEdit(sample)}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    Edit Photo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Creative Darkroom Launcher */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-[#111317] p-4 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Creative Lab</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenAiStudio}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 bg-zinc-50 dark:bg-[#0B0C0E] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Create / Edit</span>
            </button>
            <button
              type="button"
              onClick={onOpenAiStudio}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 bg-zinc-50 dark:bg-[#0B0C0E] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Film className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Animate Video</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
