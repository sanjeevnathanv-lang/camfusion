import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const STAGING_DIR = '/tmp/apk-staging';

const JAVA_HOME = '/tmp/android-build/jdk17';
const JAVAC = `${JAVA_HOME}/bin/javac`;
const KEYTOOL = `${JAVA_HOME}/bin/keytool`;
const BUILD_TOOLS = '/tmp/android-build/android-14';
const AAPT2 = `${BUILD_TOOLS}/aapt2`;
const D8 = `${BUILD_TOOLS}/d8`;
const ZIPALIGN = `${BUILD_TOOLS}/zipalign`;
const APKSIGNER = `${BUILD_TOOLS}/apksigner`;
const ANDROID_JAR = '/tmp/android-build/android-34-ext12/android.jar';

const env = {
  ...process.env,
  JAVA_HOME,
  PATH: `${JAVA_HOME}/bin:${BUILD_TOOLS}:${process.env.PATH}`,
};

function run(cmd, cwd = ROOT_DIR) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, env, stdio: 'inherit' });
}

// 1. Build responsive mobile web bundle with relative base path
run('npx vite build --base=./');

// 2. Prepare clean APK staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(STAGING_DIR, 'src/com/frameflow/app'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'res/values'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'res/drawable'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'assets/www'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'obj'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'gen'), { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// 3. Copy built dist/ into assets/www/ and inline CSS/JS so WebView loads with zero file:// CORS issues
fs.cpSync(path.join(ROOT_DIR, 'dist'), path.join(STAGING_DIR, 'assets/www'), {
  recursive: true,
});

const distAssetsDir = path.join(ROOT_DIR, 'dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  const cssFile = assetFiles.find((f) => f.endsWith('.css'));
  const jsFile = assetFiles.find((f) => f.endsWith('.js'));
  let html = fs.readFileSync(path.join(STAGING_DIR, 'assets/www/index.html'), 'utf-8');
  if (cssFile) {
    const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf-8');
    html = html.replace(
      /<link rel="stylesheet"[^>]*>/,
      () => `<style>${cssContent}</style>`
    );
  }
  if (jsFile) {
    const jsContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
    html = html.replace(
      /<script type="module"[^>]*><\/script>/,
      () => `<script type="module">${jsContent}</script>`
    );
  }
  fs.writeFileSync(path.join(STAGING_DIR, 'assets/www/index.html'), html);
  fs.rmSync(path.join(STAGING_DIR, 'assets/www/assets'), { recursive: true, force: true });
  fs.rmSync(path.join(STAGING_DIR, 'assets/www/FrameFlow.apk'), { force: true });
}

// 4. Write AndroidManifest.xml
fs.writeFileSync(
  path.join(STAGING_DIR, 'AndroidManifest.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.frameflow.app"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="34" />

    <uses-feature android:name="android.hardware.camera.any" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_launcher"
        android:label="@string/app_name"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`
);

// 5. Write resources (strings.xml and vector launcher icon)
fs.writeFileSync(
  path.join(STAGING_DIR, 'res/values/strings.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">FrameFlow</string>
</resources>
`
);

fs.writeFileSync(
  path.join(STAGING_DIR, 'res/drawable/ic_launcher.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#090D16"
        android:pathData="M0,0h108v108h-108z" />
    <path
        android:fillColor="#F59E0B"
        android:pathData="M30,36h10l5,-6h18l5,6h10c4.4,0 8,3.6 8,8v30c0,4.4 -3.6,8 -8,8H30c-4.4,0 -8,-3.6 -8,-8V44c0,-4.4 3.6,-8 8,-8z" />
    <path
        android:fillColor="#090D16"
        android:pathData="M54,45a13,13 0 1,0 0,26a13,13 0 1,0 0,-26z" />
    <path
        android:fillColor="#F59E0B"
        android:pathData="M54,50a8,8 0 1,0 0,16a8,8 0 1,0 0,-16z" />
</vector>
`
);

// 6. Write MainActivity.java with Hardware Camera Permission Bridge, Native Photo Picker, and MediaStore Saver
fs.writeFileSync(
  path.join(STAGING_DIR, 'src/com/frameflow/app/MainActivity.java'),
  `package com.frameflow.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final int REQ_PERMISSIONS = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF090D16);
            getWindow().setNavigationBarColor(0xFF090D16);
        }

        requestCameraAndMediaPermissions();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new FrameFlowNativeBridge(), "FrameFlowNative");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select Photo"), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void requestCameraAndMediaPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                if (Build.VERSION.SDK_INT >= 33) {
                    requestPermissions(
                        new String[] { Manifest.permission.CAMERA, Manifest.permission.READ_MEDIA_IMAGES },
                        REQ_PERMISSIONS
                    );
                } else {
                    requestPermissions(
                        new String[] {
                            Manifest.permission.CAMERA,
                            Manifest.permission.READ_EXTERNAL_STORAGE,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE
                        },
                        REQ_PERMISSIONS
                    );
                }
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[] { data.getData() };
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class FrameFlowNativeBridge {
        @JavascriptInterface
        public boolean isNativeAndroidApk() {
            return true;
        }

        @JavascriptInterface
        public boolean savePhotoToMediaStore(String dataUrl, final String filename) {
            try {
                String cleanBase64 = dataUrl;
                int commaIndex = dataUrl.indexOf(',');
                if (commaIndex != -1) {
                    cleanBase64 = dataUrl.substring(commaIndex + 1);
                }
                byte[] jpegBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(
                        MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/FrameFlow"
                    );
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                }

                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;

                OutputStream out = resolver.openOutputStream(uri);
                if (out != null) {
                    out.write(jpegBytes);
                    out.flush();
                    out.close();
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                }

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(
                            MainActivity.this,
                            "Saved to Pictures/FrameFlow/" + filename,
                            Toast.LENGTH_LONG
                        ).show();
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
`
);

// 7. Compile resources with aapt2
run(`${AAPT2} compile --dir res -o resources.zip`, STAGING_DIR);
run(
  `${AAPT2} link -o frameflow-unaligned.apk -I ${ANDROID_JAR} --manifest AndroidManifest.xml --java gen -A assets resources.zip`,
  STAGING_DIR
);

// 8. Compile Java sources against android.jar (API 34)
run(
  `${JAVAC} -source 8 -target 8 -bootclasspath ${ANDROID_JAR} -classpath ${ANDROID_JAR} -d obj gen/com/frameflow/app/R.java src/com/frameflow/app/MainActivity.java`,
  STAGING_DIR
);

// 9. Convert bytecode to DEX using d8
run(
  `${D8} --lib ${ANDROID_JAR} --output . obj/com/frameflow/app/*.class`,
  STAGING_DIR
);

// 10. Add classes.dex to APK using JDK jar tool and zipalign
run(`${JAVA_HOME}/bin/jar uf frameflow-unaligned.apk classes.dex`, STAGING_DIR);
run(`${ZIPALIGN} -f 4 frameflow-unaligned.apk frameflow-aligned.apk`, STAGING_DIR);

// 11. Generate signing keystore and sign APK (v1 + v2 + v3)
const keystorePath = path.join(STAGING_DIR, 'frameflow-release.keystore');
run(
  `${KEYTOOL} -genkeypair -v -keystore ${keystorePath} -alias frameflow -keyalg RSA -keysize 2048 -validity 10000 -storepass frameflow123 -keypass frameflow123 -dname "CN=FrameFlow, OU=Mobile, O=FrameFlow, L=SanFrancisco, ST=CA, C=US"`,
  STAGING_DIR
);

const finalApkPath = path.join(PUBLIC_DIR, 'FrameFlow.apk');
run(
  `${APKSIGNER} sign --ks ${keystorePath} --ks-key-alias frameflow --ks-pass pass:frameflow123 --key-pass pass:frameflow123 --out ${finalApkPath} frameflow-aligned.apk`,
  STAGING_DIR
);

// 12. Verify signed APK
run(`${APKSIGNER} verify --verbose ${finalApkPath}`, STAGING_DIR);
const stats = fs.statSync(finalApkPath);
console.log(`Successfully built and signed ${finalApkPath} (${(stats.size / 1024).toFixed(1)} KB)`);
