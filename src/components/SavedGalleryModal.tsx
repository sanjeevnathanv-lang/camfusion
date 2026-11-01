import React from 'react';
import { X, FolderOpen, Download, Sliders, Trash2 } from 'lucide-react';
import { SavedFrameFlowPhoto } from './PhotoEditorScreen';
import { PhotoAsset } from '../utils/samplePhotos';

interface SavedGalleryModalProps {
  isOpen: boolean;
  savedPhotos: SavedFrameFlowPhoto[];
  onClose: () => void;
  onReopenInEditor: (photo: PhotoAsset) => void;
  onDeleteSavedPhoto: (id: string) => void;
}

export const SavedGalleryModal: React.FC<SavedGalleryModalProps> = ({
  isOpen,
  savedPhotos,
  onClose,
  onReopenInEditor,
  onDeleteSavedPhoto,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-gallery-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-5 h-5 text-amber-500" />
            <h2
              id="saved-gallery-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Pictures/FrameFlow
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pictures/FrameFlow gallery"
            className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {savedPhotos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No saved photos yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedPhotos.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-[4/3] bg-slate-900 overflow-hidden">
                    <img
                      src={item.dataUrl}
                      alt={item.filename}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <div>
                      <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.filename}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.folderPath} · {item.savedAt}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {item.summary}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onReopenInEditor({
                            id: item.id,
                            name: item.filename.replace(/\.jpg$/i, ''),
                            sourceType: 'picker',
                            dataUrl: item.dataUrl,
                            width: item.width,
                            height: item.height,
                            capturedAt: item.savedAt,
                            exifSummary: item.summary,
                          });
                          onClose();
                        }}
                        className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Edit Copy</span>
                      </button>

                      <a
                        href={item.dataUrl}
                        download={item.filename}
                        aria-label={`Download ${item.filename}`}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs flex items-center justify-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => onDeleteSavedPhoto(item.id)}
                        aria-label={`Delete ${item.filename}`}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-red-500 text-xs flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
