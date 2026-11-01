package com.frameflow.app.editor

import android.graphics.Bitmap
import android.graphics.PointF
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.frameflow.app.ai.AiEditProposal
import com.frameflow.app.ai.GeminiArgonService
import kotlinx.coroutines.launch

enum class EditorSection(val label: String) {
    CROP("Crop"),
    ADJUST("Adjust"),
    FILTERS("Filters"),
    ANNOTATE("Annotate"),
    AI_EDIT("AI Edit")
}

@Composable
fun PhotoEditorScreen(
    originalBitmap: Bitmap,
    sourceLabel: String,
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
    builtInRecipes: List<LookRecipe>,
    customRecipes: List<LookRecipe>,
    onSaveCustomRecipe: (LookRecipe) -> Unit,
    onBackToCamera: () -> Unit,
    onOpenPhotoPicker: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var history by remember { mutableStateOf(listOf(PhotoEditState())) }
    var historyIndex by remember { mutableIntStateOf(0) }
    val currentState = history[historyIndex]

    // Non-destructive AI / Look Recipe preview state (requires explicit user approval)
    var pendingAiProposal by remember { mutableStateOf<AiEditProposal?>(null) }
    val displayedState = pendingAiProposal?.proposedState ?: currentState

    var strokes by remember { mutableStateOf<List<DrawStrokeItem>>(emptyList()) }
    var texts by remember { mutableStateOf<List<TextOverlayItem>>(emptyList()) }
    var isHoldingCompare by remember { mutableStateOf(false) }
    var activeSection by remember { mutableStateOf(EditorSection.ADJUST) }
    var activeAdjustmentKey by remember { mutableStateOf("exposure") }

    var aiPromptText by remember { mutableStateOf("") }
    var aiStatusMessage by remember { mutableStateOf<String?>(null) }
    var isAiLoading by remember { mutableStateOf(false) }
    var newRecipeName by remember { mutableStateOf("") }
    var newOverlayText by remember { mutableStateOf("") }

    val hasUnsavedChanges = historyIndex > 0 || strokes.isNotEmpty() || texts.isNotEmpty()

    val renderedBitmap = remember(originalBitmap, displayedState, strokes, texts, isHoldingCompare) {
        if (isHoldingCompare) {
            originalBitmap
        } else {
            BitmapProcessor.renderEditedBitmap(originalBitmap, displayedState, strokes, texts)
        }
    }

    fun pushState(next: PhotoEditState) {
        val truncated = history.take(historyIndex + 1)
        history = truncated + next
        historyIndex = history.lastIndex
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
    ) {
        // Top Editor Bar: Camera/Open | Undo/Redo/Reset | Unsaved Indicator | Save
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackToCamera) {
                    Icon(Icons.Default.CameraAlt, contentDescription = "Back to Camera")
                }
                Column {
                    Text(
                        text = if (hasUnsavedChanges) "Editing · Unsaved" else "FrameFlow Editor",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = sourceLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { if (historyIndex > 0) historyIndex-- },
                    enabled = historyIndex > 0
                ) {
                    Icon(Icons.Default.Undo, contentDescription = "Undo")
                }
                IconButton(
                    onClick = { if (historyIndex < history.lastIndex) historyIndex++ },
                    enabled = historyIndex < history.lastIndex
                ) {
                    Icon(Icons.Default.Redo, contentDescription = "Redo")
                }
                IconButton(
                    onClick = {
                        pushState(PhotoEditState())
                        strokes = emptyList()
                        texts = emptyList()
                    },
                    enabled = hasUnsavedChanges
                ) {
                    Icon(Icons.Default.RestartAlt, contentDescription = "Reset All")
                }
                Button(
                    onClick = {
                        val uri = BitmapProcessor.saveBitmapToFrameFlowGallery(context, renderedBitmap)
                        if (uri != null) {
                            Toast.makeText(
                                context,
                                "Saved to Pictures/FrameFlow",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                ) {
                    Text("Save")
                }
            }
        }

        // Photo Viewport with Hold-to-Compare
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .pointerInput(Unit) {
                    detectTapGestures(
                        onPress = {
                            isHoldingCompare = true
                            tryAwaitRelease()
                            isHoldingCompare = false
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            Image(
                bitmap = renderedBitmap.asImageBitmap(),
                contentDescription = "Edited photo canvas",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )

            if (isHoldingCompare) {
                Surface(
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(12.dp)
                ) {
                    Text(
                        text = "Original (Before)",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }

        // AI / Look Recipe Approval Bar when a preview is active
        pendingAiProposal?.let { proposal ->
            Surface(
                color = MaterialTheme.colorScheme.secondaryContainer,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Previewing: ${proposal.title}",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = proposal.summary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { pendingAiProposal = null }) {
                            Text("Reject")
                        }
                        Button(
                            onClick = {
                                pushState(proposal.proposedState)
                                pendingAiProposal = null
                            }
                        ) {
                            Text("Apply")
                        }
                    }
                }
            }
        }

        // Active Tool Section Controls
        Surface(
            tonalElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                when (activeSection) {
                    EditorSection.CROP -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            listOf("Free", "1:1", "4:5", "16:9", "3:2").forEach { ratio ->
                                FilterChip(
                                    selected = currentState.aspectRatio == ratio,
                                    onClick = { pushState(currentState.copy(aspectRatio = ratio)) },
                                    label = { Text(ratio) }
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Straighten ${currentState.straightenDegrees.toInt()}°")
                            Slider(
                                value = currentState.straightenDegrees,
                                onValueChange = { deg ->
                                    pushState(currentState.copy(straightenDegrees = deg))
                                },
                                valueRange = -45f..45f,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = {
                                    pushState(
                                        currentState.copy(
                                            rotationQuarterTurns = (currentState.rotationQuarterTurns + 1) % 4
                                        )
                                    )
                                }
                            ) {
                                Icon(Icons.Default.Rotate90DegreesCcw, contentDescription = "Rotate 90")
                            }
                            IconButton(
                                onClick = {
                                    pushState(currentState.copy(flipHorizontal = !currentState.flipHorizontal))
                                }
                            ) {
                                Icon(Icons.Default.Flip, contentDescription = "Flip Horizontal")
                            }
                        }
                    }

                    EditorSection.ADJUST -> {
                        val adjustments = listOf(
                            "exposure" to "Exposure",
                            "brightness" to "Brightness",
                            "contrast" to "Contrast",
                            "saturation" to "Saturation",
                            "warmth" to "Warmth",
                            "tint" to "Tint",
                            "highlights" to "Highlights",
                            "shadows" to "Shadows",
                            "sharpness" to "Sharpness",
                            "vignette" to "Vignette"
                        )
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(adjustments) { (key, label) ->
                                FilterChip(
                                    selected = activeAdjustmentKey == key,
                                    onClick = { activeAdjustmentKey = key },
                                    label = { Text(label) }
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        val isZeroBased = activeAdjustmentKey == "sharpness" || activeAdjustmentKey == "vignette"
                        val currentValue = when (activeAdjustmentKey) {
                            "exposure" -> currentState.exposure
                            "brightness" -> currentState.brightness
                            "contrast" -> currentState.contrast
                            "saturation" -> currentState.saturation
                            "warmth" -> currentState.warmth
                            "tint" -> currentState.tint
                            "highlights" -> currentState.highlights
                            "shadows" -> currentState.shadows
                            "sharpness" -> currentState.sharpness
                            else -> currentState.vignette
                        }
                        Slider(
                            value = currentValue,
                            onValueChange = { v ->
                                val next = when (activeAdjustmentKey) {
                                    "exposure" -> currentState.copy(exposure = v)
                                    "brightness" -> currentState.copy(brightness = v)
                                    "contrast" -> currentState.copy(contrast = v)
                                    "saturation" -> currentState.copy(saturation = v)
                                    "warmth" -> currentState.copy(warmth = v)
                                    "tint" -> currentState.copy(tint = v)
                                    "highlights" -> currentState.copy(highlights = v)
                                    "shadows" -> currentState.copy(shadows = v)
                                    "sharpness" -> currentState.copy(sharpness = v)
                                    else -> currentState.copy(vignette = v)
                                }
                                pushState(next)
                            },
                            valueRange = if (isZeroBased) 0f..100f else -100f..100f
                        )
                    }

                    EditorSection.FILTERS -> {
                        val filters = listOf(
                            "none" to "Original",
                            "portra" to "Portra Warm",
                            "kodachrome" to "Kodachrome 64",
                            "silver_bw" to "Silver B&W",
                            "cine_teal" to "Cine Teal"
                        )
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(filters) { (id, name) ->
                                FilterChip(
                                    selected = currentState.filterId == id,
                                    onClick = { pushState(currentState.copy(filterId = id)) },
                                    label = { Text(name) }
                                )
                            }
                        }
                        if (currentState.filterId != "none") {
                            Spacer(Modifier.height(8.dp))
                            Text("Filter Intensity: ${currentState.filterIntensity.toInt()}%")
                            Slider(
                                value = currentState.filterIntensity,
                                onValueChange = { pushState(currentState.copy(filterIntensity = it)) },
                                valueRange = 0f..100f
                            )
                        }
                    }

                    EditorSection.ANNOTATE -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = newOverlayText,
                                onValueChange = { newOverlayText = it },
                                label = { Text("Add Text Overlay") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            Button(
                                onClick = {
                                    if (newOverlayText.isNotBlank()) {
                                        texts = texts + TextOverlayItem(
                                            id = System.currentTimeMillis().toString(),
                                            text = newOverlayText.trim()
                                        )
                                        newOverlayText = ""
                                    }
                                }
                            ) {
                                Text("Add")
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("none" to "No Border", "white" to "Gallery White", "black" to "Dark Frame").forEach { (id, label) ->
                                FilterChip(
                                    selected = currentState.borderStyle == id,
                                    onClick = {
                                        pushState(
                                            currentState.copy(
                                                borderStyle = id,
                                                borderThickness = if (id == "none") 0f else 25f
                                            )
                                        )
                                    },
                                    label = { Text(label) }
                                )
                            }
                        }
                    }

                    EditorSection.AI_EDIT -> {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    isAiLoading = true
                                    aiStatusMessage = null
                                    scope.launch {
                                        val res = GeminiArgonService.analyzePhotoForEdits(
                                            context = context,
                                            bitmap = originalBitmap,
                                            currentState = currentState,
                                            mode = "auto_enhance",
                                            userPrompt = ""
                                        )
                                        isAiLoading = false
                                        res.onSuccess { proposal ->
                                            pendingAiProposal = proposal
                                        }.onFailure { err ->
                                            aiStatusMessage = err.message
                                        }
                                    }
                                },
                                enabled = !isAiLoading
                            ) {
                                Text("Auto Enhance")
                            }
                            OutlinedButton(
                                onClick = {
                                    isAiLoading = true
                                    aiStatusMessage = null
                                    scope.launch {
                                        val res = GeminiArgonService.analyzePhotoForEdits(
                                            context = context,
                                            bitmap = originalBitmap,
                                            currentState = currentState,
                                            mode = "smart_crop",
                                            userPrompt = ""
                                        )
                                        isAiLoading = false
                                        res.onSuccess { proposal ->
                                            pendingAiProposal = proposal
                                        }.onFailure { err ->
                                            aiStatusMessage = err.message
                                        }
                                    }
                                },
                                enabled = !isAiLoading
                            ) {
                                Text("Smart Crop")
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = aiPromptText,
                                onValueChange = { aiPromptText = it },
                                placeholder = { Text("e.g. make it warmer and brighter") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            Button(
                                onClick = {
                                    if (aiPromptText.isBlank()) return@Button
                                    isAiLoading = true
                                    aiStatusMessage = null
                                    scope.launch {
                                        val res = GeminiArgonService.analyzePhotoForEdits(
                                            context = context,
                                            bitmap = originalBitmap,
                                            currentState = currentState,
                                            mode = "prompt",
                                            userPrompt = aiPromptText
                                        )
                                        isAiLoading = false
                                        res.onSuccess { proposal ->
                                            pendingAiProposal = proposal
                                        }.onFailure { err ->
                                            aiStatusMessage = err.message
                                        }
                                    }
                                },
                                enabled = !isAiLoading && aiPromptText.isNotBlank()
                            ) {
                                Text("Run Argon")
                            }
                        }
                        aiStatusMessage?.let { msg ->
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = msg,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Look Recipes", style = MaterialTheme.typography.labelMedium)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(builtInRecipes + customRecipes) { recipe ->
                                AssistChip(
                                    onClick = {
                                        pendingAiProposal = AiEditProposal(
                                            title = recipe.name,
                                            summary = recipe.description,
                                            proposedState = recipe.state
                                        )
                                    },
                                    label = { Text(recipe.name) }
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Bottom Section Switcher
                NavigationBar {
                    EditorSection.entries.forEach { section ->
                        NavigationBarItem(
                            selected = activeSection == section,
                            onClick = { activeSection = section },
                            icon = {
                                val icon = when (section) {
                                    EditorSection.CROP -> Icons.Default.Crop
                                    EditorSection.ADJUST -> Icons.Default.Tune
                                    EditorSection.FILTERS -> Icons.Default.FilterVintage
                                    EditorSection.ANNOTATE -> Icons.Default.TextFields
                                    EditorSection.AI_EDIT -> Icons.Default.AutoAwesome
                                }
                                Icon(icon, contentDescription = section.label)
                            },
                            label = { Text(section.label) }
                        )
                    }
                }
            }
        }
    }
}
