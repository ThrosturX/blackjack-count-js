# Android Native Wrapper Progress

This file is a resume guide for wrapping the web app in Android via Capacitor.

## Current State

- Web app is available under `src/` and root `index.html` redirects to `src/index.html`.
- `capacitor.config.json` is present and points `webDir` to `src`.
- `package.json` contains helper scripts for Capacitor and Android build tasks.
- Capacitor packages are pinned to `7.x`.
- Android debug build is working with JDK 21 and local Android SDK path.
- Developer shortcuts are available under `scripts/`.
- Launcher profile split support is available through `src/app-profile.js` and `scripts/set_app_profile.sh`.
- Android flavors are wired for split package IDs:
  - `suite` -> `com.antisthenes.bundle`
  - `casino` -> `com.antisthenes.casino`
  - `solitaire` -> `com.antisthenes.solitaire`
- Flavor launcher labels:
  - `suite` -> `Card Bundle`
  - `casino` -> `Antisthenes Casino`
  - `solitaire` -> `Antisthenes Solitaire`
- Shared web entitlement boundary is implemented:
  - `src/shared/entitlements.js` is the canonical local store.
  - `src/shared/entitlement-sync.js` performs startup/resume authoritative sync.
- Native bridge stub is implemented:
  - `android/app/src/main/java/com/antisthenes/bundle/EntitlementBridgePlugin.java`
  - Registered from `MainActivity` as `EntitlementBridge`.

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

Profile-targeted build shortcuts:

```bash
npm run android:suite:build:debug
npm run android:casino:build:debug
npm run android:solitaire:build:debug
```

These commands apply the profile first, then sync and build.

Release bundle shortcuts (for Play Console upload artifacts):

```bash
npm run android:suite:bundle:release
npm run android:casino:bundle:release
npm run android:solitaire:bundle:release
```

## Rapid Prototyping Workflow

- For minor web-only changes in `src/` (CSS/layout/content/JS that does not require device validation), skip Android sync/build and validate in browser/`file://` first.
- Use `npm run cap:sync` when you are ready to test updated web assets on Android.
- Use `npm run profile:<suite|casino|solitaire>` to switch launcher audience before sync/build when validating split app behavior.
- Use `npm run android:build:debug` and install only for Android/device checks, native changes, or when an APK artifact is needed.

Install APK to connected authorized phone:

```bash
npm run android:install:connected
npm run android:casino:install:connected
npm run android:solitaire:install:connected
```

One command full loop (install deps, sync, clean rebuild, deploy):

```bash
npm run android:rebuild:deploy
```

Debug APK outputs:

```text
android/app/build/outputs/apk/suite/debug/app-suite-debug.apk
android/app/build/outputs/apk/casino/debug/app-casino-debug.apk
android/app/build/outputs/apk/solitaire/debug/app-solitaire-debug.apk
```

Release AAB outputs:

```text
android/app/build/outputs/bundle/suiteRelease/app-suite-release.aab
android/app/build/outputs/bundle/casinoRelease/app-casino-release.aab
android/app/build/outputs/bundle/solitaireRelease/app-solitaire-release.aab
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
5. Entitlement sync runs on launch/resume without errors.

## Entitlement Bridge Contract (Next Native Hook)

Implemented native bridge surface:

- `window.Capacitor.Plugins.EntitlementBridge.getAuthoritativeClaims()`

Optional future alternatives still supported by the web sync layer:

- `window.NativeEntitlementBridge.getAuthoritativeClaims()`
- `window.Capacitor.Plugins.PlayEntitlements.getAuthoritativeClaims()`

Payload shape:

```json
{
  "ids": ["default-themes", "premium-effects"],
  "revision": "optional-server-revision",
  "authority": "play-backend",
  "source": "play-billing-backend"
}
```

The payload is applied through:

- `window.EntitlementStore.applyAuthoritativeClaims(ids, options)`

For local debug before native bridge wiring, use:

- `localStorage['bj_table.entitlements.authoritative_mock.v1']`

Example:

```json
{
  "ids": ["default-themes", "premium-effects"],
  "revision": "debug-1"
}
```
