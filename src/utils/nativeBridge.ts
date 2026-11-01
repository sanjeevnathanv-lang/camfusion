declare global {
  interface Window {
    FrameFlowNative?: {
      savePhotoToMediaStore?: (dataUrl: string, filename: string) => boolean;
      isNativeAndroidApk?: () => boolean;
    };
  }
}

const CLOUD_BACKEND_ORIGIN =
  'https://ais-pre-zr6c3zs2fzujmu7tztyezm-671107429678.asia-southeast1.run.app';

export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return `${CLOUD_BACKEND_ORIGIN}${path}`;
  }
  return path;
}

export function savePhotoNativeOrWeb(dataUrl: string, filename: string): void {
  if (
    typeof window !== 'undefined' &&
    window.FrameFlowNative &&
    typeof window.FrameFlowNative.savePhotoToMediaStore === 'function'
  ) {
    try {
      const ok = window.FrameFlowNative.savePhotoToMediaStore(dataUrl, filename);
      if (ok) return;
    } catch {
      // Fallback to standard download
    }
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
