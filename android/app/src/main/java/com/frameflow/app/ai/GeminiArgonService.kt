package com.frameflow.app.ai

import android.content.Context
import android.graphics.Bitmap
import com.frameflow.app.editor.PhotoEditState
import com.google.firebase.Firebase
import com.google.firebase.FirebaseApp
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

data class AiEditProposal(
    val title: String,
    val summary: String,
    val proposedState: PhotoEditState
)

@Serializable
data class ArgonEditResponseSchema(
    val summary: String,
    val brightness: Float? = null,
    val exposure: Float? = null,
    val contrast: Float? = null,
    val saturation: Float? = null,
    val warmth: Float? = null,
    val tint: Float? = null,
    val highlights: Float? = null,
    val shadows: Float? = null,
    val sharpness: Float? = null,
    val vignette: Float? = null,
    val straightenDegrees: Float? = null,
    val aspectRatio: String? = null,
    val filterId: String? = null,
    val filterIntensity: Float? = null
)

object GeminiArgonService {
    private const val MODEL_NAME = "gemini-4-argon"

    private val strictJson = Json {
        ignoreUnknownKeys = false
        isLenient = false
    }

    /**
     * Calls Gemini 4 Argon (`gemini-4-argon`) via Firebase AI Logic without embedding any API keys
     * in the APK. Never substitutes another model or fakes AI results if unavailable.
     */
    suspend fun analyzePhotoForEdits(
        context: Context,
        bitmap: Bitmap,
        currentState: PhotoEditState,
        mode: String,
        userPrompt: String
    ): Result<AiEditProposal> {
        return try {
            val apps = FirebaseApp.getApps(context)
            if (apps.isEmpty()) {
                return Result.failure(
                    IllegalStateException(
                        "Gemini 4 Argon ($MODEL_NAME) requires Firebase AI Logic setup: place google-services.json in app/, enable Firebase AI Logic in the Firebase Console, and rebuild. Manual editing and Look Recipes remain fully available."
                    )
                )
            }

            val generativeModel = Firebase.ai(backend = GenerativeBackend.googleAI())
                .generativeModel(
                    modelName = MODEL_NAME,
                    generationConfig = generationConfig {
                        responseMimeType = "application/json"
                    }
                )

            val taskInstruction = when (mode) {
                "auto_enhance" -> "Analyze this photograph's lighting, dynamic range, and color balance. Return structured non-destructive adjustment parameters in JSON."
                "smart_crop" -> "Analyze this photograph's horizon and subject composition. Suggest straightenDegrees (-45..45) and aspectRatio (Free, 1:1, 4:5, 16:9, 3:2) in JSON."
                else -> "Translate the user's photo editing instruction into structured non-destructive adjustment parameters in JSON: \"$userPrompt\""
            }

            val response = generativeModel.generateContent(
                content {
                    image(bitmap)
                    text(
                        """
                        $taskInstruction
                        Return ONLY a JSON object matching ArgonEditResponseSchema with numeric values strictly within bounds:
                        brightness, exposure, contrast, saturation, warmth, tint, highlights, shadows in [-100, 100];
                        sharpness, vignette, filterIntensity in [0, 100];
                        straightenDegrees in [-45, 45].
                        """.trimIndent()
                    )
                }
            )

            val rawText = response.text
                ?: return Result.failure(IllegalStateException("Empty response from $MODEL_NAME"))

            val parsed = strictJson.decodeFromString<ArgonEditResponseSchema>(rawText)
            val validatedState = validateAndMerge(currentState, parsed)

            Result.success(
                AiEditProposal(
                    title = "Gemini 4 Argon (${mode.replace('_', ' ')})",
                    summary = parsed.summary,
                    proposedState = validatedState
                )
            )
        } catch (e: Exception) {
            Result.failure(
                IllegalStateException(
                    "Gemini 4 Argon ($MODEL_NAME) unavailable: ${e.localizedMessage ?: "Verify Firebase AI Logic configuration and model access."}"
                )
            )
        }
    }

    /**
     * Strictly validates every numeric range and allowed enum value before applying to PhotoEditState.
     * Rejects out-of-range or NaN values by throwing IllegalArgumentException.
     */
    fun validateAndMerge(
        base: PhotoEditState,
        schema: ArgonEditResponseSchema
    ): PhotoEditState {
        fun checkSymmetric(name: String, v: Float?): Float? {
            if (v == null) return null
            require(!v.isNaN() && v in -100f..100f) { "$name ($v) is outside valid range [-100, 100]" }
            return v
        }

        fun checkPositive(name: String, v: Float?): Float? {
            if (v == null) return null
            require(!v.isNaN() && v in 0f..100f) { "$name ($v) is outside valid range [0, 100]" }
            return v
        }

        val allowedAspectRatios = setOf("Free", "1:1", "4:5", "16:9", "3:2", "4:3", "9:16")
        val allowedFilters = setOf("none", "portra", "kodachrome", "silver_bw", "cine_teal")

        schema.aspectRatio?.let {
            require(it in allowedAspectRatios) { "Invalid aspectRatio: $it" }
        }
        schema.filterId?.let {
            require(it in allowedFilters) { "Invalid filterId: $it" }
        }
        schema.straightenDegrees?.let {
            require(!it.isNaN() && it in -45f..45f) { "straightenDegrees ($it) outside [-45, 45]" }
        }

        return base.copy(
            brightness = checkSymmetric("brightness", schema.brightness) ?: base.brightness,
            exposure = checkSymmetric("exposure", schema.exposure) ?: base.exposure,
            contrast = checkSymmetric("contrast", schema.contrast) ?: base.contrast,
            saturation = checkSymmetric("saturation", schema.saturation) ?: base.saturation,
            warmth = checkSymmetric("warmth", schema.warmth) ?: base.warmth,
            tint = checkSymmetric("tint", schema.tint) ?: base.tint,
            highlights = checkSymmetric("highlights", schema.highlights) ?: base.highlights,
            shadows = checkSymmetric("shadows", schema.shadows) ?: base.shadows,
            sharpness = checkPositive("sharpness", schema.sharpness) ?: base.sharpness,
            vignette = checkPositive("vignette", schema.vignette) ?: base.vignette,
            straightenDegrees = schema.straightenDegrees ?: base.straightenDegrees,
            aspectRatio = schema.aspectRatio ?: base.aspectRatio,
            filterId = schema.filterId ?: base.filterId,
            filterIntensity = checkPositive("filterIntensity", schema.filterIntensity)
                ?: base.filterIntensity
        )
    }
}
