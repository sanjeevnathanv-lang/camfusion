import React, { useRef, useState } from 'react';
import {
  Wand2,
  Film,
  Upload,
  Sliders,
  Download,
  Sparkles,
  Image as ImageIcon,
  Play,
  AlertCircle,
} from 'lucide-react';
import { PhotoAsset, loadFileWithExifNormalized } from '../utils/samplePhotos';
import { SavedFrameFlowPhoto } from './PhotoEditorScreen';
import { getApiUrl } from '../utils/nativeBridge';

interface AiStudioScreenProps {
  activePhoto: PhotoAsset | null;
  samplePhotos: PhotoAsset[];
  onOpenInEditor: (photo: PhotoAsset) => void;
  onSaveFinishedPhoto: (saved: SavedFrameFlowPhoto) => void;
}

export const AiStudioScreen: React.FC<AiStudioScreenProps> = ({
  activePhoto,
  samplePhotos,
  onOpenInEditor,
  onSaveFinishedPhoto,
}) => {
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const videoUploadRef = useRef<HTMLInputElement | null>(null);

  const [studioMode, setStudioMode] = useState<'image' | 'video'>('image');

  // Create & Edit Images (gemini-nano-banana-2.1) state
  const [imageTask, setImageTask] = useState<'create' | 'edit'>('create');
  const [sourcePhotoForEdit, setSourcePhotoForEdit] = useState<PhotoAsset | null>(
    activePhoto ?? samplePhotos[0] ?? null
  );
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageAspectRatio, setImageAspectRatio] = useState<
    '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
  >('4:3');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageStatusError, setImageStatusError] = useState<string | null>(null);

  // Animate Image to Video (gemini-omni-1.1-flash via Interactions API) state
  const [sourcePhotoForVideo, setSourcePhotoForVideo] = useState<PhotoAsset | null>(
    activePhoto ?? samplePhotos[0] ?? null
  );
  const [videoPrompt, setVideoPrompt] = useState<string>(
    'Cinematic slow camera push-in with subtle natural motion and atmospheric lighting.'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s'>('5s');
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoStatusError, setVideoStatusError] = useState<string | null>(null);

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadFileWithExifNormalized(file);
      setSourcePhotoForEdit(loaded);
      setImageTask('edit');
    } catch (err) {
      setImageStatusError(err instanceof Error ? err.message : 'Failed to load photo.');
    } finally {
      e.target.value = '';
    }
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadFileWithExifNormalized(file);
      setSourcePhotoForVideo(loaded);
      setVideoStatusError(null);
    } catch (err) {
      setVideoStatusError(err instanceof Error ? err.message : 'Failed to load photo.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRunImageGeneration = async () => {
    if (!imagePrompt.trim()) return;
    setImageLoading(true);
    setImageStatusError(null);

    try {
      const response = await fetch(getApiUrl('/api/ai/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          imageBase64: imageTask === 'edit' ? sourcePhotoForEdit?.dataUrl : undefined,
          mimeType: 'image/jpeg',
          aspectRatio: imageAspectRatio,
          imageSize,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setImageStatusError(data.message || 'Image generation could not be completed.');
        return;
      }

      setGeneratedImageUrl(data.imageUrl);
    } catch (err) {
      setImageStatusError(
        err instanceof Error ? err.message : 'Network error during image generation.'
      );
    } finally {
      setImageLoading(false);
    }
  };

  const handleRunVideoAnimation = async () => {
    if (!sourcePhotoForVideo) {
      setVideoStatusError('Upload or select a photo first.');
      return;
    }
    setVideoLoading(true);
    setVideoStatusError(null);

    try {
      const response = await fetch(getApiUrl('/api/ai/video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: sourcePhotoForVideo.dataUrl,
          mimeType: 'image/jpeg',
          prompt: videoPrompt.trim(),
          aspectRatio: videoAspectRatio,
          duration: videoDuration,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setVideoStatusError(data.message || 'Video animation could not be completed.');
        return;
      }

      setGeneratedVideoUrl(data.videoUrl);
    } catch (err) {
      setVideoStatusError(
        err instanceof Error ? err.message : 'Network error during video generation.'
      );
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelect}
        className="hidden"
        aria-label="Upload photo for AI image editing"
      />
      <input
        ref={videoUploadRef}
        type="file"
        accept="image/*"
        onChange={handleVideoFileSelect}
        className="hidden"
        aria-label="Upload photo for video animation"
      />

      {/* Mode Switcher Bar */}
      <div className="p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setStudioMode('image')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              studioMode === 'image'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 shrink-0" />
            <span>Create & Edit Image</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('video')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              studioMode === 'video'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Animate Video</span>
          </button>
        </div>
      </div>

      {/* MODE 1: CREATE & EDIT IMAGES (gemini-nano-banana-2.1) */}
      {studioMode === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left 7 Cols: Canvas Output / Reference Preview */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 sm:p-5 flex flex-col items-center justify-center min-h-[210px] sm:min-h-[440px]">
            {generatedImageUrl ? (
              <div className="w-full flex flex-col items-center gap-4">
                <img
                  src={generatedImageUrl}
                  alt="AI generated or edited result"
                  referrerPolicy="no-referrer"
                  className="max-h-[58vh] w-auto object-contain rounded-xl shadow-xl"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const asset: PhotoAsset = {
                        id: `ai_img_${Date.now()}`,
                        name: `AI_${Date.now().toString().slice(-5)}`,
                        sourceType: 'picker',
                        dataUrl: generatedImageUrl,
                        width: 1024,
                        height: 1024,
                        capturedAt: new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        exifSummary: `${imageAspectRatio} · ${imageSize}`,
                      };
                      onOpenInEditor(asset);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-2"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open in Editor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const filename = `FrameFlow_AI_${Date.now()}.png`;
                      onSaveFinishedPhoto({
                        id: `saved_ai_${Date.now()}`,
                        filename,
                        folderPath: 'Pictures/FrameFlow',
                        dataUrl: generatedImageUrl,
                        width: 1024,
                        height: 1024,
                        savedAt: new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        summary: `AI Image · ${imageAspectRatio} · ${imageSize}`,
                      });
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save to Pictures/FrameFlow</span>
                  </button>
                </div>
              </div>
            ) : imageTask === 'edit' && sourcePhotoForEdit ? (
              <div className="w-full flex flex-col items-center gap-3">
                <img
                  src={sourcePhotoForEdit.dataUrl}
                  alt={sourcePhotoForEdit.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[56vh] w-auto object-contain rounded-xl opacity-90"
                />
                <span className="text-xs text-slate-400 font-mono">
                  Source: {sourcePhotoForEdit.name}
                </span>
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  Image Canvas
                </p>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Controls */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-5">
            {/* Create vs Edit Switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setImageTask('create')}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  imageTask === 'create'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Create from Prompt
              </button>
              <button
                type="button"
                onClick={() => setImageTask('edit')}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  imageTask === 'edit'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Edit Photo with Prompt
              </button>
            </div>

            {imageTask === 'edit' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Source Photo
                  </span>
                  <button
                    type="button"
                    onClick={() => imageUploadRef.current?.click()}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {samplePhotos.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSourcePhotoForEdit(sp)}
                      className={`rounded-lg overflow-hidden border-2 aspect-[4/3] ${
                        sourcePhotoForEdit?.id === sp.id
                          ? 'border-amber-500'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={sp.dataUrl}
                        alt={sp.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Aspect Ratio & Resolution */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['1:1', '4:3', '3:4', '16:9', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setImageAspectRatio(ratio)}
                      className={`min-h-[36px] rounded-lg text-xs font-mono border transition-colors ${
                        imageAspectRatio === ratio
                          ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Resolution
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['1K', '2K', '4K'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setImageSize(sz)}
                      className={`min-h-[36px] rounded-lg text-xs font-mono border transition-colors ${
                        imageSize === sz
                          ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="nano-banana-prompt"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Prompt
              </label>
              <textarea
                id="nano-banana-prompt"
                rows={3}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={
                  imageTask === 'create'
                    ? 'Describe the image to create...'
                    : 'Describe how to edit the photo...'
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {(imageTask === 'create'
                  ? [
                      'Minimalist architectural courtyard at golden hour, 35mm film',
                      'Studio product shot of a vintage rangefinder camera on slate',
                    ]
                  : [
                      'Add warm sunset light rays through the background',
                      'Transform into a cinematic rainy Tokyo evening',
                    ]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setImagePrompt(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {imageStatusError && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{imageStatusError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={imageLoading || !imagePrompt.trim()}
              onClick={handleRunImageGeneration}
              className="min-h-[46px] w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {imageLoading
                  ? 'Running gemini-nano-banana-2.1...'
                  : imageTask === 'create'
                    ? 'Create Image'
                    : 'Generate Edited Image'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* MODE 2: ANIMATE IMAGES INTO VIDEO (gemini-omni-1.1-flash via Interactions API) */}
      {studioMode === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left 7 Cols: Video Player / Starting Frame Preview */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 sm:p-5 flex flex-col items-center justify-center min-h-[210px] sm:min-h-[440px]">
            {generatedVideoUrl ? (
              <div className="w-full flex flex-col items-center gap-4">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[58vh] w-auto rounded-xl shadow-xl"
                />
                <a
                  href={generatedVideoUrl}
                  download={`FrameFlow_Video_${videoAspectRatio.replace(':', 'x')}_${Date.now()}.mp4`}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video (.mp4)</span>
                </a>
              </div>
            ) : sourcePhotoForVideo ? (
              <div className="w-full flex flex-col items-center gap-3">
                <img
                  src={sourcePhotoForVideo.dataUrl}
                  alt={sourcePhotoForVideo.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[56vh] w-auto object-contain rounded-xl"
                />
                <span className="text-xs text-slate-400 font-mono">
                  Starting Frame: {sourcePhotoForVideo.name} · Output: {videoAspectRatio}
                </span>
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  Upload a photo to animate into video
                </p>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Video Animation Controls */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-5">
            {/* Upload / Select Starting Photo */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Starting Photo
                </span>
                <button
                  type="button"
                  onClick={() => videoUploadRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {samplePhotos.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSourcePhotoForVideo(sp)}
                    className={`rounded-lg overflow-hidden border-2 aspect-[4/3] ${
                      sourcePhotoForVideo?.id === sp.id
                        ? 'border-amber-500'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={sp.dataUrl}
                      alt={sp.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio (Strictly 16:9 Landscape or 9:16 Portrait) & Duration */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Video Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('16:9')}
                    className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      videoAspectRatio === '16:9'
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    16:9 Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('9:16')}
                    className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                      videoAspectRatio === '9:16'
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    9:16 Portrait
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Clip Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['5s', '10s'] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setVideoDuration(dur)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                        videoDuration === dur
                          ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Motion Prompt */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="video-motion-prompt"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Motion Direction
              </label>
              <textarea
                id="video-motion-prompt"
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe camera movement and scene motion..."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs resize-none"
              />
            </div>

            {videoStatusError && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{videoStatusError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={videoLoading || !sourcePhotoForVideo}
              onClick={handleRunVideoAnimation}
              className="min-h-[46px] w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {videoLoading
                  ? 'Animating Video...'
                  : `Generate ${videoAspectRatio} Video`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
