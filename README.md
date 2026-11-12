# Cipher Valley

Cipher Valley is a browser based learning game prototype about C/C++ programming and data structures. Players explore a small campus, enter themed rooms, talk with characters, complete quests, and practice linked lists, hash tables, stacks, queues, and trees.

## Run locally

1. From `ciper valley/`, run `build_all_modules.bat` in a Windows terminal to compile the C and C++ WebAssembly modules. The Emscripten SDK is bundled in that folder.
2. Serve the `ciper valley/` directory over HTTP. For example, with Python installed, open a terminal there and run `python -m http.server 8000`.
3. Open `http://localhost:8000` in a modern browser. WebAssembly modules require HTTP; opening `index.html` directly as a `file://` URL will not work.

Use **WASD** to move, **Shift** to sprint, and **E** to interact with nearby people, doors, and objects. The **hostel bed** advances the clock to morning and restores energy. **I** or the on-screen **ACCESS TAB** button opens the player tab; choose **QUEUE** for typed-code debugging missions. **T** starts tree practice. The on-screen prompts show other context-sensitive controls. Progress saves in the browser's local storage. Add `?newgame=1` to the URL once to clear the current run and start fresh.

From any interior, click **RETURN TO CAMPUS** in the upper-right corner, press **X**, or press **Esc**. You can also walk to the bottom doorway and press **E**. The campus is now a camera-following 1200 × 900 area; use the minimap to find locations.

## Implementation

- Phaser and JavaScript provide the expanded campus, interiors, interactions, access-tab UI, dialogue, minimap, and save system.
- Emscripten builds the C linked list, hash table, stack, queue, tree, and vending-machine modules to WebAssembly.
- C++ modules provide player progression, quest state, and the NPC/item world bridge.
- `DEVELOPMENT_LOG.md` records the final-phase implementation and verification.

## Current prototype limits

The campus and rooms are compact prototype scenes with programmatically drawn pixel art. Progress is stored per browser, not on a server. Some quest interfaces are game-specific exercises rather than a general-purpose C/C++ editor. The project is an educational prototype and has not undergone a formal learner study.
