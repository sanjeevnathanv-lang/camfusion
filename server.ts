import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;
const ARGON_MODEL = 'gemini-4-argon';
const IMAGE_MODEL = 'gemini-nano-banana-2.1';
const VIDEO_MODEL = 'gemini-omni-1.1-flash';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown, modelName: string): string {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (
    rawMessage.includes('429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('FreeTier') ||
    rawMessage.includes('403') ||
    rawMessage.includes('PERMISSION_DENIED')
  ) {
    return `Billing-enabled Gemini API key required for ${modelName}. Configure GEMINI_API_KEY in Settings > Secrets.`;
  }
  if (rawMessage.includes('400') || rawMessage.includes('API_KEY_INVALID')) {
    return `Invalid API key for ${modelName}. Check GEMINI_API_KEY in Settings > Secrets.`;
  }
  return `${modelName} request failed. Check your API key in Settings > Secrets.`;
}

function collectAndroidFiles(dirPath: string, baseDir: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...collectAndroidFiles(fullPath, baseDir));
    } else {
      results.push({
        path: relPath,
        content: fs.readFileSync(fullPath, 'utf-8'),
      });
    }
  }
  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Allow requests from the installed FrameFlow Android APK
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Direct signed Android APK binary download route
  const serveApk = (_req: express.Request, res: express.Response) => {
    const apkPath = path.resolve(process.cwd(), 'public', 'FrameFlow.apk');
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({ error: 'FrameFlow.apk is currently building.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="FrameFlow.apk"');
    res.sendFile(apkPath);
  };

  app.get('/FrameFlow.apk', serveApk);
  app.get('/api/frameflow.apk', serveApk);

  app.get('/api/android-project', (_req, res) => {
    const androidDir = path.resolve(process.cwd(), 'android');
    const files = collectAndroidFiles(androidDir, androidDir);
    res.json({
      projectName: 'FrameFlow Android',
      minSdk: 26,
      targetSdk: 35,
      aiModel: ARGON_MODEL,
      files,
    });
  });

  app.get('/api/android-project.zip', async (_req, res) => {
    try {
      const androidDir = path.resolve(process.cwd(), 'android');
      const files = collectAndroidFiles(androidDir, androidDir);
      const zip = new JSZip();
      const rootFolder = zip.folder('FrameFlow-Android');
      if (rootFolder) {
        for (const f of files) {
          rootFolder.file(f.path, f.content);
        }
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="FrameFlow-Android-Studio.zip"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to build Android project archive',
      });
    }
  });

  // 1. Non-destructive parameter edits with gemini-4-argon
  app.post('/api/ai/edit', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(200).json({
        available: false,
        model: ARGON_MODEL,
        reason: 'MISSING_PAID_API_KEY',
        message: `Configure GEMINI_API_KEY in Settings > Secrets to enable ${ARGON_MODEL}.`,
        setupSteps: [],
      });
      return;
    }

    const { imageBase64, mimeType = 'image/jpeg', mode = 'auto_enhance', prompt = '', currentState } = req.body ?? {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({
        available: false,
        model: ARGON_MODEL,
        reason: 'INVALID_REQUEST',
        message: 'Image data is required.',
      });
      return;
    }

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      let instructionText = '';
      if (mode === 'auto_enhance') {
        instructionText =
          'Analyze this photograph for exposure, dynamic range, shadow/highlight clipping, color temperature, and micro-contrast. Propose balanced non-destructive adjustment parameters.';
      } else if (mode === 'smart_crop') {
        instructionText =
          'Analyze this photograph for horizon tilt and composition balance. Propose a straighten angle (-45 to 45 degrees), an aspectRatio (Free, 1:1, 4:5, 16:9, 9:16, 3:2, 4:3), and normalized crop bounds.';
      } else {
        instructionText = `Translate the user's editing request into structured non-destructive adjustment parameters for this photo. User request: "${String(prompt).slice(0, 400)}"`;
      }

      const response = await ai.models.generateContent({
        model: ARGON_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `${instructionText}\nCurrent editor state JSON: ${JSON.stringify(currentState ?? {})}.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are FrameFlow’s non-destructive photo colorist powered by Gemini 4 Argon. Return strictly valid JSON adjustment parameters within these bounds: brightness, exposure, contrast, saturation, warmth, tint, highlights, shadows in [-100, 100]; sharpness, vignette, filterIntensity in [0, 100]; straighten in [-45, 45]; aspectRatio in ["Free","1:1","4:5","16:9","9:16","3:2","4:3"]; filterId in ["none","portra","kodachrome","silver_bw","cine_teal","nordic","golden_dusk","matte_editorial"].',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              brightness: { type: Type.NUMBER },
              exposure: { type: Type.NUMBER },
              contrast: { type: Type.NUMBER },
              saturation: { type: Type.NUMBER },
              warmth: { type: Type.NUMBER },
              tint: { type: Type.NUMBER },
              highlights: { type: Type.NUMBER },
              shadows: { type: Type.NUMBER },
              sharpness: { type: Type.NUMBER },
              vignette: { type: Type.NUMBER },
              straighten: { type: Type.NUMBER },
              aspectRatio: { type: Type.STRING },
              filterId: { type: Type.STRING },
              filterIntensity: { type: Type.NUMBER },
            },
            required: ['summary'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(200).json({
          available: false,
          model: ARGON_MODEL,
          reason: 'EMPTY_MODEL_RESPONSE',
          message: `Empty response from ${ARGON_MODEL}.`,
          setupSteps: [],
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        available: true,
        model: ARGON_MODEL,
        proposal: parsed,
      });
    } catch (err: unknown) {
      res.status(200).json({
        available: false,
        model: ARGON_MODEL,
        reason: 'MODEL_ACCESS_ERROR',
        message: formatApiError(err, ARGON_MODEL),
        setupSteps: [],
      });
    }
  });

  // 2. Create & Edit Images with gemini-nano-banana-2.1
  app.post('/api/ai/image', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(200).json({
        ok: false,
        model: IMAGE_MODEL,
        message: `Configure GEMINI_API_KEY in Settings > Secrets to use ${IMAGE_MODEL}.`,
      });
      return;
    }

    const {
      prompt = '',
      imageBase64,
      mimeType = 'image/jpeg',
      aspectRatio = '1:1',
      imageSize = '1K',
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        ok: false,
        model: IMAGE_MODEL,
        message: 'Enter a text prompt to create or edit an image.',
      });
      return;
    }

    try {
      const parts: Array<
        | { inlineData: { data: string; mimeType: string } }
        | { text: string }
      > = [];

      if (imageBase64 && typeof imageBase64 === 'string') {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        });
      }
      parts.push({ text: prompt.trim() });

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let generatedImageUrl: string | null = null;
      let textOutput = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType ?? 'image/png';
          generatedImageUrl = `data:${outMime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (!generatedImageUrl) {
        res.status(200).json({
          ok: false,
          model: IMAGE_MODEL,
          message: textOutput || 'No image was returned by gemini-nano-banana-2.1.',
        });
        return;
      }

      res.json({
        ok: true,
        model: IMAGE_MODEL,
        imageUrl: generatedImageUrl,
        text: textOutput,
      });
    } catch (err: unknown) {
      res.status(200).json({
        ok: false,
        model: IMAGE_MODEL,
        message: formatApiError(err, IMAGE_MODEL),
      });
    }
  });

  // 3. Animate Images into Video with gemini-omni-1.1-flash via the Interactions API
  app.post('/api/ai/video', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(200).json({
        ok: false,
        model: VIDEO_MODEL,
        message: `Configure GEMINI_API_KEY in Settings > Secrets to animate photos with ${VIDEO_MODEL}.`,
      });
      return;
    }

    const {
      imageBase64,
      mimeType = 'image/jpeg',
      prompt = 'Subtle natural camera motion bringing this scene to life.',
      aspectRatio = '16:9',
      duration = '5s',
    } = req.body ?? {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({
        ok: false,
        model: VIDEO_MODEL,
        message: 'Upload or select a photo to animate into a video.',
      });
      return;
    }

    const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    const validDuration = duration === '10s' ? '10s' : '5s';

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      const interaction = await ai.interactions.create(
        {
          model: VIDEO_MODEL,
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: cleanBase64,
            },
            {
              type: 'text',
              text: String(prompt).trim() || 'Animate this photo with smooth cinematic motion.',
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspectRatio,
            duration: validDuration,
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart && videoPart.data) {
        const videoMime = videoPart.mime_type || 'video/mp4';
        res.json({
          ok: true,
          model: VIDEO_MODEL,
          aspectRatio: validAspectRatio,
          videoUrl: `data:${videoMime};base64,${videoPart.data}`,
        });
        return;
      }

      // Fallback check across steps if output_video helper wasn't populated
      let stepVideoData: string | null = null;
      let stepVideoMime = 'video/mp4';
      for (const step of interaction.steps ?? []) {
        if (step.type === 'model_output') {
          for (const item of step.content ?? []) {
            if (item.type === 'video' && item.data) {
              stepVideoData = item.data;
              stepVideoMime = item.mime_type || 'video/mp4';
            }
          }
        }
      }

      if (stepVideoData) {
        res.json({
          ok: true,
          model: VIDEO_MODEL,
          aspectRatio: validAspectRatio,
          videoUrl: `data:${stepVideoMime};base64,${stepVideoData}`,
        });
        return;
      }

      res.status(200).json({
        ok: false,
        model: VIDEO_MODEL,
        message: 'No video payload was returned by gemini-omni-1.1-flash.',
      });
    } catch (err: unknown) {
      res.status(200).json({
        ok: false,
        model: VIDEO_MODEL,
        message: formatApiError(err, VIDEO_MODEL),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FrameFlow server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
