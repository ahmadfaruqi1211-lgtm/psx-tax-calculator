# PakFolio - Quick Start Guide

## ✅ Setup Complete!

Your Android project has been successfully initialized with Capacitor.

## Project Details

- **App Name**: PakFolio
- **Package ID**: com.pakfolio.taxcalculator
- **Version**: 1.0.0
- **Web Directory**: mobile/

## Available Commands

### Development Commands

```bash
# Sync web assets to Android
npm run sync

# Open Android Studio
npm run open:android

# Run on Android device/emulator
npm run run:android

# Run with live reload (development)
npm run run:android:live
```

### Build Commands

```bash
# Build APK (for testing)
npm run build:apk

# Build AAB (for Play Store)
npm run build:aab

# Clean Android build
npm run clean:android
```

## Next Steps

### 1. Test Your App

```bash
# Open Android Studio
npm run open:android
```

Then:
- Create an Android emulator or connect a physical device
- Click the green "Run" button in Android Studio

### 2. Build Release Version

Before building for release, you need to:

#### Create Signing Key

```bash
cd android/app
keytool -genkey -v -keystore pakfolio-release-key.keystore -alias pakfolio-key -keyalg RSA -keysize 2048 -validity 10000
```

**Important**: Save your keystore password securely!

#### Configure Signing

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=pakfolio-key
storeFile=pakfolio-release-key.keystore
```

Then edit `android/app/build.gradle` to add signing configuration (see CAPACITOR-SETUP.md for details).

#### Build AAB for Play Store

```bash
npm run build:aab
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 3. Customize App Icon

1. Create a 1024x1024 PNG icon
2. Save it as `resources/icon.png`
3. Run:

```bash
npm install -g cordova-res
npx cordova-res android --skip-config --copy
```

### 4. Test on Real Device

```bash
# Check connected devices
adb devices

# Run on device
npm run run:android
```

## Project Structure

```
psx-tax-calculator/
├── mobile/                  # Web app files (source)
│   ├── index.html
│   ├── add-transaction.html
│   ├── portfolio.html
│   ├── css/
│   └── js/
├── android/                 # Android project
│   ├── app/
│   │   ├── src/
│   │   └── build.gradle
│   └── build.gradle
├── capacitor.config.json    # Capacitor configuration
├── package.json            # NPM configuration
└── CAPACITOR-SETUP.md      # Full documentation

```

## Important Files

- **capacitor.config.json** - Main Capacitor configuration
- **android/app/src/main/AndroidManifest.xml** - Android app permissions
- **android/app/src/main/res/values/strings.xml** - App name and strings
- **android/app/build.gradle** - Android build configuration

## Common Issues & Solutions

### Issue: Android Studio can't find SDK

**Solution**: Create `android/local.properties`:

```properties
sdk.dir=C:\\Users\\MUHAMMAD AHMED\\AppData\\Local\\Android\\Sdk
```

### Issue: Web assets not updating

**Solution**: Run sync command:

```bash
npm run sync
```

### Issue: Build fails

**Solution**: Clean and rebuild:

```bash
npm run clean:android
npm run sync
```

Then rebuild in Android Studio.

## Useful Tips

1. **Live Reload**: Use `npm run run:android:live` during development
2. **Keep Synced**: Run `npm run sync` after changing web files
3. **Test Early**: Test on real devices as early as possible
4. **Version Bumps**: Increment versionCode in `android/app/build.gradle` for each release

## Resources

- Full documentation: [CAPACITOR-SETUP.md](CAPACITOR-SETUP.md)
- Capacitor Docs: https://capacitorjs.com/docs
- Android Developer Guide: https://developer.android.com/guide

## Need Help?

Check the troubleshooting section in CAPACITOR-SETUP.md for detailed solutions.

---

**Your app is ready for development! Run `npm run open:android` to get started.**
