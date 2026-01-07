# PakFolio - Android App Setup with Capacitor

Complete guide to convert the Pakistan Stock Tax Calculator web app into an Android app.

## Prerequisites

Before starting, ensure you have:

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **Android Studio** - [Download](https://developer.android.com/studio)
3. **JDK 11 or higher** - Included with Android Studio
4. **Git** (optional but recommended)

## Step 1: Initialize Capacitor Project

Open terminal in your project directory and run:

```bash
# Navigate to your project directory
cd C:\Users\MUHAMMAD AHMED\psx-tax-calculator

# Initialize npm (if not already done)
npm init -y

# Install Capacitor core and CLI
npm install @capacitor/core @capacitor/cli

# Initialize Capacitor
npx cap init "PakFolio" "com.pakfolio.taxcalculator" --web-dir="mobile"
```

**Note**: We're using `--web-dir="mobile"` since your mobile HTML files are in the `mobile` folder.

## Step 2: Install Android Platform

```bash
# Add Android platform
npm install @capacitor/android

# Add Android to your project
npx cap add android
```

## Step 3: Configure capacitor.config.json

The file should be created automatically. Edit it to match:

```json
{
  "appId": "com.pakfolio.taxcalculator",
  "appName": "PakFolio",
  "webDir": "mobile",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "buildOptions": {
      "releaseType": "AAB"
    }
  }
}
```

## Step 4: Update package.json

Add these scripts to your `package.json`:

```json
{
  "name": "pakfolio",
  "version": "1.0.0",
  "description": "Pakistan Stock Tax Calculator - Mobile App",
  "scripts": {
    "build": "echo 'No build step needed for static files'",
    "sync": "npx cap sync",
    "open:android": "npx cap open android",
    "run:android": "npx cap run android",
    "build:android": "cd android && ./gradlew assembleRelease",
    "build:aab": "cd android && ./gradlew bundleRelease"
  },
  "keywords": ["pakistan", "stock", "tax", "calculator", "fifo"],
  "author": "PakFolio Team",
  "license": "MIT",
  "dependencies": {
    "@capacitor/android": "^5.5.1",
    "@capacitor/core": "^5.5.1"
  },
  "devDependencies": {
    "@capacitor/cli": "^5.5.1"
  }
}
```

## Step 5: Prepare App Icons and Splash Screen

### App Icon Requirements

Create an app icon (1024x1024 PNG) and place it in:
```
C:\Users\MUHAMMAD AHMED\psx-tax-calculator\resources\icon.png
```

### Generate Android Resources

1. Install Cordova Res (icon/splash generator):

```bash
npm install -g cordova-res
```

2. Create resources folder structure:

```bash
mkdir resources
```

3. Add your icon to `resources/icon.png` (1024x1024 PNG)

4. Generate all icon sizes:

```bash
npx cordova-res android --skip-config --copy
```

## Step 6: Configure Android App Details

### Update AndroidManifest.xml

Location: `android/app/src/main/AndroidManifest.xml`

Add these permissions:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="PakFolio"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="PakFolio"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Update strings.xml

Location: `android/app/src/main/res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">PakFolio</string>
    <string name="title_activity_main">PakFolio</string>
    <string name="package_name">com.pakfolio.taxcalculator</string>
    <string name="custom_url_scheme">com.pakfolio.taxcalculator</string>
</resources>
```

### Update build.gradle (App Module)

Location: `android/app/build.gradle`

Update version info:

```gradle
android {
    namespace "com.pakfolio.taxcalculator"
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.pakfolio.taxcalculator"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Step 7: Sync and Build

### Sync Web Assets to Android

```bash
# Copy web assets and sync
npx cap sync android
```

### Open in Android Studio

```bash
# Open Android project in Android Studio
npx cap open android
```

## Step 8: Test on Emulator/Device

### Option 1: Using Android Studio

1. Open the project in Android Studio (from Step 7)
2. Create/start an Android emulator or connect a physical device
3. Click the green "Run" button

### Option 2: Using Command Line

```bash
# Run on connected device
npx cap run android
```

## Step 9: Build Release APK/AAB

### Generate Signing Key

First, create a keystore for signing your app:

```bash
# Navigate to android/app directory
cd android/app

# Generate keystore (fill in your details)
keytool -genkey -v -keystore pakfolio-release-key.keystore -alias pakfolio-key -keyalg RSA -keysize 2048 -validity 10000

# Move back to root
cd ../..
```

**Save the keystore password securely!**

### Configure Signing

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=pakfolio-key
storeFile=pakfolio-release-key.keystore
```

Update `android/app/build.gradle` to include signing config:

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
    ...

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Build AAB (For Play Store)

```bash
# Build Android App Bundle
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Build APK (For Testing)

```bash
# Build APK
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Step 10: Prepare for Play Store

### App Details Needed

1. **App Name**: PakFolio
2. **Package Name**: com.pakfolio.taxcalculator
3. **Version**: 1.0.0 (versionCode: 1)
4. **Category**: Finance
5. **Content Rating**: Everyone
6. **Privacy Policy URL**: Required (create one)
7. **App Screenshots**: At least 2 screenshots (phone and 7-inch tablet)
8. **Feature Graphic**: 1024 x 500 PNG
9. **App Icon**: 512 x 512 PNG (high-res)

### Create Screenshots

1. Run app on emulator
2. Take screenshots of key screens:
   - Dashboard
   - Portfolio
   - Add Transaction
   - Tax Report

Save to `screenshots/` folder.

## Troubleshooting

### Issue: "SDK location not found"

**Solution**: Create `android/local.properties`:

```properties
sdk.dir=C:\\Users\\MUHAMMAD AHMED\\AppData\\Local\\Android\\Sdk
```

(Adjust path to your Android SDK location)

### Issue: Build fails with Gradle errors

**Solution**: Update Gradle version in `android/gradle/wrapper/gradle-wrapper.properties`:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0-all.zip
```

### Issue: jsPDF not working in Android

**Solution**: Already using CDN in your HTML. Ensure internet permission is granted.

### Issue: localStorage not persisting

**Solution**: This should work by default in Capacitor. If issues occur, consider using Capacitor Preferences plugin:

```bash
npm install @capacitor/preferences
```

## Live Reload for Development

For easier development, use Capacitor's live reload:

```bash
# Install Capacitor live reload
npm install @capacitor/cli --save-dev

# Run with live reload
npx cap run android --livereload --external
```

## Useful Commands Reference

```bash
# Sync web assets to Android
npx cap sync android

# Open Android Studio
npx cap open android

# Run on device
npx cap run android

# Build release AAB
cd android && ./gradlew bundleRelease

# Build release APK
cd android && ./gradlew assembleRelease

# Clean build
cd android && ./gradlew clean

# List connected devices
adb devices
```

## Next Steps After Initial Build

1. **Test thoroughly** on multiple devices
2. **Optimize performance** (minification, compression)
3. **Add analytics** (Google Analytics, Firebase)
4. **Implement crash reporting** (Firebase Crashlytics)
5. **Add deep linking** for sharing tax reports
6. **Consider adding plugins**:
   - `@capacitor/share` - Share tax reports
   - `@capacitor/filesystem` - Save PDFs locally
   - `@capacitor/app` - App state management

## Google Play Console Submission Checklist

- [ ] AAB file built and tested
- [ ] App signed with release key
- [ ] Screenshots prepared (2+ for each device type)
- [ ] Feature graphic created (1024x500)
- [ ] App icon (512x512) uploaded
- [ ] Privacy policy URL added
- [ ] App description written (short & full)
- [ ] Content rating completed
- [ ] Target audience defined
- [ ] Store listing details filled
- [ ] Pricing set (Free/Paid)
- [ ] Distribution countries selected

## Important Notes

1. **Keep your keystore safe**: If you lose it, you can't update your app on Play Store
2. **Version codes must increment**: Each update must have a higher versionCode
3. **Test on multiple devices**: Different screen sizes and Android versions
4. **Follow Material Design**: For better Android UX
5. **Optimize images**: Compress PNGs to reduce app size

## Support & Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Play Console Help](https://support.google.com/googleplay/android-developer)

---

**Generated for**: PakFolio - Pakistan Stock Tax Calculator
**Version**: 1.0.0
**Last Updated**: January 2026
