---
name: g-generate-assets
description: "Generate platform-specific image assets (icons, splash screens) for React Native iOS and Android from a source image. Use this skill whenever the user wants to update, replace, or generate app icons, adaptive icons, splash screen images, or launcher icons for iOS or Android. Also trigger when the user says things like 'update the foreground icon', 'replace the splash image', 'generate mipmap icons', or provides a new image and wants it resized for all screen densities."
---

# Generate Assets

Generate correctly-sized image assets for React Native iOS and Android platforms from a single source image. Uses macOS `sips` for resizing and format conversion — no extra dependencies needed.

## Usage

Called with arguments: `/g-generate-assets <asset-type> <source-image-path>`
Called without arguments: prompt the user for asset type and source image path.

## Asset Types

### `android-icon-foreground`
Adaptive icon foreground layer. Source should be 1024x1024 with safe zone padding (the outer ~30% may be cropped by different device masks).

| Density  | Size    | Output Path |
|----------|---------|-------------|
| mdpi     | 108x108 | `android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` |
| hdpi     | 162x162 | `android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` |
| xhdpi    | 216x216 | `android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` |
| xxhdpi   | 324x324 | `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` |
| xxxhdpi  | 432x432 | `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` |

### `android-icon-background`
Adaptive icon background layer. Same sizes and density structure as foreground.

| Density  | Size    | Output Path |
|----------|---------|-------------|
| mdpi     | 108x108 | `android/app/src/main/res/mipmap-mdpi/ic_launcher_background.png` |
| hdpi     | 162x162 | `android/app/src/main/res/mipmap-hdpi/ic_launcher_background.png` |
| xhdpi    | 216x216 | `android/app/src/main/res/mipmap-xhdpi/ic_launcher_background.png` |
| xxhdpi   | 324x324 | `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_background.png` |
| xxxhdpi  | 432x432 | `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.png` |

### `android-splash`
Android splash screen logo. Generates both light and dark mode variants (identical images placed in both directories).

| Density  | Size    | Light Output Path | Dark Output Path |
|----------|---------|-------------------|------------------|
| mdpi     | 128x128 | `drawable-mdpi/splashscreen_logo.png` | `drawable-night-mdpi/splashscreen_logo.png` |
| hdpi     | 192x192 | `drawable-hdpi/splashscreen_logo.png` | `drawable-night-hdpi/splashscreen_logo.png` |
| xhdpi    | 256x256 | `drawable-xhdpi/splashscreen_logo.png` | `drawable-night-xhdpi/splashscreen_logo.png` |
| xxhdpi   | 384x384 | `drawable-xxhdpi/splashscreen_logo.png` | `drawable-night-xxhdpi/splashscreen_logo.png` |
| xxxhdpi  | 512x512 | `drawable-xxxhdpi/splashscreen_logo.png` | `drawable-night-xxxhdpi/splashscreen_logo.png` |

All paths are relative to `android/app/src/main/res/`.

### `ios-splash`
iOS splash screen images at 1x/2x/3x for both light and dark mode. Output directory: `ios/<AppName>/Images.xcassets/SplashScreenLogo.imageset/`. Find `<AppName>` with `ls -d ios/*/Images.xcassets`; if there is more than one, ask the user which app to use.

**For square source images** (width == height):

| Scale | Size    | Light File | Dark File |
|-------|---------|------------|-----------|
| 1x    | 341x341 | `image.png` | `dark_image.png` |
| 2x    | 683x683 | `image@2x.png` | `dark_image@2x.png` |
| 3x    | 1024x1024 | `image@3x.png` | `dark_image@3x.png` |

**For non-square source images** (e.g. 1024x1536 portrait):
- 3x = full source resolution (e.g. 1024x1536)
- 2x = scale both dimensions by 2/3 (e.g. 683x1024)
- 1x = scale both dimensions by 1/3 (e.g. 341x512)

Same 6 output files as above.

## How to Execute

### Step 1: Parse arguments
If the user provided arguments (e.g. `/g-generate-assets android-icon-foreground /path/to/image.png`), parse the asset type and source path. Otherwise, ask the user for both.

### Step 2: Verify the source image exists
```bash
sips --getProperty pixelWidth --getProperty pixelHeight "/path/to/source.png"
```
This confirms the file exists and gives you the dimensions (needed for ios-splash non-square logic).

### Step 3: Generate assets
Use `sips` to resize and convert. The command format is:
```bash
sips -z {height} {width} -s format png "{source}" --out "{dest}"
```

**Important:** `sips -z` takes **height before width**. For square assets both values are the same so the order doesn't matter, but for non-square ios-splash images, get the order right.

Run all the resize commands for the chosen asset type per the tables above. All paths are relative to the project root (current working directory).

### Step 4: Print a summary
List every file that was generated with its dimensions, so the user can confirm at a glance. Example:
```
✓ Generated android-icon-foreground:
  mipmap-mdpi/ic_launcher_foreground.png    (108x108)
  mipmap-hdpi/ic_launcher_foreground.png    (162x162)
  mipmap-xhdpi/ic_launcher_foreground.png   (216x216)
  mipmap-xxhdpi/ic_launcher_foreground.png  (324x324)
  mipmap-xxxhdpi/ic_launcher_foreground.png (432x432)
```

### Step 5: Remind the user
After generating, remind them they'll need a clean rebuild (`cd android && ./gradlew clean` or Xcode clean build folder) to see the changes.
