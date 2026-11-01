/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Camera,
  Sliders,
  Sparkles,
  FolderOpen,
  Download,
  Aperture,
} from 'lucide-react';
import { CameraScreen } from './components/CameraScreen';
import { PhotoReviewScreen } from './components/PhotoReviewScreen';
import { PhotoEditorScreen, SavedFrameFlowPhoto } from './components/PhotoEditorScreen';
import { AiStudioScreen } from './components/AiStudioScreen';
import { SavedGalleryModal } from './components/SavedGalleryModal';
import {
  createSampleTestPhotos,
  loadBundledRealPhotos,
  PhotoAsset,
} from './utils/samplePhotos';
import { LookRecipe } from './utils/editorEngine';

type AppView = 'camera' | 'review' | 'editor' | 'ai_studio';

const CUSTOM_RECIPES_STORAGE_KEY = 'frameflow_custom_recipes_v2';
const SAVED_PHOTOS_STORAGE_KEY = 'frameflow_saved_photos_v2';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [view, setView] = useState<AppView>('camera');
  const [samplePhotos, setSamplePhotos] = useState<PhotoAsset[]>(() =>
    createSampleTestPhotos()
  );
  const [activePhoto, setActivePhoto] = useState<PhotoAsset | null>(() => {
    const initial = createSampleTestPhotos();
    return initial[0] ?? null;
  });

  const [savedPhotos, setSavedPhotos] = useState<SavedFrameFlowPhoto[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_PHOTOS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [customRecipes, setCustomRecipes] = useState<LookRecipe[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_RECIPES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [galleryModalOpen, setGalleryModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    loadBundledRealPhotos().then((realPhotos) => {
      if (!mounted || realPhotos.length === 0) return;
      setSamplePhotos(realPhotos);
      setActivePhoto((prev) => {
        if (!prev || prev.id === 'sample_alpine_twilight') {
          return realPhotos[0];
        }
        return prev;
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_RECIPES_STORAGE_KEY, JSON.stringify(customRecipes));
    } catch {
      // Ignore storage quota errors
    }
  }, [customRecipes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SAVED_PHOTOS_STORAGE_KEY,
        JSON.stringify(savedPhotos.slice(0, 8))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [savedPhotos]);

  const handlePhotoCaptured = (photo: PhotoAsset) => {
    setActivePhoto(photo);
    setView('review');
  };

  const handlePhotoSelectedForEdit = (photo: PhotoAsset) => {
    setActivePhoto(photo);
    setView('editor');
  };

  const handleSaveFinishedPhoto = (saved: SavedFrameFlowPhoto) => {
    setSavedPhotos((prev) => [saved, ...prev]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4F0] dark:bg-[#0B0C0E] text-zinc-900 dark:text-zinc-100 transition-colors pb-16 md:pb-0 select-none">
      {/* Tactile Anodized Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-6 px-3.5 sm:px-6 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-[#F5F4F0]/95 dark:bg-[#111317]/95 backdrop-blur-md">
        {/* Zone 1: Brand Emblem */}
        <a
          href="#camera"
          onClick={(e) => {
            e.preventDefault();
            setView('camera');
          }}
          className="flex items-center gap-2 text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500">
            <Aperture className="w-4 h-4" />
          </span>
          <span>FrameFlow</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" aria-hidden="true" />
        </a>

        {/* Zone 2: Segmented Studio Switcher (Desktop/Tablet) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300/60 dark:border-zinc-800"
        >
          <a
            href="#camera"
            onClick={(e) => {
              e.preventDefault();
              setView('camera');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              view === 'camera'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Camera
          </a>
          <a
            href="#editor"
            onClick={(e) => {
              e.preventDefault();
              if (!activePhoto && samplePhotos.length > 0) {
                setActivePhoto(samplePhotos[0]);
              }
              setView('editor');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              view === 'editor'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Darkroom
          </a>
          <a
            href="#ai-studio"
            onClick={(e) => {
              e.preventDefault();
              setView('ai_studio');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              view === 'ai_studio'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-amber-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            AI Studio
          </a>
          <a
            href="#gallery"
            onClick={(e) => {
              e.preventDefault();
              setGalleryModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all whitespace-nowrap shrink-0"
          >
            Saved ({savedPhotos.length})
          </a>
        </nav>

        {/* Zone 3: Direct APK Download & Theme Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/FrameFlow.apk"
            download="FrameFlow.apk"
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>

          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            aria-label={darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {view === 'camera' && (
          <CameraScreen
            samplePhotos={samplePhotos}
            savedCount={savedPhotos.length}
            onPhotoCaptured={handlePhotoCaptured}
            onPhotoSelectedForEdit={handlePhotoSelectedForEdit}
            onOpenSavedGallery={() => setGalleryModalOpen(true)}
            onOpenAiStudio={() => setView('ai_studio')}
          />
        )}

        {view === 'review' && activePhoto && (
          <PhotoReviewScreen
            photo={activePhoto}
            onRetake={() => setView('camera')}
            onProceedToEdit={() => setView('editor')}
          />
        )}

        {view === 'editor' && activePhoto && (
          <PhotoEditorScreen
            photo={activePhoto}
            customRecipes={customRecipes}
            onSaveCustomRecipe={(recipe) => setCustomRecipes((prev) => [recipe, ...prev])}
            onDeleteCustomRecipe={(id) =>
              setCustomRecipes((prev) => prev.filter((r) => r.id !== id))
            }
            onSaveFinishedPhoto={handleSaveFinishedPhoto}
            onBackToCamera={() => setView('camera')}
            onReplacePhoto={(nextPhoto) => setActivePhoto(nextPhoto)}
            onOpenAiStudio={() => setView('ai_studio')}
          />
        )}

        {view === 'ai_studio' && (
          <AiStudioScreen
            activePhoto={activePhoto}
            samplePhotos={samplePhotos}
            onOpenInEditor={handlePhotoSelectedForEdit}
            onSaveFinishedPhoto={handleSaveFinishedPhoto}
          />
        )}
      </main>

      {/* Responsive Mobile Bottom Navigation Dock */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-zinc-200 dark:border-zinc-800/90 bg-[#F5F4F0]/95 dark:bg-[#111317]/95 backdrop-blur-md px-2 py-1"
      >
        <button
          type="button"
          onClick={() => setView('camera')}
          className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
            view === 'camera'
              ? 'text-amber-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Camera</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!activePhoto && samplePhotos.length > 0) {
              setActivePhoto(samplePhotos[0]);
            }
            setView('editor');
          }}
          className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
            view === 'editor'
              ? 'text-amber-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Editor</span>
        </button>

        <button
          type="button"
          onClick={() => setView('ai_studio')}
          className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
            view === 'ai_studio'
              ? 'text-amber-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setGalleryModalOpen(true)}
          className="min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Saved ({savedPhotos.length})</span>
        </button>
      </nav>

      <SavedGalleryModal
        isOpen={galleryModalOpen}
        savedPhotos={savedPhotos}
        onClose={() => setGalleryModalOpen(false)}
        onReopenInEditor={(photo) => {
          setActivePhoto(photo);
          setView('editor');
        }}
        onDeleteSavedPhoto={(id) =>
          setSavedPhotos((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}
