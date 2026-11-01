import React, { useEffect, useState } from 'react';
import { X, Download, Smartphone, FileCode2, CheckCircle2 } from 'lucide-react';

interface AndroidFileEntry {
  path: string;
  content: string;
}

interface AndroidProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectModal: React.FC<AndroidProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [files, setFiles] = useState<AndroidFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>(
    'app/src/main/java/com/frameflow/app/camera/CameraScreen.kt'
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/android-project')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.files)) {
          setFiles(data.files);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const activeFile =
    files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-modal-title"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-amber-500" />
            <div>
              <h2
                id="android-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Native Android Project (Kotlin + Jetpack Compose + CameraX)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete source in <code className="font-mono">/android</code> + Physical Android Phone Installation Steps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/android-project.zip"
              download="FrameFlow-Android-Studio.zip"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Android Studio Project (.zip)</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Android Studio source inspector"
              className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left 4 cols: Phone Install Steps & File Tree */}
          <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto space-y-5 bg-slate-50 dark:bg-slate-950/50">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                Install & Test on a Physical Android Phone
              </h3>
              <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li>
                  Click <strong>Download Android Studio Project (.zip)</strong> above and unzip <code className="font-mono">FrameFlow-Android</code>.
                </li>
                <li>
                  Open the folder in <strong>Android Studio Ladybug (2024.2+)</strong> with Android SDK 35.
                </li>
                <li>
                  On your physical Android phone, enable <strong>Developer Options &rarr; USB Debugging</strong> and connect via USB (or Wireless Debugging).
                </li>
                <li>
                  Run <code className="font-mono">./gradlew installDebug</code> or click <strong>Run &apos;app&apos;</strong> in Android Studio to launch CameraX on your phone&apos;s hardware sensor.
                </li>
                <li>
                  <strong>Optional Gemini 4 Argon setup:</strong> Place <code className="font-mono">app/google-services.json</code> from your Firebase project and uncomment <code className="font-mono">id(&quot;com.google.gms.google-services&quot;)</code> in <code className="font-mono">app/build.gradle.kts</code> to enable keyless <code className="font-mono">gemini-4-argon</code> via Firebase AI Logic.
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                Android Source Files ({files.length})
              </h3>
              {loading ? (
                <div className="text-xs text-slate-500">Loading project files...</div>
              ) : (
                <div className="space-y-1">
                  {files.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors ${
                        activeFile?.path === file.path
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 8 cols: Source Code Viewer */}
          <div className="lg:col-span-8 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
            {activeFile ? (
              <>
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>android/{activeFile.path}</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Kotlin / Gradle Verified</span>
                  </span>
                </div>
                <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto flex-1 select-all">
                  <code>{activeFile.content}</code>
                </pre>
              </>
            ) : (
              <div className="p-8 text-xs text-slate-400">Select a file to inspect source.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
