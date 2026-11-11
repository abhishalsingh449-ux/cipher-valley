# Cipher Valley Development Log

## 2026-11-09 — Inspection baseline

- Inspected the checked-out `main` state before editing; working tree was clean.
- Preserved `main` and `Ui-polishing`; started implementation on `codex/final-phase`.
- Playable browser sources are in `ciper valley/`; root `C++/` and `DSA/` contain older, diverging copies.
- Existing browser integrations: C linked list and hash table; C++ player and quest modules.
- Emscripten 6.0.12 is bundled. Its version command works through the SDK Python interpreter; the launcher requires the SDK Python directory on `PATH` in this environment.
- The `Ui-polishing` branch contains an archive, but no inspected artifact is identified as the requested `build02` baseline. Both references remain untouched.
- Original baseline was inspected before edits; implementation is isolated on `codex/final-phase`.

## 2026-11-09 — Native module build setup

- Added a reproducible module build script for the C structures and C++ player/quest systems, plus stack, queue, tree, vending, and C++ NPC/item world modules.
- Added a C++ bridge that exposes the existing polymorphic NPC and Item classes to Emscripten.
- Added a C vending-machine dispenser module and five C behavior cases for the Coffee Crisis quest.
- Built all nine C/C++ WebAssembly modules successfully with the bundled Emscripten SDK. Node smoke checks loaded the modules and validated the dispenser's missing-parameter check and all five behavior cases.
- Expanded the Phaser prototype with campus areas, hostel/lab/library/canteen/shop interiors, player/NPC pixel sprites and walk animation, interactions, DSA stations, NPC/item hooks, a persistent game clock, energy/sleep, and local browser saves.
- Restored progression after reload, including location, time, XP, quest flags, inventory, and native module state. Fixed the HUD XP display to use the restored player total.
- Browser gameplay walkthrough verified fresh hostel start, sleep, interior entry and exit, computer interaction, campus movement, Coffee Crisis completion through the compiled C vending module, quest reward, and saved progression after reload.
- Fixed scene resumption after leaving an interior; confirmed campus movement and interaction work on return.
- Updated README with build, local HTTP serving, controls, architecture, and prototype limitations.
- Follow-up fix: added an always-visible interior **← CAMPUS [ESC]** button and direct Escape return, with a shared guarded exit handler. Verified both button and keyboard routes return the player to campus.
- Added a `game.js` cache-busting query to the HTML script URL so browsers load updated gameplay code during local iteration.
- Fixed the room-exit E input leaking into campus interactions, validated and clamped saved room positions, and aligned the canteen counter with its keeper.
- Added an X shortcut to return to campus from anywhere inside an interior, including the lab, and updated the on-screen control hint.
