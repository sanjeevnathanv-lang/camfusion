package com.frameflow.app

import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import com.frameflow.app.camera.CameraScreen
import com.frameflow.app.editor.BitmapProcessor
import com.frameflow.app.editor.LookRecipe
import com.frameflow.app.editor.PhotoEditorScreen
import com.frameflow.app.editor.builtInLookRecipes

enum class AppDestination {
    CAMERA,
    REVIEW,
    EDITOR
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            var darkTheme by remember { mutableStateOf(true) }
            val colorScheme = if (darkTheme) darkColorScheme() else lightColorScheme()

            MaterialTheme(colorScheme = colorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FrameFlowRoot(
                        darkTheme = darkTheme,
                        onToggleTheme = { darkTheme = !darkTheme }
                    )
                }
            }
        }
    }
}

@Composable
fun FrameFlowRoot(
    darkTheme: Boolean,
    onToggleTheme: () -> Unit
) {
    val context = LocalContext.current
    var destination by remember { mutableStateOf(AppDestination.CAMERA) }
    var activeBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var activeSourceLabel by remember { mutableStateOf("Camera Capture") }
    var customRecipes by remember { mutableStateOf<List<LookRecipe>>(emptyList()) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            val loaded = BitmapProcessor.loadExifCorrectedBitmap(context, uri)
            if (loaded != null) {
                activeBitmap = loaded
                activeSourceLabel = "Photo Picker"
                destination = AppDestination.EDITOR
            }
        }
    }

    when (destination) {
        AppDestination.CAMERA -> {
            CameraScreen(
                darkTheme = darkTheme,
                onToggleTheme = onToggleTheme,
                onOpenPhotoPicker = {
                    photoPickerLauncher.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                },
                onPhotoCaptured = { bitmap ->
                    activeBitmap = bitmap
                    activeSourceLabel = "Camera Capture"
                    destination = AppDestination.REVIEW
                }
            )
        }

        AppDestination.REVIEW -> {
            val bitmap = activeBitmap
            if (bitmap == null) {
                destination = AppDestination.CAMERA
            } else {
                CapturedPhotoReviewScreen(
                    bitmap = bitmap,
                    onRetake = {
                        destination = AppDestination.CAMERA
                    },
                    onOpenEditor = {
                        destination = AppDestination.EDITOR
                    }
                )
            }
        }

        AppDestination.EDITOR -> {
            val bitmap = activeBitmap
            if (bitmap == null) {
                destination = AppDestination.CAMERA
            } else {
                PhotoEditorScreen(
                    originalBitmap = bitmap,
                    sourceLabel = activeSourceLabel,
                    darkTheme = darkTheme,
                    onToggleTheme = onToggleTheme,
                    builtInRecipes = builtInLookRecipes,
                    customRecipes = customRecipes,
                    onSaveCustomRecipe = { recipe ->
                        customRecipes = customRecipes + recipe
                    },
                    onBackToCamera = {
                        destination = AppDestination.CAMERA
                    },
                    onOpenPhotoPicker = {
                        photoPickerLauncher.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    }
                )
            }
        }
    }
}

@Composable
fun CapturedPhotoReviewScreen(
    bitmap: Bitmap,
    onRetake: () -> Unit,
    onOpenEditor: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Review Capture",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${bitmap.width} × ${bitmap.height} px",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            contentAlignment = Alignment.Center
        ) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Captured photo preview",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onRetake,
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Retake")
            }
            Button(
                onClick = onOpenEditor,
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
            ) {
                Icon(Icons.Default.Edit, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Edit Photo")
            }
        }
    }
}
