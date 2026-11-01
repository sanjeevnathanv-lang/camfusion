package com.frameflow.app.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Range
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit

@Composable
fun CameraScreen(
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
    onOpenPhotoPicker: () -> Unit,
    onPhotoCaptured: (Bitmap) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var permissionDeniedOnce by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            permissionDeniedOnce = true
        }
    }

    // CameraX state
    var lensFacing by remember { mutableIntStateOf(CameraSelector.LENS_FACING_BACK) }
    var hasBackCamera by remember { mutableStateOf(true) }
    var hasFrontCamera by remember { mutableStateOf(false) }
    var hardwareError by remember { mutableStateOf<String?>(null) }

    var flashMode by remember { mutableIntStateOf(ImageCapture.FLASH_MODE_OFF) }
    var hasFlashUnit by remember { mutableStateOf(false) }

    var zoomRatio by remember { mutableFloatStateOf(1f) }
    var minZoomRatio by remember { mutableFloatStateOf(1f) }
    var maxZoomRatio by remember { mutableFloatStateOf(4f) }

    var exposureIndex by remember { mutableIntStateOf(0) }
    var exposureRange by remember { mutableStateOf(Range(0, 0)) }
    var exposureSupported by remember { mutableStateOf(false) }

    var focusPoint by remember { mutableStateOf<Offset?>(null) }
    var isCapturing by remember { mutableStateOf(false) }

    var cameraRef by remember { mutableStateOf<Camera?>(null) }
    var imageCaptureRef by remember { mutableStateOf<ImageCapture?>(null) }
    val previewView = remember { PreviewView(context) }

    LaunchedEffect(hasCameraPermission, lensFacing) {
        if (!hasCameraPermission) return@LaunchedEffect
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                hasBackCamera = cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)
                hasFrontCamera = cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)

                if (!hasBackCamera && !hasFrontCamera) {
                    hardwareError =
                        "No physical camera hardware was detected on this Android device or emulator. Use a physical Android phone or open an existing photo from your library."
                    return@addListener
                }

                val resolvedLens = when {
                    lensFacing == CameraSelector.LENS_FACING_BACK && hasBackCamera ->
                        CameraSelector.LENS_FACING_BACK
                    lensFacing == CameraSelector.LENS_FACING_FRONT && hasFrontCamera ->
                        CameraSelector.LENS_FACING_FRONT
                    hasBackCamera -> CameraSelector.LENS_FACING_BACK
                    else -> CameraSelector.LENS_FACING_FRONT
                }

                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }

                val imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .setFlashMode(flashMode)
                    .build()

                val selector = CameraSelector.Builder()
                    .requireLensFacing(resolvedLens)
                    .build()

                cameraProvider.unbindAll()
                val camera = cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    selector,
                    preview,
                    imageCapture
                )

                cameraRef = camera
                imageCaptureRef = imageCapture
                hardwareError = null

                val info = camera.cameraInfo
                hasFlashUnit = info.hasFlashUnit()
                info.zoomState.value?.let { zs ->
                    minZoomRatio = zs.minZoomRatio
                    maxZoomRatio = zs.maxZoomRatio.coerceAtLeast(1f)
                    zoomRatio = zs.zoomRatio
                }
                val expState = info.exposureState
                exposureSupported = expState.isExposureCompensationSupported
                exposureRange = expState.exposureCompensationRange
                exposureIndex = expState.exposureCompensationIndex
            } catch (e: Exception) {
                hardwareError = "Camera initialization failed: ${e.localizedMessage ?: "Hardware unavailable"}"
            }
        }, ContextCompat.getMainExecutor(context))
    }

    if (!hasCameraPermission) {
        PermissionExplanationView(
            deniedOnce = permissionDeniedOnce,
            onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
            onOpenPhotoPicker = onOpenPhotoPicker
        )
        return
    }

    if (hardwareError != null) {
        HardwareUnavailableView(
            message = hardwareError!!,
            onOpenPhotoPicker = onOpenPhotoPicker
        )
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .systemBarsPadding()
    ) {
        // Real CameraX PreviewView with Tap-to-Focus
        AndroidView(
            factory = { previewView },
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(cameraRef) {
                    detectTapGestures { tapOffset ->
                        focusPoint = tapOffset
                        val cam = cameraRef ?: return@detectTapGestures
                        val factory = previewView.meteringPointFactory
                        val point = factory.createPoint(tapOffset.x, tapOffset.y)
                        val action = FocusMeteringAction.Builder(
                            point,
                            FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
                        )
                            .setAutoCancelDuration(3, TimeUnit.SECONDS)
                            .build()
                        cam.cameraControl.startFocusAndMetering(action)
                    }
                }
        )

        // Tap-to-focus ring indicator
        focusPoint?.let { pt ->
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawCircle(
                    color = Color(0xFFFACC15),
                    radius = 36.dp.toPx(),
                    center = pt,
                    style = Stroke(width = 2.dp.toPx())
                )
            }
        }

        // Top Camera Controls Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "FrameFlow",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (hasFlashUnit) {
                    FilledTonalIconButton(
                        onClick = {
                            flashMode = when (flashMode) {
                                ImageCapture.FLASH_MODE_OFF -> ImageCapture.FLASH_MODE_AUTO
                                ImageCapture.FLASH_MODE_AUTO -> ImageCapture.FLASH_MODE_ON
                                else -> ImageCapture.FLASH_MODE_OFF
                            }
                            imageCaptureRef?.flashMode = flashMode
                        }
                    ) {
                        val icon = when (flashMode) {
                            ImageCapture.FLASH_MODE_ON -> Icons.Default.FlashOn
                            ImageCapture.FLASH_MODE_AUTO -> Icons.Default.FlashAuto
                            else -> Icons.Default.FlashOff
                        }
                        Icon(icon, contentDescription = "Toggle Flash")
                    }
                }

                FilledTonalIconButton(onClick = onToggleTheme) {
                    Icon(
                        if (darkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                        contentDescription = "Toggle Theme"
                    )
                }
            }
        }

        // Bottom Controls: Exposure + Zoom + Shutter + Gallery + Lens Switch
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(Color.Black.copy(alpha = 0.65f))
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Exposure Compensation (EV) slider when supported by hardware
            if (exposureSupported && exposureRange.upper > exposureRange.lower) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Default.Exposure,
                        contentDescription = "Exposure",
                        tint = Color.White
                    )
                    Slider(
                        value = exposureIndex.toFloat(),
                        onValueChange = { newVal ->
                            val idx = newVal.toInt().coerceIn(exposureRange.lower, exposureRange.upper)
                            exposureIndex = idx
                            cameraRef?.cameraControl?.setExposureCompensationIndex(idx)
                        },
                        valueRange = exposureRange.lower.toFloat()..exposureRange.upper.toFloat(),
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "${if (exposureIndex > 0) "+" else ""}$exposureIndex EV",
                        color = Color.White,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }

            // Zoom control when supported
            if (maxZoomRatio > minZoomRatio) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = String.format("%.1fx", zoomRatio),
                        color = Color.White,
                        style = MaterialTheme.typography.labelMedium
                    )
                    Slider(
                        value = zoomRatio,
                        onValueChange = { zr ->
                            zoomRatio = zr.coerceIn(minZoomRatio, maxZoomRatio)
                            cameraRef?.cameraControl?.setZoomRatio(zoomRatio)
                        },
                        valueRange = minZoomRatio..maxZoomRatio,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Primary Camera Action Row: Open Photo | Capture | Switch Camera
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onOpenPhotoPicker,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(48.dp)
                ) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = null, tint = Color.White)
                    Spacer(Modifier.width(8.dp))
                    Text("Open Photo", color = Color.White)
                }

                // Shutter Capture Button
                IconButton(
                    onClick = {
                        val capture = imageCaptureRef ?: return@IconButton
                        if (isCapturing) return@IconButton
                        isCapturing = true
                        capture.takePicture(
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageCapturedCallback() {
                                override fun onCaptureSuccess(image: ImageProxy) {
                                    val bitmap = imageProxyToRotatedBitmap(image)
                                    image.close()
                                    isCapturing = false
                                    if (bitmap != null) {
                                        onPhotoCaptured(bitmap)
                                    }
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    isCapturing = false
                                    hardwareError = "Capture failed: ${exception.localizedMessage}"
                                }
                            }
                        )
                    },
                    modifier = Modifier
                        .size(72.dp)
                        .border(4.dp, Color.White, CircleShape)
                        .padding(6.dp)
                        .background(Color.White, CircleShape)
                ) {
                    Icon(
                        Icons.Default.CameraAlt,
                        contentDescription = "Capture Photo",
                        tint = Color.Black
                    )
                }

                // Switch Front / Rear Camera
                FilledTonalIconButton(
                    onClick = {
                        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                            CameraSelector.LENS_FACING_FRONT
                        } else {
                            CameraSelector.LENS_FACING_BACK
                        }
                    },
                    enabled = hasBackCamera && hasFrontCamera,
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(Icons.Default.Cameraswitch, contentDescription = "Switch Camera")
                }
            }
        }
    }
}

private fun imageProxyToRotatedBitmap(image: ImageProxy): Bitmap? {
    val planeProxy = image.planes.firstOrNull() ?: return null
    val buffer: ByteBuffer = planeProxy.buffer
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    val rawBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val rotationDegrees = image.imageInfo.rotationDegrees
    if (rotationDegrees == 0) return rawBitmap
    val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
    return Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, true)
}

@Composable
private fun PermissionExplanationView(
    deniedOnce: Boolean,
    onRequestPermission: () -> Unit,
    onOpenPhotoPicker: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.CameraAlt,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Camera Access Needed",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = if (deniedOnce) {
                "Camera permission was denied. FrameFlow requires camera access to show a live sensor preview and capture photos directly from your phone. You can still edit existing photos from your library anytime."
            } else {
                "FrameFlow uses your phone's physical camera sensor for live preview, tap-to-focus, exposure control, and high-resolution capture."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onRequestPermission,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text("Grant Camera Permission")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = onOpenPhotoPicker,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text("Open Existing Photo Instead")
        }
    }
}

@Composable
private fun HardwareUnavailableView(
    message: String,
    onOpenPhotoPicker: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.WarningAmber,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Camera Hardware Unavailable",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onOpenPhotoPicker,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text("Open Photo from Gallery")
        }
    }
}
