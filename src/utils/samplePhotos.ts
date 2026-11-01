export interface PhotoAsset {
  id: string;
  name: string;
  sourceType: 'camera' | 'picker' | 'sample_reference';
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
  exifSummary: string;
}

/**
 * Reads JPEG EXIF Orientation tag (0x0112) from an ArrayBuffer so photos from phones
 * are rotated upright before editing.
 */
export function readJpegExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }
  let offset = 2;
  const length = view.byteLength;
  while (offset + 4 < length) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      const app1Length = view.getUint16(offset, false);
      if (offset + app1Length > length) break;
      if (view.getUint32(offset + 2, false) !== 0x45786966) {
        return 1;
      }
      const tiffOffset = offset + 8;
      const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
      const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      if (tiffOffset + firstIfdOffset + 2 > length) return 1;
      const tags = view.getUint16(tiffOffset + firstIfdOffset, littleEndian);
      for (let i = 0; i < tags; i++) {
        const tagOffset = tiffOffset + firstIfdOffset + 2 + i * 12;
        if (tagOffset + 12 > length) break;
        if (view.getUint16(tagOffset, littleEndian) === 0x0112) {
          return view.getUint16(tagOffset + 8, littleEndian);
        }
      }
      return 1;
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset, false);
    }
  }
  return 1;
}

/**
 * Loads a File into a normalized upright dataURL respecting EXIF orientation.
 */
export async function loadFileWithExifNormalized(file: File): Promise<PhotoAsset> {
  const buffer = await file.arrayBuffer();
  const orientation = readJpegExifOrientation(buffer);
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const swapDims = orientation >= 5 && orientation <= 8;
      const width = swapDims ? img.naturalHeight : img.naturalWidth;
      const height = swapDims ? img.naturalWidth : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not initialize 2D canvas context'));
        return;
      }

      switch (orientation) {
        case 2:
          ctx.transform(-1, 0, 0, 1, width, 0);
          break;
        case 3:
          ctx.transform(-1, 0, 0, -1, width, height);
          break;
        case 4:
          ctx.transform(1, 0, 0, -1, 0, height);
          break;
        case 5:
          ctx.transform(0, 1, 1, 0, 0, 0);
          break;
        case 6:
          ctx.transform(0, 1, -1, 0, width, 0);
          break;
        case 7:
          ctx.transform(0, -1, -1, 0, width, height);
          break;
        case 8:
          ctx.transform(0, -1, 1, 0, 0, height);
          break;
        default:
          break;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      resolve({
        id: `picker_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        sourceType: 'picker',
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        width,
        height,
        capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exifSummary: `${width}×${height}px · EXIF #${orientation}`,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode selected image file.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Loads the bundled real photographs from ./samples/*.jpg into clean dataURLs
 * so canvas pixel operations work with real studio photography.
 */
export async function loadBundledRealPhotos(): Promise<PhotoAsset[]> {
  if (typeof document === 'undefined') return [];

  const catalog = [
    {
      id: 'sample_real_portrait',
      name: 'LeicaPortrait_50mm',
      url: './samples/portrait.jpg',
      capturedAt: '50mm f/1.4 · 1/500s · ISO 100',
      exifSummary: '50mm Summilux · Natural Light Portrait',
    },
    {
      id: 'sample_real_yosemite',
      name: 'YosemiteValley_Dawn',
      url: './samples/yosemite.jpg',
      capturedAt: '24mm f/4.0 · 1/250s · ISO 64',
      exifSummary: '24mm Elmarit · Alpine Mist & Pine',
    },
    {
      id: 'sample_real_kyoto',
      name: 'KyotoAlley_Night',
      url: './samples/kyoto.jpg',
      capturedAt: '35mm f/1.8 · 1/60s · ISO 800',
      exifSummary: '35mm Cron · Neon Lantern Rain',
    },
    {
      id: 'sample_real_cafe',
      name: 'ArtisanEspresso_35mm',
      url: './samples/cinema_cafe.jpg',
      capturedAt: '35mm f/2.0 · 1/125s · ISO 400',
      exifSummary: '35mm · Warm Window Light',
    },
  ];

  const loaded: PhotoAsset[] = [];

  for (const item of catalog) {
    try {
      const asset = await new Promise<PhotoAsset>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const maxDim = 960;
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No 2d context'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({
            id: item.id,
            name: item.name,
            sourceType: 'sample_reference',
            dataUrl: canvas.toDataURL('image/jpeg', 0.92),
            width: w,
            height: h,
            capturedAt: item.capturedAt,
            exifSummary: item.exifSummary,
          });
        };
        img.onerror = () => reject(new Error(`Failed to load ${item.url}`));
        img.src = item.url;
      });
      loaded.push(asset);
    } catch {
      // Skip if unavailable
    }
  }

  return loaded;
}

/**
 * Synchronous fallback photographic captures for immediate mount before async real JPEGs resolve.
 */
export function createSampleTestPhotos(): PhotoAsset[] {
  if (typeof document === 'undefined') return [];

  const buildAlpineTwilight = (): PhotoAsset => {
    const w = 960;
    const h = 640;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Rich twilight sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0, '#090d16');
    sky.addColorStop(0.32, '#1e293b');
    sky.addColorStop(0.68, '#9a3412');
    sky.addColorStop(1, '#fbbf24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Glowing setting sun bloom
    const sun = ctx.createRadialGradient(w * 0.64, h * 0.46, 10, w * 0.64, h * 0.46, 220);
    sun.addColorStop(0, '#fffbeb');
    sun.addColorStop(0.25, 'rgba(253, 224, 71, 0.75)');
    sun.addColorStop(0.6, 'rgba(249, 115, 22, 0.28)');
    sun.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // Layered atmospheric mountain ridges
    const layers = [
      { yBase: 0.48, amp: 55, freq: 0.005, phase: 1.2, color: '#312e81' },
      { yBase: 0.56, amp: 44, freq: 0.007, phase: 2.5, color: '#1e1b4b' },
      { yBase: 0.65, amp: 32, freq: 0.009, phase: 4.1, color: '#0f172a' },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y =
          h * layer.yBase -
          Math.sin(x * layer.freq + layer.phase) * layer.amp -
          Math.cos(x * layer.freq * 2.3) * (layer.amp * 0.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // Alpine lake reflection
    const lake = ctx.createLinearGradient(0, h * 0.68, 0, h);
    lake.addColorStop(0, '#431407');
    lake.addColorStop(0.4, '#1e293b');
    lake.addColorStop(1, '#090d16');
    ctx.fillStyle = lake;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    return {
      id: 'sample_alpine_twilight',
      name: 'AlpineTwilight_24mm',
      sourceType: 'sample_reference',
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      width: w,
      height: h,
      capturedAt: '24mm f/2.8 · 1/250s · ISO 100',
      exifSummary: '24mm f/2.8 · Golden Hour Landscape',
    };
  };

  return [buildAlpineTwilight()];
}
