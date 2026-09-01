# NEU Companion Mobile

## Local preview flow

Use these scripts for the local app preview flow across simulator and physical-device testing:

- `npm run start:local` — local Expo dev server with the local backend target
- `npm run ios:local` — iOS simulator preview
- `npm run android:local` — Android emulator preview
- `npm run preview:device` — Expo tunnel flow for a physical device
- `npm run preview:clear` — clears the dev server cache if the app does not reload cleanly

Environment variables:

- `APP_ENV=local`
- `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`

For a physical-device preview, use the machine IP on the same network instead of localhost:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.12:3000/api npm run preview:device
```

## Native Android launch prerequisites

These steps are only needed for an Android emulator or for launching the app with the native Android tooling. They are not required when using Expo Go.

1. Install Android Studio and, from SDK Manager, install the Android SDK, Android SDK Platform-Tools, and the SDK components required by the Expo SDK version used by this app.
2. Add the SDK tools to your shell environment. The default Linux SDK location is:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Persist these exports in your shell profile, then open a new terminal.

3. Confirm that ADB is available and authorize the device:

```bash
adb version
adb devices
```

Enable USB debugging on a physical Android device and accept its authorization prompt. An emulator must be running before it appears as an available device.

4. Start the native Android preview from `apps/mobile`:

```bash
npm run android:local
```
