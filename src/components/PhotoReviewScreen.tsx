import React from 'react';
import { RefreshCw, Sliders, Camera } from 'lucide-react';
import { PhotoAsset } from '../utils/samplePhotos';

interface PhotoReviewScreenProps {
  photo: PhotoAsset;
  onRetake: () => void;
  onProceedToEdit: () => void;
}

export const PhotoReviewScreen: React.FC<PhotoReviewScreenProps> = ({
  photo,
  onRetake,
  onProceedToEdit,
}) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-amber-500" />
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {photo.name}
            </h1>
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {photo.capturedAt}
          </div>
        </div>

        <div className="bg-slate-950 p-4 sm:p-6 flex items-center justify-center min-h-[380px] max-h-[68vh]">
          <img
            src={photo.dataUrl}
            alt={photo.name}
            referrerPolicy="no-referrer"
            className="max-h-[60vh] w-auto object-contain rounded-lg shadow-lg"
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onRetake}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retake</span>
          </button>
          <button
            type="button"
            onClick={onProceedToEdit}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Sliders className="w-4 h-4" />
            <span>Open in Photo Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
};
