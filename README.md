# P.T. for Steam Frame

A fork of [LoreanXavier/pt-pc](https://github.com/LoreanXavier/pt-pc), the native PC port of P.T. (the 2014 PS4 teaser
by Kojima Productions), built as a native ARM64 Linux program for the Steam Frame. It runs standalone on the headset,
flat or in the port's VR mode through SteamVR's OpenXR runtime: no PC, no streaming, no x86 emulation.

The port itself, its game logic, renderer, tools and documentation, is LoreanXavier's work. If it is worth something to
you, support them on Patreon: [patreon.com/loreanxavier](https://patreon.com/loreanxavier). This fork only adds what the
ARM64 and Steam Frame build needs (see [Changes from upstream](#changes-from-upstream)). It follows upstream: this
version is based on upstream 1.0.2.

There is no game data in this repository or in its releases. Every level, model, texture, sound, script and cutscene is
read at run time from your own copy of the PS4 game.

## What you need

- Your own copy of P.T. as a dump folder from your console or a fake PKG made from that dump. The port is tested with
  the US release, CUSA01127. A PlayStation Store PKG cannot be used: it is encrypted for the console that owns it, and
  nothing here decrypts it.
- A Steam Frame.
- An x86-64 Linux PC for one step: unpacking the game files from the PKG. The extraction helper only exists for x86-64.
- For VR: SteamVR on the Frame (it provides the OpenXR runtime).

## Installing on the Steam Frame

### 1. Unpack the game files (on the PC)

1. Download the upstream Linux setup `P.T.PC.Port.Setup-linux` from the
   [upstream Releases page](https://github.com/LoreanXavier/pt-pc/releases). It holds the extraction helper.
2. Download `pt-steamframe-<version>-linux-arm64.tar.gz` from this fork's Releases page and unpack it:

       tar xzf pt-steamframe-<version>-linux-arm64.tar.gz

3. Put the game files next to `pt` with `tools/prepare_game.py` from this repository (Python 3, nothing to install):

       python3 tools/prepare_game.py <your P.T. pkg or dump folder> pt-steamframe-<version>-linux-arm64 \
           --setup <path to P.T.PC.Port.Setup-linux>

   The PKG can have any file name and the target folder may already exist. The script writes only `CUSA01127/`
   (`chunk1.psarc`, `texture.qar`, `pathid_list_ps4.bin`, `source.txt`, about 1.3 GB) into the folder with `pt`, where
   the game finds it by itself. If you have installed the upstream port before, `--extractor
   <install folder>/extractor/PT.PkgExtract` uses that install's helper instead of the setup. A folder that already holds
   the extracted archives is copied as it is.

### 2. Copy the folder to the Frame

Over SSH (enable it on the Frame in Desktop Mode first):

    rsync -av --progress pt-steamframe-<version>-linux-arm64/ <user>@<frame>:~/Games/pt-steamframe/

`prepare_game.py ... --to <user>@<frame>:~/Games/pt-steamframe/` does the same for `CUSA01127/` alone, if you copied the
release some other way. A USB stick or a network share works too. On the Frame the folder should look like:

    ~/Games/pt-steamframe/
      pt
      libopenxr_loader.so.1
      shaders/  fonts/  voice/  licenses/
      CUSA01127/

### 3. Add it to Steam

1. In Desktop Mode, open Steam: Games > Add a Non-Steam Game to My Library, browse to `~/Games/pt-steamframe/pt`.
2. In the game's Properties, turn on **Add to VR Library**. Without it the game does not get SteamVR's runtime and starts
   flat.
3. For VR, put `--vr` in its Launch Options (or set `enabled = 1` under `[vr]` in `pt.ini`, or turn on PC settings >
   Extras > VR mode and restart). Without it the game starts flat.

To check it from a terminal first: `cd ~/Games/pt-steamframe && chmod +x pt && ./pt`.

### 4. First start and `pt.ini`

Start the game once and quit: the first start writes `data/pt.ini` in the game's folder
(`~/Games/pt-steamframe/data/pt.ini`) with every setting at its default, next to the save (`PT_Save_Data.sav`) and the
log (`pt.log`). Since 1.0.2 everything the game writes stays in that `data/` folder; a first start of 1.0.2 copies the
settings and save of older versions from `~/.local/share/pt-port/pt/` into it. Then edit `pt.ini` (in Desktop Mode,
with any text editor, or `nano ~/Games/pt-steamframe/data/pt.ini` in a terminal) while the game is closed:

    [voice]
    ; one part of the game waits for a spoken word, and voice recognition does not work on ARM64 yet (Caveats):
    ; this key stands in for it (the same as PC settings > Sound > "Assign J for the microphone trigger")
    key = "J"

    [vr]
    ; 1 starts in VR every time, the same as --vr in the Launch Options
    enabled = 1
    ; the eye images against SteamVR's recommended size, 0.5 to 2: above 1 sharpens and smooths edges, costs frame rate
    resolution_scale = 1.0
    ; metres up (+) or down (-) for your viewpoint, -0.5 to 0.5; the player in the game stays where they are
    height_offset = 0
    ; how far your tracked head and hands move the view, 0.5 to 2; above 1 the world feels smaller
    world_scale = 1

The rest of `[vr]` (`turn` snap or smooth, `snap_degrees`, `smooth_speed`, `flashlight` on the head or a controller,
`flashlight_hand`) is described in the file and in [docs/vr.md](docs/vr.md). The Extras > VR page of the in-game PC
settings changes the flashlight, turning, Height adjustment and World scale while playing.

The graphics preset is not in `pt.ini` as one value: pick Low or Original (PS4) in the in-game PC settings > Graphics,
with ray tracing off, and raise things while the frame rate holds.

`grep vr: ~/Games/pt-steamframe/data/pt.log` shows what the VR mode did, and why when it fell back to flat;
`vr: eyes drawn at ...` gives the per-eye resolution.

### Translated subtitles (optional)

The subtitles the port added for Turkish, Simplified Chinese, Arabic, Russian, Ukrainian and Czech translate the game's
script, so this fork does not carry them. With a checkout of the upstream repository:

    python3 tools/subtitle_pack.py <upstream pt-pc checkout> ~/Games/pt-steamframe

writes them to `subtitles/` next to `pt`. Without them those languages show the English subtitles; the menus stay
translated. The original's seven languages (English, French, German, Spanish, Italian, Portuguese, Japanese) come from
your game files and need nothing.

## Caveats so far

This is early. Flat and VR both start and play on the Frame, but little more has been checked on the device.

VR
- The VR mode is the upstream port's experimental mode, written against a simulated headset. This fork is, as far as
  I know, the first time it has run on real hardware. Expect rough edges, and read [docs/vr.md](docs/vr.md).
- Image quality is low. Each eye is drawn at SteamVR's recommended size times `resolution_scale`, and the only
  anti-aliasing is the original game's FXAA, so edges shimmer when you move your head. Raising `resolution_scale`
  above 1 (for example 1.3) is the only remedy for now and costs frame rate. There is no temporal anti-aliasing,
  foveated rendering or space warp yet.
- Each eye is a full render with its own shadows, reflections and post-processing, about four times the work of the
  flat game, on a mobile GPU. Ray tracing and the higher presets are not realistic in VR.
- The controllers go through SteamVR's mapping of the Index and Touch bindings; the port has no Steam Frame controller
  profile. The comfort settings (eye height, turn speed, HUD distance) were chosen without tests with people; Height
  adjustment and World scale (step 4) can correct the first two, but are new in upstream 1.0.2 and untested on a headset.
- Cutscenes and the peephole play on a flat virtual screen, by design (docs/vr.md).

Missing on ARM64
- **Voice recognition does not work yet**: no ARM build of whisper's CPU code is shipped, so the game cannot hear the
  word it waits for in one part of the game. Turn on PC settings > Sound > "Assign J for the microphone trigger" (or
  `key = "J"` under `[voice]` in `pt.ini`, step 4) and the J key stands in for it. Upstream says both controller
  triggers count too; whether that works with the headset's controllers in VR is not checked.
- **Enhanced textures do not work**: the Real-ESRGAN tool the port uses only exists for x86-64.
- **No upscalers or frame generation**: FSR, DLSS and XeSS are Windows-only SDKs (also on the upstream Linux build),
  and the VR mode turns them off anyway.

Other
- The update check is off in this fork's builds (upstream's update manifest lists only its own x86-64 releases). Check
  this fork's Releases page by hand.
- Unpacking the PKG needs an x86-64 Linux PC; it cannot be done on the Frame.
- The game needs glibc 2.38 or newer (it is built on Debian 13). Current SteamOS has that.

If something goes wrong, an issue with your `pt.log` (and the `vr:` lines) helps.

## Building from source

The release build is `.github/workflows/steam-frame-release.yml`: GitHub's ARM64 runner, a Debian trixie container,
`cmake -G Ninja -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo -DPT_OPENXR=ON`, then `cmake --build build --target pt`.
Every pushed `v*` tag builds the release archive and attaches it to that tag's release; Run workflow on the Actions
tab builds it as an artifact only.

The same build runs on an x86-64 Linux PC under emulation (slower: the first build takes a while). With podman and
`qemu-user-static` set up for aarch64:

    podman run --rm -it --arch arm64 -v "$PWD":/src:Z docker.io/library/debian:trixie bash
    # inside the container:
    apt-get update && apt-get install -y build-essential cmake ninja-build git ca-certificates glslc libvulkan-dev \
      libx11-dev libxext-dev libxrandr-dev libxrender-dev libxcursor-dev libxi-dev libxfixes-dev libxss-dev libxtst-dev \
      libxkbcommon-dev libwayland-dev wayland-protocols libdecor-0-dev libasound2-dev libpulse-dev libpipewire-0.3-dev \
      libdbus-1-dev libudev-dev libdrm-dev libgbm-dev libegl-dev libgl-dev libgles-dev libusb-1.0-0-dev
    cmake -G Ninja -S /src -B /src/build/linux-arm64 -DCMAKE_BUILD_TYPE=RelWithDebInfo -DPT_OPENXR=ON
    cmake --build /src/build/linux-arm64 --target pt

`file build/linux-arm64/pt` should say `ARM aarch64`. The folder to copy to the Frame is `pt`, `libopenxr_loader.so.1`,
`shaders/*.spv`, `fonts/`, `voice/` and `licenses/` from the build folder.

Windows and x86-64 Linux build as upstream describes: see the
[upstream README](https://github.com/LoreanXavier/pt-pc#building-from-source) and [docs/linux.md](docs/linux.md).

## Changes from upstream

- VR on Linux: `cmake/OpenXR.cmake` builds the Khronos OpenXR loader 1.1.63 from source on Linux, ships it next to `pt`
  as `libopenxr_loader.so.1` (found through the executable's `$ORIGIN` RUNPATH) and fixes the headless test runtime's
  manifest. `-DPT_OPENXR=ON` turns it on; Windows is unchanged.
- No copyrighted material: the added languages' translated subtitles (Czech included) moved out of the source into
  optional packs (`tools/subtitle_pack.py`, `src/engine/core/subtitle_translations.cpp`), the README's gameplay GIF is
  gone, and `assets/pt.ico` stays upstream's earlier plain "P.T." text icon instead of the game's title art.
- `tools/prepare_game.py`: unpacks the game files from a PKG or dump into the folder with `pt`, with the upstream
  extraction helper or Linux setup.
- The GitHub Actions release workflow. Upstream's macOS workflow is kept in the tree but disabled in this repository.

Upstream 1.0.2 has its own ARM64 flush-to-zero path (for Apple silicon) and the Linux Arabic font fix that earlier
versions of this fork carried.

Everything else (the features, the settings, the mods, the Museum, the speedrun timer, the PC controls) is the upstream
port's; its README and docs/ describe them.

## Thanks

P.T. is the work of Kojima Productions and is owned by Konami. Neither this fork nor the upstream port is affiliated
with, endorsed by or connected to either of them. They contain none of their assets and do nothing without your own
copy of the game.

The port is LoreanXavier's ([pt-pc](https://github.com/LoreanXavier/pt-pc)). As they write, the shadPS4 emulator was
their reference for how the original behaves on the PS4.

The port is built on SDL3, Vulkan (volk, VMA), glm, Dear ImGui, stb, Lua 5.1, libogg and libvorbis, whisper.cpp with
OpenAI's Whisper model and the Silero VAD for the voice part, Real-ESRGAN with ncnn for the enhanced textures, the
Khronos OpenXR loader for VR, HarfBuzz on Linux and the Noto fonts for the added languages, and LibOrbisPkg in the
upstream installer's extraction helper. Their notices ship in `licenses/` next to the executable.

## AI Disclosure

Upstream's statement: "AI coding tools were used in developing and debugging this port. My focus has been on matching
the original P.T.: comparing builds with PS4 references, identifying discrepancies, testing gameplay and prioritizing
fixes. The project uses the original game assets from the player's own PS4 copy. Optional enhanced textures use
machine-learning upscaling on existing textures."

This fork's changes (the ARM64 and Steam Frame build, VR on Linux, the release workflow, the tools and this README)
were also made with an AI coding assistant, and tested by hand on a Steam Frame.

## License

The port's own code is under the MIT license (see LICENSE, copyright LoreanXavier); this fork's changes are under the
same license. The third-party pieces listed above keep their own licenses.
