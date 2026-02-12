# Android Native Wrapper Progress

This file is a resume guide for wrapping the web app in Android via Capacitor.

## Current State

- Web app is available under `src/` and root `index.html` redirects to `src/index.html`.
- `capacitor.config.json` is present and points `webDir` to `src`.
- `package.json` contains helper scripts for Capacitor and Android build tasks.
- Capacitor packages are pinned to `7.x`.
- Android debug build is working with JDK 21 and local Android SDK path.
- Developer shortcuts are available under `scripts/`.

## Environment

- Preferred JDK: 21
- In this repo, Gradle is pinned via `android/gradle.properties`:
  - `org.gradle.java.home=/usr/lib/jvm/java-21-openjdk`
- Android SDK location is pinned via `android/local.properties`:
  - `sdk.dir=/home/throstur/Android/Sdk`

## Daily Commands

Run from repository root:

```bash
npm run android:doctor
npm run cap:sync
npm run android:build:debug
```

Install APK to connected authorized phone:

```bash
npm run android:install:connected
```

One command full loop (install deps, sync, clean rebuild, deploy):

```bash
npm run android:rebuild:deploy
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## First-Time Machine Requirements

- JDK 21
- Android SDK + command-line tools
- `adb` available on `PATH`
- Device USB debugging enabled (for `adb install`)

## Quick Verification Checklist

1. App launches to the index and opens each game page.
2. No console/module loading errors from local assets.
3. `localStorage` save/restore works after force-close/reopen.
4. Touch interactions feel consistent with mobile browser behavior.
