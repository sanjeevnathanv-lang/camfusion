package com.frameflow.app.editor

import android.content.ContentValues
import android.content.Context
import android.graphics.*
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import kotlinx.serialization.Serializable
import kotlin.math.*

@Serializable
data class PhotoEditState(
    // Geometry & Crop
    val aspectRatio: String = "Free", // Free, 1:1, 4:5, 16:9, 3:2
    val straightenDegrees: Float = 0f, // -45f..45f
    val rotationQuarterTurns: Int = 0, // 0, 1, 2, 3
    val flipHorizontal: Boolean = false,
    val flipVertical: Boolean = false,
    val cropLeft: Float = 0f, // 0f..1f
    val cropTop: Float = 0f,
    val cropRight: Float = 1f,
    val cropBottom: Float = 1f,

    // 10 Functional Adjustments
    val brightness: Float = 0f,  // -100..100
    val exposure: Float = 0f,    // -100..100
    val contrast: Float = 0f,    // -100..100
    val saturation: Float = 0f,  // -100..100
    val warmth: Float = 0f,      // -100..100
    val tint: Float = 0f,        // -100..100
    val highlights: Float = 0f,  // -100..100
    val shadows: Float = 0f,     // -100..100
    val sharpness: Float = 0f,   // 0..100
    val vignette: Float = 0f,    // 0..100

    // Adjustable Filter
    val filterId: String = "none",
    val filterIntensity: Float = 100f, // 0..100

    // Border Frame
    val borderStyle: String = "none", // none, white, black, film
    val borderThickness: Float = 0f   // 0..100
)

data class TextOverlayItem(
    val id: String,
    val text: String,
    val xFraction: Float = 0.5f,
    val yFraction: Float = 0.5f,
    val colorArgb: Int = Color.WHITE,
    val sizeSp: Float = 24f
)

data class DrawStrokeItem(
    val points: List<PointF>,
    val colorArgb: Int = Color.WHITE,
    val strokeWidthPx: Float = 8f
)

@Serializable
data class LookRecipe(
    val id: String,
    val name: String,
    val description: String,
    val state: PhotoEditState,
    val isBuiltIn: Boolean = false
)

val builtInLookRecipes = listOf(
    LookRecipe(
        id = "analogue_warmth",
        name = "Analogue Warmth",
        description = "Golden warmth, lifted shadows, gentle contrast",
        state = PhotoEditState(
            exposure = 8f,
            contrast = -8f,
            saturation = 12f,
            warmth = 26f,
            shadows = 22f,
            highlights = -12f,
            vignette = 18f,
            filterId = "portra",
            filterIntensity = 75f
        ),
        isBuiltIn = true
    ),
    LookRecipe(
        id = "crisp_monochrome",
        name = "Silver Gelatin B&W",
        description = "High-contrast monochrome with crisp micro-sharpness",
        state = PhotoEditState(
            contrast = 28f,
            saturation = -100f,
            highlights = 10f,
            shadows = -14f,
            sharpness = 35f,
            vignette = 25f,
            filterId = "silver_bw",
            filterIntensity = 100f
        ),
        isBuiltIn = true
    ),
    LookRecipe(
        id = "nordic_daylight",
        name = "Nordic Daylight",
        description = "Clean, airy highlights with cool architectural neutrals",
        state = PhotoEditState(
            brightness = 10f,
            exposure = 12f,
            contrast = 14f,
            saturation = -12f,
            warmth = -16f,
            highlights = -18f,
            shadows = 16f,
            sharpness = 20f
        ),
        isBuiltIn = true
    )
)

object BitmapProcessor {

    /**
     * Loads a Bitmap from a content Uri and applies EXIF orientation transformation
     * so portrait and landscape captures display and save upright.
     */
    fun loadExifCorrectedBitmap(context: Context, uri: Uri): Bitmap? {
        val rawBitmap = context.contentResolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream)
        } ?: return null

        val orientation = context.contentResolver.openInputStream(uri)?.use { stream ->
            ExifInterface(stream).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
        } ?: ExifInterface.ORIENTATION_NORMAL

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
        }
        return Bitmap.createBitmap(
            rawBitmap,
            0,
            0,
            rawBitmap.width,
            rawBitmap.height,
            matrix,
            true
        )
    }

    /**
     * Non-destructively renders all geometry, tonal/color adjustments, filter presets,
     * drawing paths, text overlays, and borders onto a new Bitmap.
     */
    fun renderEditedBitmap(
        source: Bitmap,
        state: PhotoEditState,
        strokes: List<DrawStrokeItem> = emptyList(),
        texts: List<TextOverlayItem> = emptyList()
    ): Bitmap {
        // 1. Apply rotation, flip, straighten, and crop
        val geomMatrix = Matrix().apply {
            val sx = if (state.flipHorizontal) -1f else 1f
            val sy = if (state.flipVertical) -1f else 1f
            postScale(sx, sy, source.width / 2f, source.height / 2f)
            val totalAngle = (state.rotationQuarterTurns * 90f) + state.straightenDegrees
            if (totalAngle != 0f) {
                postRotate(totalAngle, source.width / 2f, source.height / 2f)
            }
        }
        val transformed = Bitmap.createBitmap(
            source, 0, 0, source.width, source.height, geomMatrix, true
        )

        val leftPx = (state.cropLeft.coerceIn(0f, 0.9f) * transformed.width).toInt()
        val topPx = (state.cropTop.coerceIn(0f, 0.9f) * transformed.height).toInt()
        val rightPx = (state.cropRight.coerceIn(0.1f, 1f) * transformed.width).toInt()
        val bottomPx = (state.cropBottom.coerceIn(0.1f, 1f) * transformed.height).toInt()
        val cropW = (rightPx - leftPx).coerceAtLeast(32)
        val cropH = (bottomPx - topPx).coerceAtLeast(32)

        val cropped = Bitmap.createBitmap(
            transformed,
            leftPx.coerceIn(0, transformed.width - cropW),
            topPx.coerceIn(0, transformed.height - cropH),
            cropW,
            cropH
        )

        // 2. Per-pixel tonal & color pipeline (Brightness, Exposure, Contrast, Saturation,
        // Warmth, Tint, Highlights, Shadows, Filter, Vignette)
        val width = cropped.width
        val height = cropped.height
        val pixels = IntArray(width * height)
        cropped.getPixels(pixels, 0, width, 0, 0, width, height)

        val expFactor = 2.0f.pow(state.exposure / 50f)
        val brightOffset = state.brightness * 1.8f
        val contrastFactor = ((259f * (state.contrast + 255f)) / (255f * (259f - state.contrast)))
        val satFactor = 1f + (state.saturation / 100f)
        val warmthShift = state.warmth * 0.9f
        val tintShift = state.tint * 0.8f
        val highlightGain = state.highlights / 100f
        val shadowGain = state.shadows / 100f
        val vigStrength = (state.vignette / 100f).coerceIn(0f, 1f)
        val filterStrength = (state.filterIntensity / 100f).coerceIn(0f, 1f)

        val cx = width / 2f
        val cy = height / 2f
        val maxDist = hypot(cx, cy).coerceAtLeast(1f)

        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val c = pixels[idx]
                var r = ((c shr 16) and 0xFF).toFloat()
                var g = ((c shr 8) and 0xFF).toFloat()
                var b = (c and 0xFF).toFloat()

                // Exposure & Brightness
                r = r * expFactor + brightOffset
                g = g * expFactor + brightOffset
                b = b * expFactor + brightOffset

                // Highlights & Shadows tonal recovery
                val lum = (0.299f * r + 0.587f * g + 0.114f * b) / 255f
                val shadowMask = (1f - lum).coerceIn(0f, 1f).pow(1.6f)
                val highlightMask = lum.coerceIn(0f, 1f).pow(1.6f)
                val toneDelta = (shadowGain * shadowMask * 65f) + (highlightGain * highlightMask * 65f)
                r += toneDelta
                g += toneDelta
                b += toneDelta

                // Contrast
                r = contrastFactor * (r - 128f) + 128f
                g = contrastFactor * (g - 128f) + 128f
                b = contrastFactor * (b - 128f) + 128f

                // Warmth (R/B balance) & Tint (G/M balance)
                r += warmthShift + tintShift * 0.35f
                g -= tintShift * 0.7f
                b -= warmthShift - tintShift * 0.35f

                // Saturation
                val gray = 0.299f * r + 0.587f * g + 0.114f * b
                r = gray + (r - gray) * satFactor
                g = gray + (g - gray) * satFactor
                b = gray + (b - gray) * satFactor

                // Adjustable Filter Preset
                if (state.filterId != "none" && filterStrength > 0f) {
                    var fr = r
                    var fg = g
                    var fb = b
                    when (state.filterId) {
                        "portra" -> {
                            fr = r * 1.06f + 8f
                            fg = g * 1.02f + 3f
                            fb = b * 0.92f
                        }
                        "kodachrome" -> {
                            fr = contrastFactor * (r * 1.08f - 120f) + 125f
                            fg = g * 0.98f
                            fb = b * 0.88f
                        }
                        "silver_bw" -> {
                            val bw = 0.32f * r + 0.56f * g + 0.12f * b
                            fr = bw
                            fg = bw
                            fb = bw
                        }
                        "cine_teal" -> {
                            fr = r * 1.05f + 6f
                            fg = g * 1.01f
                            fb = b * 1.08f + 10f
                        }
                    }
                    r = r + (fr - r) * filterStrength
                    g = g + (fg - g) * filterStrength
                    b = b + (fb - b) * filterStrength
                }

                // Vignette falloff
                if (vigStrength > 0f) {
                    val dist = hypot(x - cx, y - cy) / maxDist
                    val falloff = (1f - vigStrength * (dist * dist * 1.15f)).coerceIn(0.15f, 1f)
                    r *= falloff
                    g *= falloff
                    b *= falloff
                }

                val ir = r.roundToInt().coerceIn(0, 255)
                val ig = g.roundToInt().coerceIn(0, 255)
                val ib = b.roundToInt().coerceIn(0, 255)
                pixels[idx] = (0xFF shl 24) or (ir shl 16) or (ig shl 8) or ib
            }
        }

        val outBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        outBitmap.setPixels(pixels, 0, width, 0, 0, width, height)

        // 3. Draw annotations (freehand strokes, text, and borders)
        val canvas = Canvas(outBitmap)

        // Freehand strokes
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        for (stroke in strokes) {
            if (stroke.points.size < 2) continue
            strokePaint.color = stroke.colorArgb
            strokePaint.strokeWidth = stroke.strokeWidthPx
            val path = Path()
            path.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
            for (i in 1 until stroke.points.size) {
                path.lineTo(stroke.points[i].x * width, stroke.points[i].y * height)
            }
            canvas.drawPath(path, strokePaint)
        }

        // Text overlays
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        for (item in texts) {
            textPaint.color = item.colorArgb
            textPaint.textSize = item.sizeSp * (width / 380f)
            canvas.drawText(item.text, item.xFraction * width, item.yFraction * height, textPaint)
        }

        // Border frame
        if (state.borderStyle != "none" && state.borderThickness > 0f) {
            val borderPx = (min(width, height) * (state.borderThickness / 100f) * 0.12f)
            val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = borderPx * 2f
                color = if (state.borderStyle == "black") Color.BLACK else Color.WHITE
            }
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), borderPaint)
        }

        return outBitmap
    }

    /**
     * Saves the finished Bitmap to Pictures/FrameFlow using Android's MediaStore APIs.
     */
    fun saveBitmapToFrameFlowGallery(context: Context, bitmap: Bitmap): Uri? {
        val filename = "FrameFlow_${System.currentTimeMillis()}.jpg"
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_PICTURES}/FrameFlow"
                )
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            ?: return null

        resolver.openOutputStream(uri)?.use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            contentValues.clear()
            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, contentValues, null, null)
        }
        return uri
    }
}
