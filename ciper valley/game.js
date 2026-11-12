

// ==========================================
// C++ PLAYER MODULE
// ==========================================
const SAVE_KEY = "cipher-valley-save-v1";
const INTERIOR_LOCATIONS = ["hostel", "lab", "library", "canteen", "shop"];
const DEFAULT_INTERIOR_POSITIONS = {
    hostel: { x: 400, y: 450 },
    lab: { x: 190, y: 310 },
    library: { x: 500, y: 230 },
    canteen: { x: 400, y: 250 },
    shop: { x: 400, y: 260 }
};

function loadGameState() {
    const defaults = {
        version: 1,
        location: "hostel",
        campusX: 600,
        campusY: 450,
        campusMapVersion: 2,
        gameMinutes: 360,
        gameDay: 1,
        playerXP: 0,
        playerEnergy: 100,
        coins: 50,
        interiorX: 260,
        interiorY: 300,
        interiorPositions: DEFAULT_INTERIOR_POSITIONS,
        questCompleted: false,
        coffeeQuestAccepted: false,
        coffeeQuestCompleted: false,
        notebookQuestAccepted: false,
        notebookQuestCompleted: false,
        treeChallengeCompleted: false,
        labPracticeCompleted: {},
        debugQuestCompleted: {},
        mentorIntroSeen: false,
        activeDebugQuestId: null,
        inventory: {},
        actionHistory: [],
        taskQueue: [],
        storyStep: 0
    };
    const startFresh = new URLSearchParams(globalThis.location?.search || "").has("newgame");
    if (startFresh) {
        globalThis.history?.replaceState({}, "", globalThis.location.pathname);
        return defaults;
    }
    try {
        const saved = JSON.parse(globalThis.localStorage?.getItem(SAVE_KEY) || "null");
        if (!saved || saved.version !== 1) return defaults;
        const location = saved.location === "campus" || INTERIOR_LOCATIONS.includes(saved.location)
            ? saved.location : "campus";
        const savedMapVersion = Number(saved.campusMapVersion) || 1;
        const oldCampusX = Number.isFinite(Number(saved.campusX)) ? Number(saved.campusX) : 400;
        const oldCampusY = Number.isFinite(Number(saved.campusY)) ? Number(saved.campusY) : 300;
        const campusX = Phaser.Math.Clamp(savedMapVersion >= 2 ? oldCampusX : oldCampusX * 1.5, 25, 1175);
        const campusY = Phaser.Math.Clamp(savedMapVersion >= 2 ? oldCampusY : oldCampusY * 1.5, 25, 875);
        const interiorPositions = Object.fromEntries(INTERIOR_LOCATIONS.map(room => {
            const fallback = DEFAULT_INTERIOR_POSITIONS[room];
            const position = saved.interiorPositions?.[room];
            const coordinate = (value, min, max, safeValue) => Number.isFinite(Number(value))
                ? Phaser.Math.Clamp(Number(value), min, max)
                : safeValue;
            return [room, {
                x: coordinate(position?.x, 45, 755, fallback.x),
                y: coordinate(position?.y, 65, 525, fallback.y)
            }];
        }));
        if (!saved.interiorPositions && INTERIOR_LOCATIONS.includes(location)) {
            // Old saves shared one coordinate between all rooms. Start the
            // currently open room at its safe, room-specific spawn instead.
            interiorPositions[location] = { ...DEFAULT_INTERIOR_POSITIONS[location] };
        }
        return {
            ...defaults,
            ...saved,
            location,
            campusX,
            campusY,
            campusMapVersion: 2,
            interiorPositions,
            debugQuestCompleted: saved.debugQuestCompleted || {},
            labPracticeCompleted: saved.labPracticeCompleted || {},
            inventory: saved.inventory || {},
            actionHistory: Array.isArray(saved.actionHistory) ? saved.actionHistory : [],
            taskQueue: Array.isArray(saved.taskQueue) ? saved.taskQueue : []
        };
    } catch (error) {
        console.warn("Cipher Valley save could not be loaded:", error);
        return defaults;
    }
}

// ==========================================
// LAUNCH FLOW: NEW GAME OR CONTINUE
// ==========================================

const launchParams = new URLSearchParams(
    globalThis.location?.search || ""
);

let hasValidSave = false;

try {
    const savedData = JSON.parse(
        globalThis.localStorage?.getItem(SAVE_KEY) || "null"
    );

    hasValidSave = savedData?.version === 1;
} catch (error) {
    console.warn("Could not check existing save:", error);
}

const shouldPlayPrologue =
    launchParams.has("newgame") || !hasValidSave;

const gameState = loadGameState();

function persistGameState() {
    // Never write an old save while NEW GAME is restarting the application.
    if (globalThis.window?.__cipherValleyStartingNewGame) return;

    try {
        globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(gameState));
    } catch (error) {
        console.warn("Cipher Valley save could not be written:", error);
    }
}

let activeGameScene = null;
let gameClockTimer = null;
const gameClockListeners = new Set();

function formatGameClock() {
    const minutes = Phaser.Math.Clamp(Number(gameState.gameMinutes) || 0, 0, 1439);
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `DAY ${gameState.gameDay} | ${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function startGameClock() {
    if (gameClockTimer !== null) return;
    gameClockTimer = globalThis.setInterval(() => {
        gameState.gameMinutes = (Number(gameState.gameMinutes) + 1) % 1440;
        if (gameState.gameMinutes === 0) gameState.gameDay = Math.max(1, Number(gameState.gameDay) || 1) + 1;
        gameClockListeners.forEach(listener => listener(formatGameClock()));
        persistGameState();
    }, 2000);
}

if (globalThis.window) {
    ["pagehide", "beforeunload"].forEach(eventName =>
        window.addEventListener(eventName, () => {

            if (window.__cipherValleyStartingNewGame) return;

            if (activeGameScene) activeGameScene.saveProgress();
            else persistGameState();

        })
    );
}

let cppPlayerModule = null;
const cppPlayerReady = Promise.resolve()
    .then(() => {
        if (typeof createPlayerModule !== "function") {
            throw new Error("createPlayerModule is unavailable. Check that C++/player_module.js is loaded before game.js.");
        }
        return createPlayerModule();
    })
    .then((Module) => {
        cppPlayerModule = Module;
        Module.ccall("playerInit", "number", ["string"], ["Cipher Valley Player"]);
        const savedXP = Math.max(0, Number(gameState.playerXP) || 0);
        const savedEnergy = Phaser.Math.Clamp(Number(gameState.playerEnergy ?? 100), 0, 100);
        if (savedXP) Module.ccall("playerAddXP", null, ["number"], [savedXP]);
        if (savedEnergy < 100) Module.ccall("playerUseEnergy", "number", ["number"], [100 - savedEnergy]);
        console.log("C++ Player System Connected!");
        return Module;
    })
    .catch((error) => {
        console.error("Failed to load C++ Player module:", error);
        return null;
    });

// ==========================================
// C LINKED LIST MODULE
// ==========================================

let linkedListModule = null;

let cppQuestModule = null;

// Load the C++ quest module safely so a loading error does not stop Phaser.
const cppQuestReady = Promise.resolve()
    .then(() => {
        if (typeof createQuestModule !== "function") {
            throw new Error("createQuestModule is unavailable. Check the C++ script in index.html.");
        }
        return createQuestModule();
    })
    .then((Module) => {
        cppQuestModule = Module;
        if (gameState.questCompleted) Module.ccall("completeLinkedListQuest", "number", [], []);
        console.log("C++ Quest System Connected!");
        return Module;
    })
    .catch((error) => {
        console.error("Failed to load C++ Quest module:", error);
        return null;
    });

const linkedListReady = createLinked_list()
    .then((Module) => {
        linkedListModule = Module;

        linkedListModule.ccall("clearQuests", null, [], []);
        linkedListModule.ccall("addQuest", "number", ["number", "string"], [1, "Learn Linked List"]);
        if (gameState.questCompleted) linkedListModule.ccall("completeQuest", "number", ["number"], [1]);

        console.log("C Linked List loaded successfully!");
        console.log("Quest registered in C linked list.");

        // Display the initial quest list
        linkedListModule.ccall(
            "displayQuests",
            null,
            [],
            []
        );

        return Module;
    })
    .catch((error) => {
        console.error(
            "Failed to load C Linked List:",
            error
        );

        // Resolve to null so the game can handle the failure gracefully.
        return null;
    });


// ==========================================
// C HASH TABLE INVENTORY MODULE
// ==========================================
let hashTableModule = null;
const hashTableReady = createHash_table()
    .then((Module) => {
        hashTableModule = Module;
        Object.entries(gameState.inventory).forEach(([name, item]) => {
            const quantity = Math.max(0, Number(item?.quantity) || 0);
            if (quantity) Module.ccall("insertItem", null, ["string", "number", "string"], [name, quantity, item.description || ""]);
        });
        console.log("C hash-table inventory loaded successfully!");
        return Module;
    })
    .catch((error) => {
        console.error("Failed to load C hash-table inventory:", error);
        return null;
    });

// ==========================================
// C TREE DSA MODULE (OPTIONAL UNTIL BUILT)
// ==========================================
let treeModule = null;
const treeReady = Promise.resolve().then(() => {
    if (typeof createTreeModule !== "function") {
        console.warn("C Tree module not loaded yet; Tree Training uses the built-in fallback. Build tree_module.js/.wasm to activate the C implementation.");
        return null;
    }
    return createTreeModule();
}).then((Module) => {
    treeModule = Module;
    console.log("C Binary Search Tree module connected!");
    return Module;
}).catch((error) => {
    console.error("C Tree module failed to load; using fallback:", error);
    return null;
});

let vendingModule = null;
const vendingReady = Promise.resolve().then(() => {
    if (typeof createVendingModule !== "function") throw new Error("C vending-machine module is unavailable.");
    return createVendingModule();
}).then(Module => {
    vendingModule = Module;
    console.log("C vending-machine debugging module connected!");
    return Module;
}).catch(error => {
    console.error("C vending-machine module failed to load:", error);
    return null;
});

// ==========================================
// C STACK + C CIRCULAR QUEUE MODULES
// ==========================================
let stackModule = null;
let queueModule = null;
let worldModule = null;

const stackReady = Promise.resolve().then(() => {
    if (typeof createStackModule !== "function") {
        console.warn("C stack module not loaded. Build stack_module.js/.wasm to enable action history.");
        return null;
    }
    return createStackModule();
}).then((Module) => {
    stackModule = Module;
    if (Module) {
        Module.ccall("stackClear", null, [], []);
        [...gameState.actionHistory].reverse().slice(-10).forEach(action => Module.ccall("stackPush", "number", ["string"], [action]));
        console.log("C Stack module connected: action history is active.");
    }
    return Module;
}).catch((error) => {
    console.error("C Stack module failed to load; using in-game fallback:", error);
    return null;
});

const queueReady = Promise.resolve().then(() => {
    if (typeof createQueueModule !== "function") {
        console.warn("C queue module not loaded. Build queue_module.js/.wasm to enable the task queue.");
        return null;
    }
    return createQueueModule();
}).then((Module) => {
    queueModule = Module;
    if (Module) {
        Module.ccall("queueClear", null, [], []);
        gameState.taskQueue.slice(0, 10).forEach(task => Module.ccall("queueAddTask", "number", ["string"], [task]));
        console.log("C circular queue module connected: quest tasks are active.");
    }
    return Module;
}).catch((error) => {
    console.error("C queue module failed to load; using in-game fallback:", error);
    return null;
});

const worldReady = Promise.resolve().then(() => {
    if (typeof createWorldModule !== "function") {
        console.warn("C++ world module not loaded. Build C++/world_module.js/.wasm to enable C++ Item/NPC classes.");
        return null;
    }
    return createWorldModule();
}).then((Module) => {
    worldModule = Module;
    if (Module) {
        Module.ccall("worldInit", null, [], []);
        Object.entries(gameState.inventory).forEach(([name, item]) => {
            const quantity = Math.max(0, Number(item?.quantity) || 0);
            if (quantity) Module.ccall("worldAddItem", "number", ["string", "number", "string"], [name, quantity, item.description || ""]);
        });
        console.log("C++ Item and NPC systems connected!");
    }
    return Module;
}).catch((error) => {
    console.error("C++ Item/NPC module failed to load:", error);
    return null;
});

function createPixelCharacterTexture(scene, key, shirtColor) {
    if (scene.textures.exists(key)) return;
    const frameWidth = 32;
    const frameHeight = 48;
    const texture = scene.textures.createCanvas(key, frameWidth * 4, frameHeight * 4);
    const context = texture.context;
    const drawPixel = (x, y, width, height, color) => {
        context.fillStyle = color;
        context.fillRect(x, y, width, height);
    };
    for (let direction = 0; direction < 4; direction++) {
        for (let frame = 0; frame < 4; frame++) {
            const ox = frame * frameWidth;
            const oy = direction * frameHeight;
            const step = frame === 1 ? -2 : frame === 3 ? 2 : 0;
            drawPixel(ox + 9, oy + 3, 14, 12, "#d9a477");
            drawPixel(ox + 8, oy + 2, 16, 6, "#32231f");
            if (direction === 3) drawPixel(ox + 8, oy + 4, 16, 10, "#32231f");
            if (direction !== 3) {
                drawPixel(ox + 11, oy + 9, 2, 2, "#231b1a");
                drawPixel(ox + 19, oy + 9, 2, 2, "#231b1a");
            }
            drawPixel(ox + 7, oy + 16, 18, 14, shirtColor);
            drawPixel(ox + 4, oy + 17, 4, 11, shirtColor);
            drawPixel(ox + 24, oy + 17, 4, 11, shirtColor);
            drawPixel(ox + 9 + step, oy + 29, 6, 13, "#303d5a");
            drawPixel(ox + 17 - step, oy + 29, 6, 13, "#303d5a");
            drawPixel(ox + 8 + step, oy + 41, 8, 4, "#2a2423");
            drawPixel(ox + 16 - step, oy + 41, 8, 4, "#2a2423");
            if (direction === 1) drawPixel(ox + 7, oy + 3, 4, 12, "#32231f");
            if (direction === 2) drawPixel(ox + 21, oy + 3, 4, 12, "#32231f");
        }
    }
    texture.refresh();
    for (let direction = 0; direction < 4; direction++) {
        for (let frame = 0; frame < 4; frame++) {
            texture.add(`d${direction}f${frame}`, 0, frame * frameWidth, direction * frameHeight, frameWidth, frameHeight);
        }
    }
}

function ensureCharacterAnimations(scene) {
    const directions = ["down", "left", "right", "up"];
    directions.forEach((direction, index) => {
        const key = `player-walk-${direction}`;
        if (!scene.anims.exists(key)) {
            scene.anims.create({
                key,
                frames: [0, 1, 2, 3].map(frame => ({ key: "cv-player", frame: `d${index}f${frame}` })),
                frameRate: 7,
                repeat: -1
            });
        }
    });
}

function updatePlayerAnimation(player, velocityX, velocityY) {
    if (!player?.anims) return;
    if (Math.abs(velocityX) + Math.abs(velocityY) > 1) {
        let direction = "down";
        let index = 0;
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
            direction = velocityX < 0 ? "left" : "right";
            index = velocityX < 0 ? 1 : 2;
        } else if (velocityY < 0) {
            direction = "up";
            index = 3;
        }
        player.lastDirection = index;
        player.anims.play(`player-walk-${direction}`, true);
    } else {
        player.anims.stop();
        player.setFrame(`d${player.lastDirection || 0}f0`);
    }
}

// ==========================================
// BOOT SCENE — CHOOSE THE GAME START
// ==========================================

class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    create() {
        if (shouldPlayPrologue) {
            this.scene.start("PrologueScene");
        } else {
            this.scene.start("GameScene");
        }
    }
}


// ==========================================
// PROLOGUE SCENE — OPENING
// ==========================================

class PrologueScene extends Phaser.Scene {
    constructor() {
        super("PrologueScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#101820");

        this.add.text(400, 190, "WELCOME TO", {
            fontSize: "24px",
            color: "#7cffb2",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(400, 260, "CIPHER VALLEY", {
            fontSize: "48px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(400, 340,
            "A new journey into the world of programming begins...",
            {
                fontSize: "17px",
                color: "#d0d8df",
                align: "center"
            }
        ).setOrigin(0.5);

        const continueText = this.add.text(
            400, 470, "PRESS ENTER TO CONTINUE", {
                fontSize: "18px",
                color: "#7cffb2",
                fontStyle: "bold"
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: continueText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.input.keyboard.once("keydown-ENTER", () => {
            this.scene.start("GameScene");
        });

        this.input.keyboard.once("keydown-SPACE", () => {
            this.scene.start("GameScene");
        });
    }
}

class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");
        this.currentLocation = "campus";

        // GAME PROGRESS
        this.dsaOpen = false;
        this.questCompleted = !!gameState.questCompleted;
        this.dsaXP = Math.max(0, Number(gameState.playerXP) || 0);
        this.playerEnergy = Phaser.Math.Clamp(Number(gameState.playerEnergy ?? 100), 0, 100);
        this.playerLevel = 1;
        this.playerTotalXP = this.dsaXP;
        this.nextEnergyTick = 0;
        this.playerStatsText = null;
        this.answerSubmitted = false;
        this.inventoryOpen = false;
        this.inventoryMessage = "";

        // MANDATORY OPENING QUEST: THE COFFEE CRISIS
        this.coffeeQuestAccepted = !!gameState.coffeeQuestAccepted;
        this.coffeeQuestCompleted = !!gameState.coffeeQuestCompleted;
        this.coffeeChallengeOpen = false;
        this.coffeeHintLevel = 0;
        this.coffeeAttempts = 0;
        this.coffeeOverlayElements = [];

        // NOTEBOOK QUEST PROGRESS
        this.notebookQuestAccepted = !!gameState.notebookQuestAccepted;
        this.notebookQuestCompleted = !!gameState.notebookQuestCompleted;
        this.questDialogueOpen = false;
        this.questDialogueObjects = [];
        this.treeChallengeOpen = false;
        this.treeChallengeObjects = [];
        this.treeChallengeCompleted = !!gameState.treeChallengeCompleted;
        this.debugQuestOpen = false;
        this.debugQuestObjects = [];
        this.debugQuestCompleted = { ...gameState.debugQuestCompleted };
        this.debugSubmissionPending = false;
        this.mentorIntroSeen = !!gameState.mentorIntroSeen;
        this.mentorIntroOpen = false;
        this.mentorIntroObjects = [];
        this.debugCodeChallengeOpen = false;

        // C Stack / Queue gameplay state, with a safe fallback if a module is missing.
        this.actionHistoryFallback = [...gameState.actionHistory];
        this.taskQueueFallback = [...gameState.taskQueue];
        this.integrationPanelOpen = false;
        this.integrationPanelObjects = [];
        this.labAssistant = null;
    }


    // ==========================================
    // DSA CHALLENGE
    // ==========================================

    showDSAChallenge() {

        // Prevent opening another challenge while one is active
        if (this.dsaOpen) {
            return;
        }

        this.dsaOpen = true;
        this.answerSubmitted = false;

        // Stop player movement
        this.player.body.setVelocity(0);

        // Hide normal interaction UI
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        // FULL SCREEN BACKGROUND
        this.challengeBox = this.add.rectangle(
            400, 300, 800, 600, 0x111111, 1
        );

        this.challengeBox.setDepth(20);
        this.challengeBox.setScrollFactor(0);

        // TITLE
        this.dsaTitle = this.add.text(
            400, 55,
            "CIPHER VALLEY",
            {
                fontSize: "32px",
                color: "#ffffff",
                fontStyle: "bold"
            }
        );

        this.dsaTitle.setOrigin(0.5);
        this.dsaTitle.setDepth(21);
        this.dsaTitle.setScrollFactor(0);

        // SUBTITLE
        this.dsaSubtitle = this.add.text(
            400, 95,
            "DSA TRAINING — LINKED LIST",
            {
                fontSize: "18px",
                color: "#aaaaaa"
            }
        );

        this.dsaSubtitle.setOrigin(0.5);
        this.dsaSubtitle.setDepth(21);
        this.dsaSubtitle.setScrollFactor(0);

        // QUESTION
        const question = this.questCompleted
            ? "QUEST ALREADY COMPLETED!\n\n" +
              "You learned that the last node's\n" +
              "next pointer contains NULL.\n\n" +
              "Total XP: " + this.dsaXP
            : "A linked list contains:\n\n" +
              "10 → 20 → 30 → NULL\n\n" +
              "What does the next pointer\n" +
              "of node 30 contain?";

        this.questionText = this.add.text(
            400, 190,
            question,
            {
                fontSize: "23px",
                color: "#ffffff",
                align: "center"
            }
        );

        this.questionText.setOrigin(0.5);
        this.questionText.setDepth(21);
        this.questionText.setScrollFactor(0);

        // ANSWER OPTIONS
        this.dsaOptions = [];

        if (!this.questCompleted) {

            this.createOption(220, 380, "A) 10", false);
            this.createOption(580, 380, "B) 20", false);
            this.createOption(220, 460, "C) NULL", true);
            this.createOption(580, 460, "D) 30", false);

        }

        // EXIT BUTTON
        this.exitButton = this.add.text(
            400, 550,
            "EXIT  [E]",
            {
                fontSize: "18px",
                color: "#ffffff",
                backgroundColor: "#333333",
                padding: {
                    x: 20,
                    y: 10
                }
            }
        );

        this.exitButton.setOrigin(0.5);
        this.exitButton.setDepth(21);
        this.exitButton.setScrollFactor(0);
        this.exitButton.setInteractive();

        this.exitButton.on("pointerover", () => {
            this.exitButton.setStyle({
                backgroundColor: "#555555"
            });
        });

        this.exitButton.on("pointerout", () => {
            this.exitButton.setStyle({
                backgroundColor: "#333333"
            });
        });

        this.exitButton.on("pointerdown", () => {
            this.closeDSAChallenge();
        });

        // E KEY FOR EXIT
        this.dsaExitKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );
    }


    // ==========================================
    // CREATE ANSWER OPTION
    // ==========================================

    createOption(x, y, text, correct) {

        const option = this.add.text(
            x, y,
            text,
            {
                fontSize: "23px",
                color: "#ffffff",
                backgroundColor: "#222222",
                padding: {
                    x: 30,
                    y: 14
                }
            }
        );

        option.setOrigin(0.5);
        option.setDepth(21);
        option.setScrollFactor(0);
        option.setInteractive();

        option.correctAnswer = correct;

        // HOVER EFFECT
        option.on("pointerover", () => {

            if (!this.answerSubmitted) {
                option.setStyle({
                    backgroundColor: "#444444"
                });
            }

        });

        option.on("pointerout", () => {

            option.setStyle({
                backgroundColor: "#222222"
            });

        });

        // ANSWER CLICK
        option.on("pointerdown", () => {

            // Ignore further clicks after completion
            if (
                this.answerSubmitted ||
                this.questCompleted
            ) {
                return;
            }

            if (option.correctAnswer) {

                // Lock answers immediately
                this.answerSubmitted = true;

                this.correctDSAAnswer();

            } else {

                this.wrongDSAAnswer();

            }

        });

        this.dsaOptions.push(option);
    }


    // ==========================================
    // CORRECT ANSWER
    // ==========================================

    async correctDSAAnswer() {

        // Prevent duplicate rewards.
        if (this.questCompleted) {
            return;
        }

        // The Player module must be ready before quest modules are mutated.
        const playerModule = await cppPlayerReady;
        if (!playerModule) {
            this.questionText.setText(
                "C++ PLAYER MODULE UNAVAILABLE\n\n" +
                "The linked-list quest has not been completed and no XP was awarded.\n" +
                "Check that player_module.js and player_module.wasm exist and that index.html loads player_module.js before game.js."
            );
            this.answerSubmitted = false;
            return;
        }

        // Wait until the C/WebAssembly module has finished initializing.
        const module = await linkedListReady;

        if (!module) {
            this.questionText.setText(
                "C LINKED-LIST MODULE UNAVAILABLE\n\n" +
                "The quest has not been completed and no XP was awarded.\n" +
                "Please check the browser console, then try again."
            );

            this.answerSubmitted = false;
            return;
        }

        try {
            // Update the actual C linked-list quest before awarding game XP.
            module.ccall(
                "completeQuest",
                null,
                ["number"],
                [1]
            );

            module.ccall(
                "displayQuests",
                null,
                [],
                []
            );

            console.log("C linked-list quest completed successfully!");
        } catch (error) {
            console.error("Failed to complete quest in C linked list:", error);

            this.questionText.setText(
                "QUEST COMPLETION FAILED\n\n" +
                "The C linked-list update failed, so no XP was awarded.\n" +
                "Check the browser console and try again."
            );

            this.answerSubmitted = false;
            return;
        }

// Complete the quest through C++ as well.
        try {
            const cppModule = await cppQuestReady;

            if (!cppModule) {
                this.questionText.setText(
                    "C++ QUEST MODULE UNAVAILABLE\n\n" +
                    "Check that C++/quest_module.js and C++/quest_module.wasm exist, " +
                    "and that index.html loads quest_module.js before game.js."
                );
                this.answerSubmitted = false;
                return;
            }

            const cppComplete = cppModule.ccall(
                "completeLinkedListQuest",
                "number",
                [],
                []
            );

            if (cppComplete !== 1) {
                this.questionText.setText(
                    "C++ QUEST UPDATE FAILED\n\n" +
                    "The C++ module did not confirm a new completion. Check the browser console."
                );
                this.answerSubmitted = false;
                return;
            }
        } catch (error) {
            console.error("Failed to complete quest in C++:", error);
            this.questionText.setText(
                "C++ QUEST UPDATE FAILED\n\n" +
                "Check the browser console and confirm the C++ JavaScript and WASM files are available."
            );
            this.answerSubmitted = false;
            return;
        }

        // Only award XP after both C and C++ succeed.
        this.questCompleted = true;
        this.completeQueuedTask("Complete linked-list challenge");
        this.enqueueGameTask("Ask mentor about notebook");
        this.recordGameAction("Completed linked-list challenge (+10 XP)");
        await this.awardXP(10);

        // Display feedback.
        this.questionText.setText(
            "QUEST COMPLETED!\n\n" +
            "The last node has no next node.\n" +
            "Its next pointer is NULL.\n\n" +
            "+10 XP\n\n" +
            "Total XP: " + this.dsaXP
        );

        // Disable all answer options.
        this.dsaOptions.forEach(option => {
            option.disableInteractive();
            option.setStyle({
                backgroundColor: "#222222"
            });
        });

        // Update HUD.
        this.updateQuestHUD();

        console.log("Quest completed!");
        console.log("Total XP:", this.dsaXP);
    }


    // ==========================================
    // WRONG ANSWER
    // ==========================================

    wrongDSAAnswer() {

        this.questionText.setText(
            "NOT QUITE!\n\n" +
            "Node 30 is the last node.\n\n" +
            "Its next pointer contains NULL.\n\n" +
            "Try another answer."
        );

    }


    // ==========================================
    // C++ PLAYER INTEGRATION
    // ==========================================

    async awardXP(amount) {
        const module = await cppPlayerReady;
        if (!module) {
            console.error("XP reward blocked: C++ Player module is unavailable.");
            return false;
        }
        try {
            module.ccall("playerAddXP", null, ["number"], [amount]);
            this.dsaXP += amount;
            this.syncPlayerStats();
            this.updateQuestHUD();
            return true;
        } catch (error) {
            console.error("Could not award XP through the C++ Player system:", error);
            return false;
        }
    }

    syncPlayerStats() {
        if (!cppPlayerModule) return;
        try {
            this.playerEnergy = cppPlayerModule.ccall("playerGetEnergy", "number", [], []);
            this.playerLevel = cppPlayerModule.ccall("playerGetLevel", "number", [], []);
            this.playerTotalXP = cppPlayerModule.ccall("playerGetXP", "number", [], []);
            this.dsaXP = this.playerTotalXP;
            if (this.playerStatsText) {
                this.playerStatsText.setText(
                    "LEVEL " + this.playerLevel + "   ·   XP " + this.playerTotalXP + "\nENERGY  " + this.playerEnergy + "/100   ·   SHIFT sprint"
                );
            }
        } catch (error) {
            console.error("Could not read C++ Player stats:", error);
        }
    }

    tickPlayerEnergy(now, sprinting, wantsToSprint) {
        if (!cppPlayerModule || now < this.nextEnergyTick) return;

        // Drain while sprinting. Recover only after SHIFT is released; otherwise
        // a player at zero energy could repeatedly regain 1 point and stutter-sprint.
        this.nextEnergyTick = now + (sprinting ? 100 : 125);
        try {
            if (sprinting) {
                const allowed = cppPlayerModule.ccall("playerUseEnergy", "number", ["number"], [1]);
                this.playerEnergy = cppPlayerModule.ccall("playerGetEnergy", "number", [], []);
                if (!allowed) this.playerEnergy = 0;
            } else if (!wantsToSprint) {
                cppPlayerModule.ccall("playerRestoreEnergy", null, ["number"], [1]);
                this.playerEnergy = cppPlayerModule.ccall("playerGetEnergy", "number", [], []);
            } else {
                // SHIFT is still held but energy is empty: stay at normal speed
                // and do not regenerate until the player releases the key.
                this.playerEnergy = cppPlayerModule.ccall("playerGetEnergy", "number", [], []);
            }
            this.syncPlayerStats();
        } catch (error) {
            console.error("C++ Player energy update failed:", error);
        }
    }

    // ==========================================
    // QUEST HUD
    // ==========================================

    updateQuestHUD() {

        if (this.questStatusText) {
            this.questStatusText.setText(
                !this.coffeeQuestCompleted
                    ? "STORY QUEST · COFFEE CRISIS"
                    : this.questCompleted
                        ? "CAMPUS QUESTS · COMPLETE"
                        : "CAMPUS QUESTS · LINKED LIST"
            );
        }
        if (this.coffeeQuestStatusText) {
            this.coffeeQuestStatusText.setText(
                this.coffeeQuestCompleted
                    ? "Coffee Crisis · Complete"
                    : this.coffeeQuestAccepted
                        ? "Next · Repair the vending machine"
                        : "Next · Talk to your friend"
            );
        }

        if (this.xpText) {

            this.xpText.setText("XP  " + this.dsaXP);

        }

        if (this.notebookQuestStatusText) {
            this.notebookQuestStatusText.setText(
                this.notebookQuestCompleted
                    ? "Notebook · Complete"
                    : this.notebookQuestAccepted
                        ? "Notebook · Active"
                        : "Notebook · Locked"
            );
        }

    }


    // ==========================================
    // CLOSE DSA SCREEN
    // ==========================================

    closeDSAChallenge() {

        this.dsaOpen = false;

        // Destroy challenge background
        if (this.challengeBox) {
            this.challengeBox.destroy();
        }

        // Destroy title
        if (this.dsaTitle) {
            this.dsaTitle.destroy();
        }

        // Destroy subtitle
        if (this.dsaSubtitle) {
            this.dsaSubtitle.destroy();
        }

        // Destroy question
        if (this.questionText) {
            this.questionText.destroy();
        }

        // Destroy exit button
        if (this.exitButton) {
            this.exitButton.destroy();
        }

        // Destroy options
        if (this.dsaOptions) {

            this.dsaOptions.forEach(option => {
                option.destroy();
            });

            this.dsaOptions = [];
        }

        // Destroy exit key
        if (this.dsaExitKey) {
            this.dsaExitKey.destroy();
            this.dsaExitKey = null;
        }

        // Hide interaction UI
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        // Refresh quest status
        this.updateQuestHUD();
    }


    // ==========================================
    // C STACK / C QUEUE / C++ WORLD INTEGRATION
    // ==========================================

    recordGameAction(action) {
        if (!action) return;
        this.actionHistoryFallback.unshift(action);
        this.actionHistoryFallback = this.actionHistoryFallback.slice(0, 10);
        if (stackModule) {
            try {
                const count = stackModule.ccall("stackGetCount", "number", [], []);
                if (count >= 10) stackModule.ccall("stackDropOldest", "number", [], []);
                stackModule.ccall("stackPush", "number", ["string"], [action]);
            } catch (error) { console.error("C stack push failed:", error); }
        }
    }

    enqueueGameTask(task) {
        if (!task) return;
        if (!this.taskQueueFallback.includes(task)) {
            this.taskQueueFallback.push(task);
            this.taskQueueFallback = this.taskQueueFallback.slice(0, 10);
            if (queueModule) {
                const added = queueModule.ccall("queueAddTask", "number", ["string"], [task]);
                if (!added) console.warn("C queue is full or rejected task:", task);
            }
        }
    }

    completeQueuedTask(task) {
        if (!task) return false;
        let completed = false;
        try {
            if (queueModule) {
                completed = queueModule.ccall("queueRemoveTask", "number", ["string"], [task]) === 1;
            } else {
                const index = this.taskQueueFallback.indexOf(task);
                if (index >= 0) {
                    this.taskQueueFallback.splice(index, 1);
                    completed = true;
                }
            }
        } catch (error) {
            console.error("C queue task completion failed:", error);
        }
        if (completed && queueModule) {
            const index = this.taskQueueFallback.indexOf(task);
            if (index >= 0) this.taskQueueFallback.splice(index, 1);
        }
        return completed;
    }

    async logCppNpcInteraction(index) {
        this.recordGameAction(index === 0 ? "Talked to Programming Mentor" : index === 1 ? "Talked to Lab Assistant" : "Visited Campus Shop");
        const module = await worldReady;
        if (!module) return;
        try {
            const message = module.ccall("worldNpcMessage", "string", ["number"], [index]);
            if (message) console.log("C++ NPC interaction:", message);
            // Mentor and Shopkeeper already open their own dialogue windows; avoid covering them with a toast.
            if (index === 1 && message && !this.questDialogueOpen) this.showNpcToast(message);
        } catch (error) {
            console.error("C++ NPC interaction failed:", error);
        }
    }

    showNpcToast(message) {
        if (!message || !this.add) return;
        const box = this.add.rectangle(400, 470, 590, 42, 0x10251d, 0.96).setStrokeStyle(1, 0x7cffb2).setDepth(30).setScrollFactor(0);
        const text = this.add.text(400, 470, message, {
            fontSize: "15px", color: "#ffffff", align: "center", wordWrap: { width: 560 }
        }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
        this.time.delayedCall(2600, () => { box.destroy(); text.destroy(); });
    }

    animatePanel(objects) {
        (objects || []).forEach(object => {
            if (!object?.active || !object.setAlpha) return;
            const destinationAlpha = object.alpha;
            object.setAlpha(0);
            this.tweens.add({ targets: object, alpha: destinationAlpha, duration: 170, ease: "Sine.Out" });
        });
    }

    async mirrorWorldItem(name, quantity, description) {
        const module = await worldReady;
        if (!module) return false;
        try {
            return module.ccall("worldAddItem", "number", ["string", "number", "string"], [name, quantity, description]) === 1;
        } catch (error) {
            console.error("C++ Item mirror failed:", error);
            return false;
        }
    }

    async useInventoryItem(name, energyRestore) {
        const inventory = await hashTableReady;
        const world = await worldReady;
        const player = await cppPlayerReady;
        if (!inventory || !world || !player || typeof inventory._decrementItemQuantity !== "function") {
            this.setInventoryMessage("Item use needs the rebuilt C hash-table, C++ world, and Player modules. Run build_all_modules.bat first.");
            return;
        }
        try {
            const hashQuantity = inventory.ccall("searchItemQuantity", "number", ["string"], [name]);
            const worldQuantity = world.ccall("worldGetItemQuantity", "number", ["string"], [name]);
            if (hashQuantity <= 0 || worldQuantity <= 0) {
                this.setInventoryMessage(name + " is not available in both inventory systems.");
                return;
            }
            const used = world.ccall("worldUseItem", "number", ["string"], [name]);
            if (!used) {
                this.setInventoryMessage("The C++ Item class could not use " + name + ".");
                return;
            }
            const decremented = inventory.ccall("decrementItemQuantity", "number", ["string", "number"], [name, 1]);
            if (!decremented) {
                // Restore the C++ quantity if the hash-table rejected the same operation.
                world.ccall("worldAddItem", "number", ["string", "number", "string"], [name, 1, "Restored after inventory sync check."]);
                this.setInventoryMessage("The C hash table could not update the quantity; item use was cancelled.");
                return;
            }
            player.ccall("playerRestoreEnergy", null, ["number"], [energyRestore]);
            this.syncPlayerStats();
            this.recordGameAction("Used " + name + " (restored up to " + energyRestore + " energy)");
            this.setInventoryMessage(name + " used. Player energy restored by up to " + energyRestore + ".");
            await this.refreshInventoryList();
        } catch (error) {
            console.error("Item use failed:", error);
            this.setInventoryMessage("Could not use " + name + ". Check the browser console.");
        }
    }

    async showIntegrationPanel(kind) {
        if (this.integrationPanelOpen) return;
        this.integrationPanelOpen = true;
        this.player.body.setVelocity(0);
        this.integrationPanelObjects = [];
        const add = (obj) => { obj.setDepth(60).setScrollFactor(0); this.integrationPanelObjects.push(obj); return obj; };
        add(this.add.rectangle(400, 300, 800, 600, 0x101820, 0.97));
        const isHistory = kind === "history";
        add(this.add.text(400, 55, isHistory ? "ACTION HISTORY — C STACK" : "PENDING TASKS — C CIRCULAR QUEUE", {
            fontSize: "25px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5));
        let lines = [];
        try {
            if (isHistory && stackModule) {
                const count = stackModule.ccall("stackGetCount", "number", [], []);
                for (let i = 0; i < count; i++) lines.push((i + 1) + ". " + stackModule.ccall("stackGetActionAt", "string", ["number"], [i]));
            } else if (!isHistory && queueModule) {
                const count = queueModule.ccall("queueGetCount", "number", [], []);
                for (let i = 0; i < count; i++) lines.push((i + 1) + ". " + queueModule.ccall("queueGetTaskAt", "string", ["number"], [i]));
            }
        } catch (error) { console.error("Could not read C stack/queue:", error); }
        if (!lines.length) lines = (isHistory ? this.actionHistoryFallback : this.taskQueueFallback).map((line, i) => (i + 1) + ". " + line);
        add(this.add.text(100, 120, lines.length ? lines.join("\n\n") : (isHistory ? "No actions recorded yet." : "No pending tasks."), {
            fontSize: "19px", color: "#d8f4e6", lineSpacing: 7, wordWrap: { width: 600 }
        }));
        add(this.add.text(400, 550, "Press " + (isHistory ? "H" : "Q") + " or ESC to close", {
            fontSize: "16px", color: "#b8c7d9"
        }).setOrigin(0.5));
    }

    closeIntegrationPanel() {
        this.integrationPanelOpen = false;
        this.integrationPanelObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        this.integrationPanelObjects = [];
    }

    async interactWithLabAssistant() {
        const module = await worldReady;
        let message = "The Programming Lab is ready.";
        if (module) {
            try { message = module.ccall("worldNpcMessage", "string", ["number"], [1]); }
            catch (error) { console.error("Lab Assistant message failed:", error); }
        }
        this.recordGameAction("Talked to Lab Assistant");
        this.showQuestDialogue("LAB ASSISTANT", message, [{ label: "Thanks", callback: () => {} }]);
    }

    // ==========================================
    // C HASH TABLE INVENTORY UI
    // Press I to open/close this screen.
    // ==========================================

    async showInventory() {
        if (this.inventoryOpen) return;
        this.inventoryOpen = true;
        this.player.body.setVelocity(0);

        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        this.inventoryObjects = [];
        const add = (obj) => {
            obj.setDepth(40).setScrollFactor(0);
            this.inventoryObjects.push(obj);
            return obj;
        };

        add(this.add.rectangle(400, 300, 800, 600, 0x101820, 0.97));
        add(this.add.rectangle(400, 300, 760, 560, 0x142733, 1).setStrokeStyle(3, 0x5cc7b2));
        add(this.add.text(400, 48, "PERSONAL ACCESS TAB", {
            fontSize: "28px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 82, "PROFILE  ·  QUEST LOG  ·  INVENTORY  ·  DEBUG QUEUE", {
            fontSize: "13px", color: "#9cebd3"
        }).setOrigin(0.5));
        add(this.add.text(65, 120,
            `LEVEL ${this.playerLevel}  ·  XP ${this.playerTotalXP}  ·  ENERGY ${this.playerEnergy}/100  ·  COINS ${gameState.coins}`,
            { fontSize: "14px", color: "#ffe08a", fontStyle: "bold" }));
        add(this.add.rectangle(225, 267, 330, 236, 0x1d3542).setStrokeStyle(1, 0x466976));
        add(this.add.rectangle(575, 267, 330, 236, 0x1d3542).setStrokeStyle(1, 0x466976));
        add(this.add.text(70, 150, "INVENTORY  ·  C HASH TABLE", {
            fontSize: "15px", color: "#9cebd3", fontStyle: "bold"
        }));
        add(this.add.text(425, 150, "QUEST LOG  ·  C++ PLAYER", {
            fontSize: "15px", color: "#9cebd3", fontStyle: "bold"
        }));
        const completedDebugCount = Object.values(this.debugQuestCompleted).filter(Boolean).length;
        const completedDebugNames = this.getDebugQuestCatalog()
            .filter(quest => this.debugQuestCompleted[quest.id])
            .map(quest => quest.title).join(", ") || "None yet";
        const questSummary = [
            `Coffee Crisis  ·  ${this.coffeeQuestCompleted ? "COMPLETE" : this.coffeeQuestAccepted ? "ACTIVE" : "AVAILABLE"}`,
            `Linked List  ·  ${this.questCompleted ? "COMPLETE" : this.coffeeQuestCompleted ? "AVAILABLE" : "LOCKED"}`,
            `Notebook  ·  ${this.notebookQuestCompleted ? "COMPLETE" : this.notebookQuestAccepted ? "ACTIVE" : "LOCKED"}`,
            `Debug missions  ·  ${completedDebugCount}/4 complete`,
            `Debug cleared  ·  ${completedDebugNames}`,
            `Current area  ·  ${String(gameState.location).toUpperCase()}`
        ].join("\n");
        add(this.add.text(425, 178, questSummary, {
            fontSize: "14px", color: "#f1f5f9", lineSpacing: 8,
            wordWrap: { width: 300 }
        }));

        this.inventoryListText = add(this.add.text(70, 178, "Loading C inventory...", {
            fontSize: "14px", color: "#ffffff", lineSpacing: 5,
            wordWrap: { width: 300 }
        }));
        this.inventoryMessageText = add(this.add.text(400, 420, "", {
            fontSize: "17px", color: "#ffe08a", align: "center",
            wordWrap: { width: 650 }
        }).setOrigin(0.5));

        const button = (x, y, label, callback) => {
            const b = add(this.add.text(x, y, label, {
                fontSize: "17px", color: "#ffffff", backgroundColor: "#285943",
                padding: { x: 12, y: 10 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
            b.on("pointerover", () => b.setStyle({ backgroundColor: "#397957" }));
            b.on("pointerout", () => b.setStyle({ backgroundColor: "#285943" }));
            b.on("pointerdown", callback);
        };

        button(105, 500, "Add Coffee +1", () => this.addInventoryItem("Coffee", "Restores energy during campus exploration."));
        button(300, 500, "Add Notebook +1", () => this.addInventoryItem("Notebook", "A notebook for recording DSA clues."));
        button(495, 500, "Search Coffee", () => this.searchInventoryItem("Coffee"));
        button(690, 500, "Use Coffee", () => this.useInventoryItem("Coffee", 20));
        button(200, 450, "Use Energy Drink", () => this.useInventoryItem("Energy Drink", 40));
        button(600, 450, "Use Snack", () => this.useInventoryItem("Snack", 10));
        button(315, 555, "CLOSE  [I / ESC]", () => this.closeInventory());
        button(625, 555, "QUEUE  ›", () => {
            this.closeInventory();
            this.showDebugQuestBoard();
        });

        this.inventoryExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.animatePanel(this.inventoryObjects);
        await this.refreshInventoryList();
    }

    async addInventoryItem(name, description) {
        const module = await hashTableReady;
        if (!module) {
            this.setInventoryMessage("C inventory module is unavailable. Check the console and confirm hash_table.js and hash_table.wasm are present.");
            return;
        }
        try {
            module.ccall("insertItem", null, ["string", "number", "string"], [name, 1, description]);
            await this.mirrorWorldItem(name, 1, description);
            this.recordGameAction("Added " + name + " to inventory");
            this.setInventoryMessage(name + " added to the C hash table and mirrored by the C++ Item class.");
            await this.refreshInventoryList();
        } catch (error) {
            console.error("C hash-table insert failed:", error);
            this.setInventoryMessage("Could not add the item. See the browser console.");
        }
    }

    async searchInventoryItem(name) {
        const module = await hashTableReady;
        if (!module) {
            this.setInventoryMessage("C inventory module is unavailable. Check the console.");
            return;
        }
        try {
            const quantity = module.ccall("searchItemQuantity", "number", ["string"], [name]);
            this.setInventoryMessage(quantity >= 0
                ? name + " found in the C hash table. Quantity: " + quantity
                : name + " was not found in the C hash table.");
        } catch (error) {
            console.error("C hash-table search failed:", error);
            this.setInventoryMessage("Search failed. See the browser console.");
        }
    }

    async refreshInventoryList() {
        if (!this.inventoryOpen || !this.inventoryListText) return;
        const module = await hashTableReady;
        if (!module) {
            this.inventoryListText.setText("Inventory module failed to load.\n\nMake sure hash_table.js and hash_table.wasm are beside index.html.");
            return;
        }
        try {
            const count = module.ccall("getInventoryCount", "number", [], []);
            if (count === 0) {
                this.inventoryListText.setText("Your inventory is empty.\n\nUse the buttons below to add items.");
                return;
            }
            const lines = ["ITEMS IN THE C HASH TABLE", ""];
            for (let i = 0; i < count; i++) {
                const name = module.ccall("getItemNameAt", "string", ["number"], [i]);
                const quantity = module.ccall("getItemQuantityAt", "number", ["number"], [i]);
                const description = module.ccall("getItemDescriptionAt", "string", ["number"], [i]);
                const shortDescription = description.length > 56 ? `${description.slice(0, 53)}…` : description;
                lines.push(`• ${name}  × ${quantity}  —  ${shortDescription}`);
            }
            this.inventoryListText.setText(lines.join("\n"));
        } catch (error) {
            console.error("Could not read C hash-table inventory:", error);
            this.inventoryListText.setText("Could not read inventory. Check the browser console.");
        }
    }

    setInventoryMessage(message) {
        this.inventoryMessage = message;
        if (this.inventoryMessageText) this.inventoryMessageText.setText(message);
    }

    closeInventory() {
        this.inventoryOpen = false;
        if (this.inventoryObjects) {
            this.inventoryObjects.forEach(obj => obj.destroy());
            this.inventoryObjects = [];
        }
        this.inventoryListText = null;
        this.inventoryMessageText = null;
        if (this.inventoryExitKey) {
            this.inventoryExitKey.destroy();
            this.inventoryExitKey = null;
        }
        if (this.interactionBox) this.interactionBox.setVisible(false);
        if (this.interactionText) this.interactionText.setVisible(false);
    }

    // ==========================================
    // NOTEBOOK QUEST + CAMPUS SHOP
    // ==========================================

    showQuestDialogue(title, message, buttons) {
        if (this.questDialogueOpen) return;
        this.questDialogueOpen = true;
        this.player.body.setVelocity(0);
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);
        this.questDialogueObjects = [];

        const add = (obj) => {
            obj.setDepth(60).setScrollFactor(0);
            this.questDialogueObjects.push(obj);
            return obj;
        };

        add(this.add.rectangle(400, 300, 800, 600, 0x081018, 0.78));
        add(this.add.rectangle(400, 300, 590, 330, 0x182b35, 1)
            .setStrokeStyle(3, 0x83c5be));

        add(this.add.text(400, 190, title, {
            fontSize: "25px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 520 }
        }).setOrigin(0.5));

        add(this.add.text(400, 275, message, {
            fontSize: "18px",
            color: "#e8f1f2",
            align: "center",
            lineSpacing: 8,
            wordWrap: { width: 510 }
        }).setOrigin(0.5));

        const buttonCount = buttons.length;
        const positions = buttonCount === 1 ? [400] :
            buttonCount === 2 ? [285, 515] :
            buttons.map((_, i) => 170 + i * (460 / (buttonCount - 1)));

        buttons.forEach((buttonInfo, index) => {
            const button = add(this.add.text(positions[index], 390, buttonInfo.label, {
                fontSize: "17px",
                color: "#ffffff",
                backgroundColor: "#285943",
                padding: { x: 14, y: 11 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }));

            button.on("pointerover", () => {
                button.setStyle({ backgroundColor: "#397957" });
            });
            button.on("pointerout", () => {
                button.setStyle({ backgroundColor: "#285943" });
            });
            button.on("pointerdown", () => {
                this.closeQuestDialogue();
                if (typeof buttonInfo.callback === "function") {
                    buttonInfo.callback();
                }
            });
        });
        this.animatePanel(this.questDialogueObjects);
    }

    closeQuestDialogue() {
        this.questDialogueOpen = false;
        if (this.questDialogueObjects) {
            this.questDialogueObjects.forEach(obj => obj.destroy());
            this.questDialogueObjects = [];
        }
    }

    showNotebookQuestOffer() {
        this.showQuestDialogue(
            "MENTOR: THE MISSING NOTEBOOK",
            "I need a notebook for our next DSA lesson. Visit the campus shop, talk to the Shopkeeper, collect one, then return to me.",
            [
                {
                    label: "Accept Quest",
                    callback: () => {
                        this.notebookQuestAccepted = true;
                        this.completeQueuedTask("Ask mentor about notebook");
                        this.enqueueGameTask("Collect Notebook");
                        this.recordGameAction("Accepted Notebook quest");
                        this.updateQuestHUD();
                        this.showQuestDialogue(
                            "QUEST ACCEPTED",
                            "Enter the campus shop, press E near the counter, and collect a Notebook from the Shopkeeper. Return to the Mentor afterward.",
                            [{ label: "Let's go!", callback: () => {} }]
                        );
                    }
                },
                { label: "Later", callback: () => {} }
            ]
        );
    }

    showMentorIntroduction() {
        if (this.mentorIntroOpen || this.mentorIntroSeen) return;
        this.mentorIntroOpen = true;
        this.player.body.setVelocity(0);
        this.mentorIntroPages = [
            "Welcome to Cipher Valley! You've finally made it here. This place is different from anywhere you've been before.",
            "Cipher Valley is where exploration and programming come together. Discover new locations, meet people, solve problems, and build your programming skills as you travel.",
            "Before entering the valley, you received your personal access tab. Keep it with you: it tracks your profile, progress, quests, and inventory. Open it with I or tap ACCESS TAB on your screen.",
            "When you're ready to test your skills, open the tab and press QUEUE. Choose a debugging mission to read its story, review the code, and start the challenge. Hints are there when you need them.",
            "Don't worry about mistakes. That's how you'll learn. Explore the valley, complete quests, and discover what you're capable of. I'll be here whenever you need guidance. Good luck!"
        ];
        this.mentorIntroPage = 0;
        this.mentorIntroObjects = [];
        const add = object => {
            object.setDepth(70).setScrollFactor(0);
            this.mentorIntroObjects.push(object);
            return object;
        };
        add(this.add.rectangle(400, 466, 760, 220, 0x10202b, 0.97)
            .setStrokeStyle(3, 0x70d6c2));
        add(this.add.rectangle(61, 466, 68, 124, 0x203c49)
            .setStrokeStyle(2, 0xf4d58d));
        add(this.add.sprite(61, 456, "cv-mentor", "d0f0").setDisplaySize(50, 64));
        add(this.add.text(108, 370, "THE MENTOR", {
            fontSize: "14px", color: "#9cebd3", fontStyle: "bold"
        }));
        this.mentorIntroText = add(this.add.text(108, 400, "", {
            fontSize: "17px", color: "#f1f5f9", lineSpacing: 7,
            wordWrap: { width: 620 }
        }));
        this.mentorIntroCounter = add(this.add.text(620, 533, "01 / 05", {
            fontSize: "12px", color: "#b8c7d9"
        }).setOrigin(1, 0.5));
        this.mentorIntroContinue = add(this.add.text(700, 533, "CONTINUE  ›", {
            fontSize: "14px", color: "#10202b", fontStyle: "bold",
            backgroundColor: "#8be0c2", padding: { x: 12, y: 8 }
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }));
        this.mentorIntroContinue.on("pointerdown", () => this.advanceMentorIntroduction());
        this.mentorIntroKeyHandler = event => {
            if (event.code !== "Enter" && event.code !== "Space") return;
            event.preventDefault();
            this.advanceMentorIntroduction();
        };
        globalThis.window?.addEventListener("keydown", this.mentorIntroKeyHandler, true);
        this.animatePanel(this.mentorIntroObjects);
        this.renderMentorIntroPage();
    }

    renderMentorIntroPage() {
        const page = this.mentorIntroPages[this.mentorIntroPage];
        this.mentorIntroText.setText("");
        this.mentorIntroCounter.setText(`${String(this.mentorIntroPage + 1).padStart(2, "0")} / ${String(this.mentorIntroPages.length).padStart(2, "0")}`);
        this.mentorIntroContinue.setText(this.mentorIntroPage === this.mentorIntroPages.length - 1 ? "FINISH  ✓" : "CONTINUE  ›");
        this.mentorIntroTyping = true;
        let index = 0;
        this.mentorIntroTimer?.remove(false);
        this.mentorIntroTimer = this.time.addEvent({
            delay: 17,
            loop: true,
            callback: () => {
                index += 1;
                this.mentorIntroText.setText(page.slice(0, index));
                if (index >= page.length) {
                    this.mentorIntroTimer.remove(false);
                    this.mentorIntroTimer = null;
                    this.mentorIntroTyping = false;
                }
            }
        });
    }

    advanceMentorIntroduction() {
        if (!this.mentorIntroOpen) return;
        if (this.mentorIntroTyping) {
            this.mentorIntroTimer?.remove(false);
            this.mentorIntroTimer = null;
            this.mentorIntroText.setText(this.mentorIntroPages[this.mentorIntroPage]);
            this.mentorIntroTyping = false;
            return;
        }
        if (this.mentorIntroPage < this.mentorIntroPages.length - 1) {
            this.mentorIntroPage += 1;
            this.renderMentorIntroPage();
            return;
        }
        this.mentorIntroOpen = false;
        this.mentorIntroSeen = true;
        gameState.mentorIntroSeen = true;
        this.mentorIndicator?.setText("?");
        this.recordGameAction("Completed Mentor introduction");
        this.mentorIntroTimer?.remove(false);
        globalThis.window?.removeEventListener("keydown", this.mentorIntroKeyHandler, true);
        this.mentorIntroObjects.forEach(object => object.destroy());
        this.mentorIntroObjects = [];
        this.saveProgress();
    }

    async interactWithMentor() {
        if (!this.mentorIntroSeen) {
            this.showMentorIntroduction();
            return;
        }

        // The mentor remains available for short, quest-aware guidance after the introduction.
        if (!this.coffeeQuestCompleted) {
            this.showQuestDialogue(
                "MENTOR · FIELD NOTES",
                "Your first mission is the Coffee Crisis. Talk to your friend, accept the repair task, then inspect the vending machine. Your access tab's QUEUE holds extra debugging missions whenever you want practice.",
                [{ label: "Understood", callback: () => {} }]
            );
            return;
        }

        // The linked-list challenge follows the mandatory opening quest.
        if (!this.questCompleted) {
            this.completeQueuedTask("Meet Programming Mentor");
            this.enqueueGameTask("Complete linked-list challenge");
            this.recordGameAction("Started linked-list challenge");
            this.showDSAChallenge();
            return;
        }

        if (this.notebookQuestCompleted) {
            this.showQuestDialogue(
                "NOTEBOOK QUEST COMPLETED",
                "The mentor has your notebook ready for the next DSA lesson. You earned 20 XP for helping!",
                [{ label: "Close", callback: () => {} }]
            );
            return;
        }

        if (!this.notebookQuestAccepted) {
            this.showNotebookQuestOffer();
            return;
        }

        const module = await hashTableReady;
        if (!module) {
            this.showQuestDialogue(
                "INVENTORY UNAVAILABLE",
                "The C hash-table module could not be loaded. Check the browser console and try again.",
                [{ label: "Close", callback: () => {} }]
            );
            return;
        }

        try {
            const quantity = module.ccall(
                "searchItemQuantity",
                "number",
                ["string"],
                ["Notebook"]
            );

            if (quantity > 0) {
                const playerModule = await cppPlayerReady;
                if (!playerModule) {
                    this.showQuestDialogue(
                        "C++ PLAYER MODULE UNAVAILABLE",
                        "Your Notebook is in the inventory, but the quest has not been completed and no XP was awarded. Check the browser Console and Player module setup.",
                        [{ label: "Close", callback: () => {} }]
                    );
                    return;
                }
                this.notebookQuestCompleted = true;
                this.completeQueuedTask("Return Notebook to Mentor");
                this.recordGameAction("Completed Notebook quest (+20 XP)");
                const xpAwarded = await this.awardXP(20);
                if (!xpAwarded) {
                    this.notebookQuestCompleted = false;
                    this.showQuestDialogue(
                        "XP REWARD FAILED",
                        "The Player module could not record XP. The quest can be retried after checking the Console.",
                        [{ label: "Close", callback: () => {} }]
                    );
                    return;
                }
                this.updateQuestHUD();
                this.showQuestDialogue(
                    "QUEST COMPLETED!",
                    "Notebook found in the C hash-table inventory. The mentor accepts it.\n\n+20 XP\nTotal XP: " + this.dsaXP,
                    [{ label: "Continue", callback: () => {} }]
                );
            } else {
                this.showQuestDialogue(
                    "NOTEBOOK STILL NEEDED",
                    "You haven't collected a Notebook yet. Visit the campus shop and collect one from the Shopkeeper.",
                    [{ label: "Got it", callback: () => {} }]
                );
            }
        } catch (error) {
            console.error("Could not verify Notebook in C inventory:", error);
            this.showQuestDialogue(
                "INVENTORY CHECK FAILED",
                "The game couldn't search the C hash table. Check the browser console for the first error.",
                [{ label: "Close", callback: () => {} }]
            );
        }
    }

    async openCampusShop() {
        const world = await worldReady;
        let greeting = "Riya: I have some useful items for you.";
        if (world) {
            try { greeting = world.ccall("worldNpcMessage", "string", ["number"], [2]); }
            catch (error) { console.error("Could not read C++ Shopkeeper greeting:", error); }
        }
        this.showQuestDialogue(
            "CAMPUS SHOP",
            greeting + "\n\n" + (this.notebookQuestAccepted
                ? "The mentor needs a Notebook. Collect one to complete the quest."
                : "Welcome to the campus shop. You can collect a Notebook here for your DSA notes."),
            [
                {
                    label: "Collect Notebook",
                    callback: async () => {
                        const module = await hashTableReady;
                        if (!module) {
                            this.showQuestDialogue(
                                "SHOP UNAVAILABLE",
                                "The C inventory module could not be loaded. Check the browser console.",
                                [{ label: "Close", callback: () => {} }]
                            );
                            return;
                        }

                        try {
                            const notebookDescription = "A notebook for recording DSA clues.";
                            module.ccall("insertItem", null, ["string", "number", "string"], ["Notebook", 1, notebookDescription]);
                            await this.mirrorWorldItem("Notebook", 1, notebookDescription);
                            this.completeQueuedTask("Collect Notebook");
                            this.enqueueGameTask("Return Notebook to Mentor");
                            this.recordGameAction("Collected Notebook from campus shop");
                            this.showQuestDialogue(
                                "NOTEBOOK COLLECTED",
                                "The Notebook has been stored in the C hash-table inventory. Return to the Mentor and press E.",
                                [{ label: "Continue", callback: () => {} }]
                            );
                        } catch (error) {
                            console.error("Could not add Notebook from campus shop:", error);
                            this.showQuestDialogue(
                                "COLLECTION FAILED",
                                "The Notebook could not be added. Check the browser console.",
                                [{ label: "Close", callback: () => {} }]
                            );
                        }
                    }
                },
                { label: "Leave shop", callback: () => {} }
            ]
        );
    }


    // ==========================================
    // OPENING STORY QUEST: THE COFFEE CRISIS
    // ==========================================

    interactWithFriend() {
        if (this.coffeeQuestCompleted) {
            this.showQuestDialogue(
                "THANKS FOR THE SAVE!",
                "The vending machine is working again. That coffee really helped!",
                [{ label: "Anytime!", callback: () => {} }]
            );
            return;
        }

        if (this.coffeeQuestAccepted) {
            this.showQuestDialogue(
                "YOUR FRIEND",
                "The hostel vending machine broke just before the campus coding festival. The mentor suspects a missing condition, but the error log is scrambled. Inspect its program, follow the clues, and help the team get the campus ready. You can use hints if you need them.",
                [{ label: "On my way", callback: () => {} }]
            );
            return;
        }

        this.showQuestDialogue(
            "THE COFFEE CRISIS",
            "Hey! I could really use a coffee, but the campus vending machine has crashed. It says its dispensing program has a bug. Can you investigate and get it working again?",
            [
                {
                    label: "Accept Quest",
                    callback: () => {
                        this.coffeeQuestAccepted = true;
                        this.enqueueGameTask("Repair vending machine");
                        this.recordGameAction("Accepted Coffee Crisis quest");
                        this.updateQuestHUD();
                        this.showQuestDialogue(
                            "QUEST ACCEPTED: COFFEE CRISIS",
                            "Find the vending machine near the hostel. Inspect the code and replace the missing part. No multiple-choice answers—try the code yourself!",
                            [{ label: "Let's fix it", callback: () => {} }]
                        );
                    }
                },
                { label: "I'll be back", callback: () => {} }
            ]
        );
    }

    interactWithVendingMachine() {
        if (this.coffeeQuestCompleted) {
            this.showQuestDialogue(
                "CAMPUS VENDING MACHINE",
                "STATUS: ONLINE\nCoffee is ready to dispense. Nice debugging!",
                [{ label: "Close", callback: () => {} }]
            );
            return;
        }

        if (!this.coffeeQuestAccepted) {
            this.showQuestDialogue(
                "VENDING MACHINE — ERROR",
                "DISPENSER OFFLINE. A student nearby mentioned needing help. Talk to your friend first to learn what happened.",
                [{ label: "Close", callback: () => {} }]
            );
            return;
        }

        this.showCoffeeCodingChallenge();
    }

    showCoffeeCodingChallenge() {
        if (this.coffeeChallengeOpen || this.coffeeQuestCompleted) return;
        this.coffeeChallengeOpen = true;
        this.player.body.setVelocity(0);

        // Phaser captures movement/action keys to prevent browser defaults.
        // Release them while the HTML code input is active so letters can be typed.
        this.coffeeReleasedKeyCapture = [
            Phaser.Input.Keyboard.KeyCodes.W,
            Phaser.Input.Keyboard.KeyCodes.A,
            Phaser.Input.Keyboard.KeyCodes.S,
            Phaser.Input.Keyboard.KeyCodes.D,
            Phaser.Input.Keyboard.KeyCodes.E,
            Phaser.Input.Keyboard.KeyCodes.I,
            Phaser.Input.Keyboard.KeyCodes.T
        ];
        this.input.keyboard.removeCapture(this.coffeeReleasedKeyCapture);
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);
        this.coffeeOverlayElements = [];

        const add = (obj) => {
            obj.setDepth(80).setScrollFactor(0);
            this.coffeeOverlayElements.push(obj);
            return obj;
        };

        add(this.add.rectangle(400, 300, 800, 600, 0x07111b, 0.97));
        add(this.add.rectangle(400, 300, 700, 520, 0x142733, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 55, "THE COFFEE CRISIS", {
            fontSize: "30px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 95, "VENDING MACHINE DIAGNOSTICS  •  CODE REPAIR", {
            fontSize: "15px", color: "#9fe8c5"
        }).setOrigin(0.5));
        add(this.add.text(90, 130,
            "The machine must only dispense coffee when the requested cups are positive and do not exceed stock.\nReplace ___ with the correct variable, then run the test.", {
                fontSize: "17px", color: "#e8f1f2", lineSpacing: 7,
                wordWrap: { width: 620 }
            }));

        const code = [
            "int dispenseCoffee(int stock, int requested) {",
            "    if (requested > 0 && requested <= ___) {",
            "        return requested;",
            "    }",
            "    return 0;",
            "}"
        ].join("\n");
        this.coffeeCodeText = add(this.add.text(95, 220, code, {
            fontSize: "18px", color: "#d7f9e9", backgroundColor: "#09151d",
            padding: { x: 16, y: 14 }, lineSpacing: 6,
            wordWrap: { width: 600 }
        }));

        add(this.add.text(400, 370,
            "Type the missing variable below. Hint: compare the request with the machine's available amount.", {
                fontSize: "15px", color: "#c5d6de", align: "center",
                wordWrap: { width: 600 }
            }).setOrigin(0.5));

        // Use a small HTML input so the player can genuinely type code without adding a library.
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter missing variable...";
        input.setAttribute("aria-label", "Missing code variable");
        Object.assign(input.style, {
            position: "fixed", left: `${rect.left + rect.width * 0.31}px`,
            top: `${rect.top + rect.height * 0.66}px`, width: `${rect.width * 0.38}px`,
            padding: "12px", fontSize: "18px", boxSizing: "border-box",
            border: "2px solid #57cc99", borderRadius: "6px", zIndex: "9999",
            background: "#f5fff9", color: "#10251c", textAlign: "center"
        });
        document.body.appendChild(input);
        this.coffeeCodeInput = input;

        const status = add(this.add.text(400, 463, "", {
            fontSize: "16px", color: "#ffe08a", align: "center",
            wordWrap: { width: 620 }
        }).setOrigin(0.5));
        this.coffeeCodeStatus = status;

        const makeButton = (x, y, label, callback, width=150) => {
            const b = add(this.add.text(x, y, label, {
                fontSize: "16px", color: "#ffffff", backgroundColor: "#285943",
                padding: { x: 12, y: 10 }, fixedWidth: width, align: "center"
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
            b.on("pointerover", () => b.setStyle({ backgroundColor: "#397957" }));
            b.on("pointerout", () => b.setStyle({ backgroundColor: "#285943" }));
            b.on("pointerdown", callback);
            return b;
        };

        makeButton(240, 505, "RUN CODE", () => this.runCoffeeCode());
        makeButton(400, 505, "HINT", () => this.showCoffeeHint());
        makeButton(560, 505, "EXIT", () => this.closeCoffeeCodingChallenge());
        input.focus();
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") this.runCoffeeCode();
            if (event.key === "Escape") this.closeCoffeeCodingChallenge();
        });
    }

    showCoffeeHint() {
        const hints = [
            "Hint 1: The condition checks requested against a second variable.",
            "Hint 2: The machine has a variable representing the number of cups available.",
            "Hint 3: Use the variable named stock. It is one of the function parameters."
        ];
        this.coffeeCodeStatus.setText(hints[Math.min(this.coffeeHintLevel, hints.length - 1)]);
        this.coffeeHintLevel = Math.min(this.coffeeHintLevel + 1, hints.length - 1);
    }

    async runCoffeeCode() {
        if (!this.coffeeCodeInput || !this.coffeeCodeStatus) return;
        this.coffeeAttempts++;
        const answer = this.coffeeCodeInput.value.trim().replace(/;$/, "");
        const vending = await vendingReady;
        if (!vending) {
            this.coffeeCodeStatus.setText("The C vending-machine module is unavailable. No code was accepted.");
            return;
        }
        const passed = vending.ccall("vendingValidateFix", "number", ["string"], [answer]) === 1;
        if (!passed) {
            this.coffeeCodeStatus.setText(
                "TEST FAILED: The condition still can't compare the request with available stock. Review the hint and try again."
            );
            return;
        }

        const passedTests = vending.ccall("vendingRunTests", "number", [], []);
        this.coffeeCodeStatus.setText(`C TEST PASSED: ${passedTests}/5 dispenser cases passed. Restarting machine...`);
        const playerModule = await cppPlayerReady;
        if (!playerModule) {
            this.coffeeCodeStatus.setText("The C++ Player module is unavailable, so the quest reward was not issued. Check the Console and module script path.");
            return;
        }
        const module = await hashTableReady;
        if (!module) {
            this.coffeeCodeStatus.setText("Code passed, but the C inventory module is unavailable. No reward was issued.");
            return;
        }

        try {
            const existing = module.ccall("searchItemQuantity", "number", ["string"], ["Coffee"]);
            if (existing <= 0) {
                const coffeeDescription = "Fresh coffee collected after repairing the campus vending machine.";
                module.ccall("insertItem", null, ["string", "number", "string"], ["Coffee", 1, coffeeDescription]);
                await this.mirrorWorldItem("Coffee", 1, coffeeDescription);
            }
            const xpAwarded = await this.awardXP(15);
            if (!xpAwarded) {
                this.coffeeCodeStatus.setText("Coffee was added, but the C++ Player could not record XP. Check the Console before retrying.");
                return;
            }
            this.coffeeQuestCompleted = true;
            this.completeQueuedTask("Repair vending machine");
            this.enqueueGameTask("Meet Programming Mentor");
            this.recordGameAction("Completed Coffee Crisis quest (+15 XP)");
            if (this.vendingStatus) {
                this.vendingStatus.setText("ONLINE").setColor("#7dffb3");
            }
            this.updateQuestHUD();
            this.coffeeCodeStatus.setText(`SUCCESS! C tests ${passedTests}/5 passed. Coffee added to the C hash-table inventory. +15 XP.`);
            console.log("Coffee Crisis completed. Attempts:", this.coffeeAttempts, "Hints used:", this.coffeeHintLevel);
            this.time.delayedCall(1600, () => {
                if (this.coffeeChallengeOpen) {
                    this.closeCoffeeCodingChallenge();
                    this.showQuestDialogue(
                        "QUEST COMPLETED: COFFEE CRISIS",
                        `You repaired the vending machine by fixing its stock condition. The compiled C tests passed ${passedTests}/5 cases. Your friend gets coffee, you earned 15 XP, and Coffee is stored in the C hash-table inventory. Next: visit the mentor to begin the linked-list quest.`,
                        [{ label: "Let's go", callback: () => {} }]
                    );
                }
            });
        } catch (error) {
            console.error("Coffee reward/inventory update failed:", error);
            this.coffeeCodeStatus.setText("The code passed, but the inventory update failed. Check the browser console and retry.");
        }
    }

    closeCoffeeCodingChallenge() {
        this.coffeeChallengeOpen = false;

        // Restore normal Phaser key capture after leaving the code input.
        if (this.coffeeReleasedKeyCapture && this.input.keyboard) {
            this.input.keyboard.addCapture(this.coffeeReleasedKeyCapture);
            this.coffeeReleasedKeyCapture = null;
        }
        if (this.coffeeCodeInput) {
            this.coffeeCodeInput.remove();
            this.coffeeCodeInput = null;
        }
        if (this.coffeeOverlayElements) {
            this.coffeeOverlayElements.forEach(obj => obj.destroy());
            this.coffeeOverlayElements = [];
        }
        this.coffeeCodeText = null;
        this.coffeeCodeStatus = null;
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);
        this.updateQuestHUD();
    }

    // ==========================================
    // PRELOAD
    // ==========================================

    preload() {
        createPixelCharacterTexture(this, "cv-player", "#2a9d8f");
        createPixelCharacterTexture(this, "cv-mentor", "#335c9c");
        createPixelCharacterTexture(this, "cv-assistant", "#218c88");
        createPixelCharacterTexture(this, "cv-shopkeeper", "#d99025");
        createPixelCharacterTexture(this, "cv-friend", "#9954a9");
    }


    // ==========================================
    // CREATE
    // ==========================================

    create() {
        ensureCharacterAnimations(this);
        const mx = value => value * 1.5;
        const my = value => value * 1.5;
        const ms = value => value * 1.15;
        this.physics.world.setBounds(0, 0, 1200, 900);

        // CAMPUS BACKGROUND
        this.campusBackground = this.add.rectangle(
            600, 450, 1200, 900,
            0x3a7d44
        );

        // CAMPUS PATHS
        this.add.rectangle(
            600, 480, 1200, 123,
            0xc2a878
        );

        this.add.rectangle(
            750, 480, 123, 900,
            0xc2a878
        );

        // PROGRAMMING LAB
        this.lab = this.add.rectangle(
            mx(180), my(150), ms(200), ms(108),
            0x555555
        );

        this.add.text(
            mx(105), my(135),
            "PROGRAMMING LAB",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );

        // HOSTEL
        this.hostel = this.add.rectangle(
            mx(660), my(150), ms(166), ms(108),
            0x8b5a2b
        );

        this.add.text(
            mx(615), my(135),
            "HOSTEL",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );

        this.hostelDoor = this.add.circle(mx(660), my(220), 10, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.labDoor = this.add.circle(mx(180), my(220), 10, 0xf2cc60).setStrokeStyle(2, 0xffffff);

        // Additional campus facilities with their own playable interiors.
        this.library = this.add.rectangle(mx(115), my(475), ms(140), ms(90), 0x7056a5).setStrokeStyle(3, 0xd8c7ff);
        this.add.text(mx(76), my(465), "LIBRARY", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
        this.libraryDoor = this.add.circle(mx(115), my(530), 10, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.canteen = this.add.rectangle(mx(400), my(475), ms(140), ms(90), 0xb95e36).setStrokeStyle(3, 0xffd3a8);
        this.add.text(mx(360), my(465), "CANTEEN", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
        this.canteenDoor = this.add.circle(mx(400), my(530), 10, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.campusShop = this.add.rectangle(mx(685), my(490), ms(140), ms(78), 0x376a87).setStrokeStyle(3, 0xb6e5ff);
        this.add.text(mx(647), my(471), "CAMPUS SHOP", { fontSize: "14px", color: "#ffffff", fontStyle: "bold" });
        this.shopDoor = this.add.circle(mx(685), my(539), 10, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.treeGarden = this.add.rectangle(mx(400), my(105), ms(170), ms(70), 0x2c6e49).setStrokeStyle(2, 0x8be0a6);
        this.add.text(mx(345), my(97), "TREE GARDEN", { fontSize: "15px", color: "#ffffff", fontStyle: "bold" });
        [315, 350, 455, 490].forEach(x => this.add.circle(mx(x), my(95), 15, 0x174f2b).setStrokeStyle(2, 0x80c783));
        [[65, 105], [70, 350], [270, 545], [545, 545], [745, 245], [745, 575]].forEach(([x, y]) => {
            this.add.circle(mx(x), my(y), 18, 0x245b36).setStrokeStyle(2, 0x9acb72);
            this.add.rectangle(mx(x), my(y + 20), 8, 18, 0x72512e);
        });
        [[285, 410], [535, 410]].forEach(([x, y]) => {
            this.add.rectangle(mx(x), my(y), 72, 13, 0x8d6748).setStrokeStyle(2, 0x533f32);
            this.add.rectangle(mx(x), my(y + 12), 60, 6, 0x614832);
        });

        // PLAYER
        this.player = this.add.sprite(
            Phaser.Math.Clamp(Number(gameState.campusX) || 600, 25, 1175),
            Phaser.Math.Clamp(Number(gameState.campusY) || 450, 25, 875),
            "cv-player", "d0f0"
        ).setDisplaySize(40, 48);
        activeGameScene = this;

        // PLAYER PHYSICS
        this.physics.add.existing(this.player);

        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(22, 20).setOffset(5, 24);
        this.cameras.main.setBounds(0, 0, 1200, 900);
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

        // MENTOR NPC
        this.npc = this.add.sprite(mx(600), my(350), "cv-mentor", "d0f0").setDisplaySize(42, 52);
        this.mentorIndicator = this.add.text(this.npc.x, this.npc.y - 42,
            this.mentorIntroSeen ? "?" : "!", {
                fontSize: "18px", color: "#fff4a3", fontStyle: "bold",
                backgroundColor: "#183c45", padding: { x: 7, y: 3 }
            }).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: this.mentorIndicator, y: this.mentorIndicator.y - 5,
            alpha: 0.7, duration: 650, yoyo: true, repeat: -1 });

        this.add.text(
            mx(570), my(375),
            "MENTOR",
            {
                fontSize: "16px",
                color: "#ffffff"
            }
        );

        // LAB ASSISTANT — backed by the C++ LabAssistant class.
        this.labAssistant = this.add.sprite(mx(290), my(245), "cv-assistant", "d0f0").setDisplaySize(38, 48);
        this.add.text(mx(252), my(266), "LAB ASSISTANT", {
            fontSize: "11px", color: "#ffffff", fontStyle: "bold"
        });

        // FRIEND NPC — introduces the mandatory opening quest.
        this.friend = this.add.sprite(mx(360), my(400), "cv-friend", "d0f0").setDisplaySize(40, 50);
        this.add.text(mx(330), my(425), "FRIEND", {
            fontSize: "14px", color: "#ffffff"
        });

        // VENDING MACHINE — major interactive object with a real code-repair challenge.
        this.vendingMachine = this.add.rectangle(mx(735), my(330), 68, 92, 0x273746)
            .setStrokeStyle(3, 0x57cc99);
        this.add.rectangle(mx(735), my(317), 44, 32, 0x5dade2);
        this.add.rectangle(mx(735), my(350), 44, 24, 0x17202a);
        this.add.text(mx(700), my(380), "VENDING", {
            fontSize: "14px", color: "#ffffff", fontStyle: "bold"
        });
        this.vendingStatus = this.add.text(mx(695), my(395), this.coffeeQuestCompleted ? "ONLINE" : "ERROR", {
            fontSize: "12px", color: this.coffeeQuestCompleted ? "#7dffb3" : "#ff7777", fontStyle: "bold"
        });

        // LAB PHYSICS
        this.physics.add.existing(this.lab, true);

        // HOSTEL PHYSICS
        this.physics.add.existing(this.hostel, true);
        this.physics.add.existing(this.library, true);
        this.physics.add.existing(this.canteen, true);
        this.physics.add.existing(this.campusShop, true);
        this.physics.add.existing(this.treeGarden, true);

        // NPC PHYSICS
        this.physics.add.existing(this.npc, true);
        this.physics.add.existing(this.friend, true);
        this.physics.add.existing(this.labAssistant, true);
        this.physics.add.existing(this.vendingMachine, true);

        // COLLISIONS
        this.physics.add.collider(this.player, this.lab);
        this.physics.add.collider(this.player, this.hostel);
        this.physics.add.collider(this.player, this.library);
        this.physics.add.collider(this.player, this.canteen);
        this.physics.add.collider(this.player, this.campusShop);
        this.physics.add.collider(this.player, this.treeGarden);
        this.physics.add.collider(this.player, this.npc);
        this.physics.add.collider(this.player, this.friend);
        this.physics.add.collider(this.player, this.labAssistant);
        this.physics.add.collider(this.player, this.vendingMachine);

        // KEYBOARD CONTROLS
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT
        });

        // INTERACTION SETTINGS
        this.interactionDistance = 120;

        this.interactKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );

        // Open the C hash-table inventory at any time with I.
        this.inventoryKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);

        // Open the Binary Search Tree DSA challenge at any time with T.
        this.treeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        this.treeExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        // Optional debugging side quests are available from anywhere with B.
        this.debugQuestKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.debugQuestExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // INTERACTION BACKGROUND
        this.interactionBox = this.add.rectangle(400, 520, 320, 50, 0x122331)
            .setStrokeStyle(2, 0x79d7bf);
        this.interactionBox.setAlpha(0.94);
        this.interactionBox.setDepth(10);
        this.interactionBox.setScrollFactor(0);

        // INTERACTION TEXT
        this.interactionText = this.add.text(
            400, 520, "",
            {
                fontSize: "17px",
                color: "#fff4d6",
                fontStyle: "bold"
            }
        );

        this.interactionText.setOrigin(0.5);
        this.interactionText.setDepth(11);
        this.interactionText.setScrollFactor(0);

        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        // Compact RPG-style HUD panels keep quest and player status readable
        // without covering the center of the campus.
        this.hudPanels = this.add.graphics().setDepth(4);
        this.hudPanels.setScrollFactor(0);
        this.hudPanels.fillStyle(0x112333, 0.94);
        this.hudPanels.fillRoundedRect(8, 8, 320, 246, 14);
        this.hudPanels.lineStyle(2, 0x5cc7b2, 0.95);
        this.hudPanels.strokeRoundedRect(8, 8, 320, 246, 14);
        this.hudPanels.fillStyle(0x112333, 0.94);
        this.hudPanels.fillRoundedRect(500, 8, 292, 110, 14);
        this.hudPanels.lineStyle(2, 0x5cc7b2, 0.95);
        this.hudPanels.strokeRoundedRect(500, 8, 292, 110, 14);

        // QUEST STATUS HUD
        this.questStatusText = this.add.text(
            22, 20,
            "STORY QUEST · COFFEE CRISIS",
            {
                fontSize: "14px",
                color: "#9cebd3",
                fontStyle: "bold"
            }
        );

        this.questStatusText.setDepth(5);
        this.questStatusText.setScrollFactor(0);

        // XP HUD
        this.xpText = this.add.text(
            22, 55,
            "XP 0",
            {
                fontSize: "14px",
                color: "#ffd166",
                fontStyle: "bold"
            }
        );

        this.xpText.setDepth(5);
        this.xpText.setScrollFactor(0);

        this.notebookQuestStatusText = this.add.text(
            22, 88,
            "Quest: Notebook — LOCKED",
            {
                fontSize: "13px",
                color: "#e7eff6"
            }
        );
        this.notebookQuestStatusText.setDepth(5);
        this.notebookQuestStatusText.setScrollFactor(0);

        this.inventoryHintText = this.add.text(22, 120, "ACCESS TAB  ·  I", {
            fontSize: "12px", color: "#c6d5e1"
        });
        this.accessTabButton = this.add.rectangle(83, 132, 144, 28, 0x245b49)
            .setStrokeStyle(1, 0x7cffb2).setDepth(4.5).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        this.accessTabButton.on("pointerdown", () => this.showInventory());
        this.inventoryHintText.setDepth(5);
        this.inventoryHintText.setScrollFactor(0);
        this.inventoryHintText.setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.showInventory());
        this.inventoryHintText.on("pointerover", () => this.inventoryHintText.setColor("#7cffb2"));
        this.inventoryHintText.on("pointerout", () => this.inventoryHintText.setColor("#c6d5e1"));

        this.treeHintText = this.add.text(22, 183, "T  ·  TREE TRAINING", {
            fontSize: "12px", color: "#9cebd3"
        });
        this.treeHintText.setDepth(5);
        this.treeHintText.setScrollFactor(0);

        this.integrationHintText = this.add.text(22, 215, "H History   Q Tasks   B Quests", {
            fontSize: "11px", color: "#c6d5e1"
        });
        this.integrationHintText.setDepth(5);
        this.integrationHintText.setScrollFactor(0);
        this.historyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.taskQueueKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.integrationExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Continuous campus clock: one game minute per two real seconds.
        this.gameMinutes = Phaser.Math.Clamp(Number(gameState.gameMinutes ?? 360), 0, 1439);
        this.gameDay = Math.max(1, Number(gameState.gameDay) || 1);
        this.gameClockText = this.add.text(515, 78, formatGameClock(), {
            fontSize: "14px", color: "#fff4d6", fontStyle: "bold"
        });
        this.gameClockText.setDepth(5);
        this.gameClockText.setScrollFactor(0);
        this.gameClockListener = (timeText) => {
            this.gameMinutes = gameState.gameMinutes;
            this.gameDay = gameState.gameDay;
            if (this.gameClockText?.active) this.gameClockText.setText(timeText);
            this.updateWorldLighting?.();
        };
        gameClockListeners.add(this.gameClockListener);
        startGameClock();

        this.coffeeQuestStatusText = this.add.text(22, 151, "Next · Talk to your friend", {
            fontSize: "12px", color: "#e7eff6"
        });
        this.coffeeQuestStatusText.setDepth(5);
        this.coffeeQuestStatusText.setScrollFactor(0);

        this.playerStatsText = this.add.text(515, 20, "PLAYER  ·  Loading…", {
            fontSize: "13px",
            color: "#e7eff6",
            lineSpacing: 5
        });
        this.playerStatsText.setDepth(5);
        this.playerStatsText.setScrollFactor(0);
        cppPlayerReady.then((module) => {
            if (module) this.syncPlayerStats();
            else if (this.playerStatsText) this.playerStatsText.setText("C++ Player module unavailable");
        });

        this.updateQuestHUD();

        // Native modules are restored from the saved game state before new work is queued.
        Promise.all([stackReady, queueReady, worldReady]).then(([stack, queue]) => {
            if (queue && queue.ccall("queueGetCount", "number", [], []) === 0 && !this.coffeeQuestCompleted) {
                this.enqueueGameTask("Repair vending machine");
            }
            this.recordGameAction(`Resumed Day ${this.gameDay}`);
        });
        this.restoreDebugQuestLog();

        this.autoSaveTimer = this.time.addEvent({ delay: 1000, callback: this.saveProgress, callbackScope: this, loop: true });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.saveProgress();
            gameClockListeners.delete(this.gameClockListener);
            if (activeGameScene === this) activeGameScene = null;
        });
        this.createMiniMap();
        this.saveProgress();
        if (gameState.location !== "campus") {
            this.interiorActive = true;
            this.minimapPanel.setVisible(false);
            this.minimapGraphic.setVisible(false);
            this.scene.launch("InteriorScene", { location: gameState.location });
        }
    }

    createMiniMap() {
        this.minimapPanel = this.add.rectangle(700, 199, 184, 136, 0x112333, 0.96)
            .setStrokeStyle(2, 0x5cc7b2).setDepth(6).setScrollFactor(0);
        this.minimapLabel = this.add.text(618, 134, "CAMPUS MAP", {
            fontSize: "11px", color: "#9cebd3", fontStyle: "bold"
        }).setDepth(7).setScrollFactor(0);
        this.minimapGraphic = this.add.graphics().setDepth(7).setScrollFactor(0);
        this.minimapLayout = { x: 618, y: 151, width: 164, height: 96 };
        this.updateMiniMap();
    }

    updateMiniMap() {
        if (!this.minimapGraphic || !this.player) return;
        const g = this.minimapGraphic;
        const { x, y, width, height } = this.minimapLayout;
        const point = (worldX, worldY) => ({
            x: x + Phaser.Math.Clamp(worldX / 1200, 0, 1) * width,
            y: y + Phaser.Math.Clamp(worldY / 900, 0, 1) * height
        });
        g.clear();
        g.fillStyle(0x29434b, 1).fillRoundedRect(x, y, width, height, 5);
        g.lineStyle(6, 0xc2a878, 1);
        g.lineBetween(x, y + height * 0.533, x + width, y + height * 0.533);
        g.lineBetween(x + width * 0.625, y, x + width * 0.625, y + height);
        const places = [
            [270, 225, 0xb5b5b5], [990, 225, 0x8b5a2b], [172.5, 712.5, 0x9a79cc],
            [600, 712.5, 0xd77a4c], [1027.5, 735, 0x65a4c6], [600, 157.5, 0x55a870]
        ];
        places.forEach(([worldX, worldY, color]) => {
            const p = point(worldX, worldY);
            g.fillStyle(color, 1).fillRoundedRect(p.x - 4, p.y - 3, 8, 6, 2);
        });
        const playerPoint = point(this.player.x, this.player.y);
        g.fillStyle(0xffd166, 1).fillCircle(playerPoint.x, playerPoint.y, 4);
        g.lineStyle(1, 0xffffff, 1).strokeCircle(playerPoint.x, playerPoint.y, 4);
    }

    saveProgress() {
        if (this.player) {
            gameState.campusX = this.player.x;
            gameState.campusY = this.player.y;
        }
        gameState.campusMapVersion = 2;
        gameState.questCompleted = !!this.questCompleted;
        gameState.coffeeQuestAccepted = !!this.coffeeQuestAccepted;
        gameState.coffeeQuestCompleted = !!this.coffeeQuestCompleted;
        gameState.notebookQuestAccepted = !!this.notebookQuestAccepted;
        gameState.notebookQuestCompleted = !!this.notebookQuestCompleted;
        gameState.treeChallengeCompleted = !!this.treeChallengeCompleted;
        gameState.debugQuestCompleted = { ...this.debugQuestCompleted };
        gameState.mentorIntroSeen = !!this.mentorIntroSeen;
        gameState.activeDebugQuestId = gameState.activeDebugQuestId || null;
        gameState.labPracticeCompleted = { ...gameState.labPracticeCompleted };
        gameState.storyStep = this.coffeeQuestCompleted ? (this.questCompleted ? 2 : 1) : 0;
        if (cppPlayerModule) {
            gameState.playerXP = cppPlayerModule.ccall("playerGetXP", "number", [], []);
            gameState.playerEnergy = cppPlayerModule.ccall("playerGetEnergy", "number", [], []);
        }
        if (hashTableModule) {
            const inventory = {};
            const count = hashTableModule.ccall("getInventoryCount", "number", [], []);
            for (let i = 0; i < count; i++) {
                const name = hashTableModule.ccall("getItemNameAt", "string", ["number"], [i]);
                inventory[name] = {
                    quantity: hashTableModule.ccall("getItemQuantityAt", "number", ["number"], [i]),
                    description: hashTableModule.ccall("getItemDescriptionAt", "string", ["number"], [i])
                };
            }
            gameState.inventory = inventory;
        }
        if (stackModule) {
            const count = stackModule.ccall("stackGetCount", "number", [], []);
            gameState.actionHistory = Array.from({ length: count }, (_, i) =>
                stackModule.ccall("stackGetActionAt", "string", ["number"], [i]));
        }
        if (queueModule) {
            const count = queueModule.ccall("queueGetCount", "number", [], []);
            gameState.taskQueue = Array.from({ length: count }, (_, i) =>
                queueModule.ccall("queueGetTaskAt", "string", ["number"], [i]));
        }
        persistGameState();
    }


    // ==========================================
    // CONTINUOUS GAME CLOCK — 1 MINUTE / 2 REAL SECONDS
    // ==========================================
    advanceGameMinute() {
        this.gameMinutes++;
        if (this.gameMinutes >= 1440) {
            this.gameMinutes = 0;
            this.gameDay++;
        }
        gameState.gameMinutes = this.gameMinutes;
        gameState.gameDay = this.gameDay;
        this.gameClockText.setText(formatGameClock());
        let ground = 0x3a7d44;
        if (hour >= 12 && hour < 17) ground = 0x4d8b49;
        else if (hour >= 17 && hour < 20) ground = 0x6b6847;
        else if (hour >= 20 || hour < 6) ground = 0x202c48;
        if (this.campusBackground) this.campusBackground.setFillStyle(ground);
    }

    // ==========================================
    // DEBUGGING SIDE QUESTS (PRESS B)
    // ==========================================
    getDebugQuestCatalog() {
        return [
            { id: "null", title: "Guard the NULL Pointer", language: "C · linked lists", xp: 10,
                story: "A damaged list may have no first node. Add the guard before reading head->data.",
                code: "Node *head = getHead();\nif (_____) {\n    printf(\"%d\", head->data);\n}",
                prompt: "Fill the condition that makes the dereference safe.", answers: ["head != NULL", "NULL != head"],
                hint: "Check that head points to a node before accessing a field." },
            { id: "loop", title: "Restart the Search Loop", language: "C · control flow", xp: 10,
                story: "The search never advances past its first item. Restore the loop update so it can reach its stop condition.",
                code: "for (int i = 0; i < length; _____) {\n    inspect(items[i]);\n}",
                prompt: "Enter the missing update expression.", answers: ["i++", "++i", "i += 1"],
                hint: "Increase i by one on each pass." },
            { id: "hash", title: "Resolve a Hash Collision", language: "C · hash table", xp: 10,
                story: "A slot is occupied. The table uses linear probing, so calculate the next slot and wrap at the table size.",
                code: "while (table[index] != EMPTY) {\n    index = (index + _____) % TABLE_SIZE;\n}",
                prompt: "Enter the step size used by linear probing.", answers: ["1"],
                hint: "Probe the next slot, one position at a time." },
            { id: "condition", title: "Restore the Dispenser Guard", language: "C · vending WebAssembly", xp: 15,
                story: "The festival dispenser must reject requests larger than its remaining stock. Repair the missing bound check.",
                code: "int dispenseCoffee(int stock, int requested) {\n    if (requested > 0 && requested <= _____) {\n        return requested;\n    }\n    return 0;\n}",
                prompt: "Enter the C parameter that represents available cups. The compiled C tests verify your fix.",
                answers: ["stock"], hint: "Compare requested cups with the available amount. The parameter is named in the function signature." }
        ];
    }

    async restoreDebugQuestLog() {
        const module = await linkedListReady;
        if (!module) return;
        this.getDebugQuestCatalog().forEach((quest, index) => {
            const cQuestId = 100 + index;
            module.ccall("addQuest", "number", ["number", "string"], [cQuestId, quest.title]);
            if (this.debugQuestCompleted[quest.id]) module.ccall("completeQuest", "number", ["number"], [cQuestId]);
        });
    }

    showDebugQuestBoard(force = false) {
        if ((!force && (this.debugQuestOpen || this.treeChallengeOpen || this.dsaOpen ||
            this.inventoryOpen || this.questDialogueOpen || this.coffeeChallengeOpen)) || this.mentorIntroOpen) return;
        const firstOpen = !this.debugQuestOpen;
        this.cleanupDebugQuestInput();
        this.debugQuestOpen = true;
        this.debugCodeChallengeOpen = false;
        this.player.body.setVelocity(0);
        if (firstOpen) this.recordGameAction("Opened access tab debugging queue");
        this.debugQuestObjects?.forEach(obj => obj?.destroy?.());
        this.debugQuestObjects = [];
        const add = obj => {
            obj.setDepth(120).setScrollFactor(0);
            this.debugQuestObjects.push(obj);
            return obj;
        };
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.88));
        add(this.add.rectangle(400, 300, 690, 520, 0x152b35, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 68, "DEBUGGING QUEST QUEUE", {
            fontSize: "25px", color: "#7CFFB2", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 103, "Choose a mission to read its briefing, then start a real code repair.", {
            fontSize: "14px", color: "#d8f4e6", align: "center"
        }).setOrigin(0.5));
        this.getDebugQuestCatalog().forEach((quest, index) => {
            const y = 160 + index * 78;
            const completed = !!this.debugQuestCompleted[quest.id];
            const active = gameState.activeDebugQuestId === quest.id;
            const status = completed ? "COMPLETE ✓" : active ? "RESUME MISSION ›" : "VIEW BRIEFING ›";
            const button = add(this.add.rectangle(400, y, 590, 62, completed ? 0x245b49 : 0x263746)
                .setStrokeStyle(1, completed ? 0x7cffb2 : 0x5cc7b2)
                .setInteractive({ useHandCursor: !completed }));
            const label = add(this.add.text(130, y - 16,
                `${String(index + 1).padStart(2, "0")}  ${quest.title}`, {
                    fontSize: "16px", color: completed ? "#7CFFB2" : "#ffffff", fontStyle: "bold"
                }));
            add(this.add.text(130, y + 11, `${quest.language}  ·  ${quest.xp} XP`, {
                fontSize: "12px", color: "#b8c7d9"
            }));
            add(this.add.text(665, y, status, {
                fontSize: "12px", color: completed ? "#7CFFB2" : "#9cebd3", fontStyle: "bold"
            }).setOrigin(1, 0.5));
            if (!completed) {
                const openBriefing = () => this.showDebugQuestBriefing(quest);
                button.on("pointerdown", openBriefing);
                label.setInteractive({ useHandCursor: true }).on("pointerdown", openBriefing);
            }
        });
        add(this.add.text(400, 492, "B / ESC  ·  close queue", {
            fontSize: "13px", color: "#b8c7d9"
        }).setOrigin(0.5));
        this.animatePanel(this.debugQuestObjects);
    }

    showDebugQuestBriefing(quest) {
        this.debugQuestObjects.forEach(obj => obj?.destroy?.());
        this.debugQuestObjects = [];
        const add = obj => {
            obj.setDepth(125).setScrollFactor(0);
            this.debugQuestObjects.push(obj);
            return obj;
        };
        const active = gameState.activeDebugQuestId === quest.id;
        const anotherMissionActive = !!gameState.activeDebugQuestId && !active;
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.90));
        add(this.add.rectangle(400, 300, 660, 460, 0x152b35, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 100, quest.title, {
            fontSize: "25px", color: "#7CFFB2", fontStyle: "bold", align: "center", wordWrap: { width: 580 }
        }).setOrigin(0.5));
        add(this.add.text(400, 140, `${quest.language}  ·  REWARD ${quest.xp} XP`, {
            fontSize: "13px", color: "#ffe08a", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(120, 185, quest.story, {
            fontSize: "17px", color: "#f1f5f9", lineSpacing: 7, wordWrap: { width: 560 }
        }));
        add(this.add.text(400, 295, "MISSION OBJECTIVE", {
            fontSize: "13px", color: "#9cebd3", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 322, quest.prompt, {
            fontSize: "15px", color: "#d8f4e6", align: "center", wordWrap: { width: 540 }
        }).setOrigin(0.5));
        const startButton = add(this.add.text(505, 430,
            active ? "RESUME CHALLENGE  ›" : anotherMissionActive ? "FINISH ACTIVE MISSION FIRST" : "ACCEPT & START  ›", {
            fontSize: "15px", color: anotherMissionActive ? "#d2d9dc" : "#10202b",
            backgroundColor: anotherMissionActive ? "#46565c" : "#8be0c2", fontStyle: "bold",
            padding: { x: 14, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: !anotherMissionActive }));
        startButton.on("pointerdown", () => {
            if (anotherMissionActive) return;
            if (!active) {
                gameState.activeDebugQuestId = quest.id;
                this.enqueueGameTask(`Debug mission: ${quest.id}`);
                this.recordGameAction(`Accepted debugging mission: ${quest.title}`);
                this.saveProgress();
            }
            this.showDebugQuestQuestion(quest);
        });
        const backButton = add(this.add.text(290, 430, "‹  QUEUE", {
            fontSize: "15px", color: "#ffffff", backgroundColor: "#285943", padding: { x: 14, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        backButton.on("pointerdown", () => this.showDebugQuestBoard(true));
        this.animatePanel(this.debugQuestObjects);
    }

    showDebugQuestQuestion(quest) {
        if (!this.debugQuestOpen || this.debugQuestCompleted[quest.id]) return;
        this.cleanupDebugQuestInput();
        this.debugQuestObjects.forEach(obj => obj?.destroy?.());
        this.debugQuestObjects = [];
        this.debugCodeChallengeOpen = true;
        this.currentDebugQuest = quest;
        const add = obj => {
            obj.setDepth(125).setScrollFactor(0);
            this.debugQuestObjects.push(obj);
            return obj;
        };
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.97));
        add(this.add.rectangle(400, 300, 730, 530, 0x152b35, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 58, quest.title, {
            fontSize: "23px", color: "#7CFFB2", fontStyle: "bold", align: "center", wordWrap: { width: 650 }
        }).setOrigin(0.5));
        add(this.add.text(400, 91, `${quest.language}  ·  MISSION REWARD ${quest.xp} XP`, {
            fontSize: "13px", color: "#ffe08a", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 122, quest.story, {
            fontSize: "14px", color: "#e8f1f2", align: "center", wordWrap: { width: 620 }
        }).setOrigin(0.5));
        add(this.add.rectangle(400, 258, 635, 178, 0x09151d).setStrokeStyle(1, 0x52707d));
        add(this.add.text(94, 185, quest.code, {
            fontFamily: "Consolas, monospace", fontSize: "16px", color: "#b8f4d4",
            lineSpacing: 7, wordWrap: { width: 600 }
        }));
        add(this.add.text(400, 375, quest.prompt, {
            fontSize: "14px", color: "#d8f4e6", align: "center", wordWrap: { width: 610 }
        }).setOrigin(0.5));
        const feedback = add(this.add.text(400, 425, "", {
            fontSize: "14px", color: "#ffe08a", align: "center", wordWrap: { width: 610 }
        }).setOrigin(0.5));
        this.debugQuestInput = document.createElement("input");
        this.debugQuestInput.type = "text";
        this.debugQuestInput.autocomplete = "off";
        this.debugQuestInput.spellcheck = false;
        this.debugQuestInput.placeholder = "Type the missing code...";
        this.debugQuestInput.setAttribute("aria-label", "Debug mission code answer");
        const canvasRect = this.game.canvas.getBoundingClientRect();
        Object.assign(this.debugQuestInput.style, {
            position: "fixed", left: `${canvasRect.left + canvasRect.width * 0.24}px`,
            top: `${canvasRect.top + canvasRect.height * 0.76}px`, width: `${canvasRect.width * 0.52}px`,
            padding: "10px 14px", boxSizing: "border-box", fontSize: "16px",
            border: "2px solid #57cc99", borderRadius: "8px", zIndex: "10000",
            background: "#f5fff9", color: "#10251c", textAlign: "center"
        });
        document.body.appendChild(this.debugQuestInput);
        this.debugReleasedKeyCapture = [...Array(26)].map((_, index) => 65 + index).concat([
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.MINUS,
            Phaser.Input.Keyboard.KeyCodes.PLUS,
            Phaser.Input.Keyboard.KeyCodes.PERIOD
        ]);
        this.input.keyboard.removeCapture(this.debugReleasedKeyCapture);
        const submit = async () => {
            if (!this.debugQuestInput || this.debugQuestInput.disabled || this.debugSubmissionPending) return;
            const answer = this.debugQuestInput.value.trim().replace(/\s+/g, " ").replace(/;$/, "").trim();
            if (!answer) {
                feedback.setColor("#ffcc66").setText("Type a code answer before submitting.");
                return;
            }
            this.debugSubmissionPending = true;
           let accepted = quest.answers.some(
    candidate => candidate.replace(/\s+/g, "") === answer.replace(/\s+/g, "")
);
            if (quest.id === "condition") {
                const module = await vendingReady;
                accepted = !!module && module.ccall("vendingValidateFix", "number", ["string"], [answer]) === 1;
            }
            if (!accepted) {
                feedback.setColor("#ffcc66").setText("That code still fails the mission checks. Review the hint and try again.");
                this.debugSubmissionPending = false;
                return;
            }
            const linked = await linkedListReady;
            const questIndex = this.getDebugQuestCatalog().findIndex(entry => entry.id === quest.id);
            const cQuestId = 100 + questIndex;
            if (!linked || !linked.ccall("addQuest", "number", ["number", "string"], [cQuestId, quest.title]) ||
                !linked.ccall("completeQuest", "number", ["number"], [cQuestId])) {
                feedback.setColor("#ffcc66").setText("The C linked-list quest log is unavailable. Your mission was not marked complete.");
                this.debugSubmissionPending = false;
                return;
            }
            const rewarded = await this.awardXP(quest.xp);
            if (!rewarded) {
                feedback.setColor("#ffcc66").setText("The C++ Player module could not award XP, so the mission remains active.");
                this.debugSubmissionPending = false;
                return;
            }
            this.debugQuestCompleted[quest.id] = true;
            gameState.debugQuestCompleted = { ...this.debugQuestCompleted };
            gameState.activeDebugQuestId = null;
            this.completeQueuedTask(`Debug mission: ${quest.id}`);
            this.recordGameAction(`Completed debugging mission: ${quest.title} (+${quest.xp} XP)`);
            this.saveProgress();
            feedback.setColor("#7CFFB2").setText(`C code checks passed. Mission complete!  +${quest.xp} XP`);
            this.debugQuestInput.disabled = true;
            this.time.delayedCall(1400, () => {
                if (!this.scene || !this.scene.isActive()) return;
                this.cleanupDebugQuestInput();
                this.debugCodeChallengeOpen = false;
                this.showDebugQuestBoard(true);
            });
        };
        this.debugQuestSubmit = submit;
        this.debugQuestInput.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.key === "Enter") submit();
            if (event.key === "Escape") this.showDebugQuestBoard(true);
        });
        this.debugSubmissionPending = false;
        this.debugQuestInput.focus();
        const hintButton = add(this.add.text(242, 516, "HINT", {
            fontSize: "14px", color: "#ffffff", backgroundColor: "#285943", padding: { x: 16, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        hintButton.on("pointerdown", () => feedback.setColor("#ffe08a").setText(quest.hint));
        const submitButton = add(this.add.text(400, 516, "SUBMIT CODE  ↵", {
            fontSize: "14px", color: "#10202b", backgroundColor: "#8be0c2", fontStyle: "bold", padding: { x: 16, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        submitButton.on("pointerdown", submit);
        const backButton = add(this.add.text(580, 516, "‹  QUEUE", {
            fontSize: "14px", color: "#ffffff", backgroundColor: "#285943", padding: { x: 16, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        backButton.on("pointerdown", () => this.showDebugQuestBoard(true));
        this.animatePanel(this.debugQuestObjects);
    }

    cleanupDebugQuestInput() {
        if (this.debugQuestInput) {
            this.debugQuestInput.remove();
            this.debugQuestInput = null;
        }
        if (this.debugReleasedKeyCapture && this.input?.keyboard) {
            this.input.keyboard.addCapture(this.debugReleasedKeyCapture);
            this.debugReleasedKeyCapture = null;
        }
        this.debugSubmissionPending = false;
    }

    closeDebugQuestBoard() {
        this.cleanupDebugQuestInput();
        this.debugQuestOpen = false;
        this.debugCodeChallengeOpen = false;
        this.debugQuestObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        this.debugQuestObjects = [];
    }

    // ==========================================
    // BINARY SEARCH TREE TRAINING (PRESS T)
    // ==========================================
    async showTreeChallenge() {
        if (this.treeChallengeOpen || this.dsaOpen || this.inventoryOpen ||
            this.questDialogueOpen || this.coffeeChallengeOpen) return;
        this.treeChallengeOpen = true;
        if (!this.treeChallengeCompleted) this.enqueueGameTask("Complete Tree DSA challenge");
        this.recordGameAction("Opened Tree DSA challenge");
        this.player.body.setVelocity(0);
        this.treeChallengeObjects = [];

        const add = (obj) => { obj.setScrollFactor(0); this.treeChallengeObjects.push(obj); return obj; };
        add(this.add.rectangle(400, 300, 720, 520, 0x101820, 0.97).setStrokeStyle(3, 0x57cc99).setDepth(100));
        add(this.add.text(400, 65, "TREE TRAINING — BINARY SEARCH TREE", {
            fontSize: "24px", color: "#7CFFB2", fontStyle: "bold", align: "center"
        }).setOrigin(0.5).setDepth(101));
        add(this.add.text(400, 100, "Insert 40, 20, 60, 10, 30 into a BST", {
            fontSize: "18px", color: "#ffffff", align: "center"
        }).setOrigin(0.5).setDepth(101));

        // Build the actual C tree when its Emscripten module is available.
        const module = await treeReady;
        if (module) {
            try {
                module.ccall("treeReset", null, [], []);
                [40, 20, 60, 10, 30].forEach(value => module.ccall("treeInsert", null, ["number"], [value]));
            } catch (error) { console.error("C BST initialization failed:", error); }
        }

        // Draw the teaching tree in Phaser. Values mirror the C insert sequence.
        const line = (x1, y1, x2, y2) => add(this.add.line(0, 0, x1, y1, x2, y2, 0x7CFFB2).setLineWidth(3).setDepth(101));
        line(400, 170, 280, 230); line(400, 170, 520, 230); line(280, 230, 220, 290); line(280, 230, 335, 290);
        const node = (x, y, label) => {
            add(this.add.circle(x, y, 25, 0x245b49).setStrokeStyle(3, 0x7CFFB2).setDepth(102));
            add(this.add.text(x, y, String(label), { fontSize: "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(103));
        };
        node(400, 170, 40); node(280, 230, 20); node(520, 230, 60); node(220, 290, 10); node(335, 290, 30);
        add(this.add.text(400, 335, "Question: What is the INORDER traversal?", {
            fontSize: "20px", color: "#ffffff", fontStyle: "bold", align: "center"
        }).setOrigin(0.5).setDepth(101));

        const options = ["10, 20, 30, 40, 60", "40, 20, 10, 30, 60", "10, 30, 20, 60, 40"];
        options.forEach((answer, index) => {
            const y = 385 + index * 48;
            const button = add(this.add.rectangle(400, y, 440, 38, 0x263746).setStrokeStyle(1, 0x7CFFB2).setInteractive({ useHandCursor: true }).setDepth(101));
            const label = add(this.add.text(400, y, `${String.fromCharCode(65 + index)}) ${answer}`, {
                fontSize: "17px", color: "#ffffff", align: "center"
            }).setOrigin(0.5).setDepth(102));
            button.on("pointerdown", () => this.answerTreeChallenge(index === 0, button, label));
        });
        add(this.add.text(400, 535, "Press ESC to close  •  Correct answer earns +20 XP", {
            fontSize: "15px", color: "#b8c7d9", align: "center"
        }).setOrigin(0.5).setDepth(101));
    }

    async answerTreeChallenge(correct, button, label) {
        if (this.treeChallengeCompleted) return;
        if (!correct) {
            label.setText("Try again — BST inorder is Left, Root, Right");
            label.setColor("#ffcc66");
            return;
        }
        this.treeChallengeCompleted = true;
        this.completeQueuedTask("Complete Tree DSA challenge");
        this.recordGameAction("Completed Tree DSA challenge (+20 XP)");
        let traversal = "10, 20, 30, 40, 60";
        if (treeModule) {
            try {
                const count = treeModule.ccall("treeGetCount", "number", [], []);
                const values = [];
                for (let i = 0; i < count; i++) values.push(treeModule.ccall("treeGetInorderAt", "number", ["number"], [i]));
                if (values.length) traversal = values.join(", ");
            } catch (error) { console.error("Could not read C BST traversal:", error); }
        }
        label.setText("CORRECT! Inorder: " + traversal + "  |  +20 XP");
        label.setColor("#7CFFB2");
        button.setFillStyle(0x245b49);
        await this.awardXP(20);
        this.updateQuestHUD();
        console.log("Tree Training completed. Inorder:", traversal);
    }

    closeTreeChallenge() {
        this.treeChallengeOpen = false;
        this.treeChallengeObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        this.treeChallengeObjects = [];
    }

    enterInterior(location) {
        if (gameState.location !== "campus" || !INTERIOR_LOCATIONS.includes(location)) return;
        this.currentLocation = location;
        this.interiorActive = true;
        this.minimapPanel?.setVisible(false);
        this.minimapLabel?.setVisible(false);
        this.minimapGraphic?.setVisible(false);
        this.interactionBox?.setVisible(false);
        this.interactionText?.setVisible(false);
        gameState.location = location;
        this.recordGameAction(`Entered ${location}`);
        this.saveProgress();
        this.scene.launch("InteriorScene", { location });
    }

    // ==========================================
    // UPDATE
    // ==========================================

    update() {

        if (this.minimapPanel?.visible && !this.interiorActive) this.updateMiniMap();
        if (this.interiorActive) {
            this.player.body.setVelocity(0);
            this.interactionBox?.setVisible(false);
            this.interactionText?.setVisible(false);
            return;
        }
        if (this.mentorIntroOpen) {
            this.player.body.setVelocity(0);
            return;
        }
        const suppressInteractionThisFrame = !!this.suppressNextInteraction;
        this.suppressNextInteraction = false;

        // C Stack / Queue panels pause movement until closed.
        if (this.integrationPanelOpen) {
            this.player.body.setVelocity(0);
            if (Phaser.Input.Keyboard.JustDown(this.historyKey) ||
                Phaser.Input.Keyboard.JustDown(this.taskQueueKey) ||
                Phaser.Input.Keyboard.JustDown(this.integrationExitKey)) {
                this.closeIntegrationPanel();
            }
            return;
        }
        const anotherOverlayOpen = this.treeChallengeOpen || this.debugQuestOpen || this.coffeeChallengeOpen ||
            this.questDialogueOpen || this.inventoryOpen || this.dsaOpen;
        if (!anotherOverlayOpen && this.historyKey && Phaser.Input.Keyboard.JustDown(this.historyKey)) {
            this.showIntegrationPanel("history");
            return;
        }
        if (!anotherOverlayOpen && this.taskQueueKey && Phaser.Input.Keyboard.JustDown(this.taskQueueKey)) {
            this.showIntegrationPanel("queue");
            return;
        }

        if (this.debugCodeChallengeOpen) {
            this.player.body.setVelocity(0);
            if (this.treeKey) Phaser.Input.Keyboard.JustDown(this.treeKey);
            if (this.debugQuestKey) Phaser.Input.Keyboard.JustDown(this.debugQuestKey);
            if (this.inventoryKey) Phaser.Input.Keyboard.JustDown(this.inventoryKey);
            if (this.debugQuestExitKey) Phaser.Input.Keyboard.JustDown(this.debugQuestExitKey);
            return;
        }

        // Debug quest board pauses normal gameplay while open.
        if (this.debugQuestOpen) {
            this.player.body.setVelocity(0);
            if (Phaser.Input.Keyboard.JustDown(this.debugQuestKey) ||
                Phaser.Input.Keyboard.JustDown(this.debugQuestExitKey)) this.closeDebugQuestBoard();
            return;
        }

        if (this.debugQuestKey && Phaser.Input.Keyboard.JustDown(this.debugQuestKey)) {
            this.showDebugQuestBoard();
            return;
        }

        // Tree Training overlay pauses normal gameplay while open.
        if (this.treeChallengeOpen) {
            this.player.body.setVelocity(0);
            if (Phaser.Input.Keyboard.JustDown(this.treeExitKey)) this.closeTreeChallenge();
            return;
        }

        // Code-repair overlay pauses normal gameplay while open.
        if (this.coffeeChallengeOpen) {
            this.player.body.setVelocity(0);
            if (this.treeKey) Phaser.Input.Keyboard.JustDown(this.treeKey);
            return;
        }

        // Quest/shop dialogue pauses normal gameplay while open.
        if (this.questDialogueOpen) {
            this.player.body.setVelocity(0);
            return;
        }

        // Inventory screen pauses normal gameplay while open.
        if (this.inventoryOpen) {
            this.player.body.setVelocity(0);
            if (Phaser.Input.Keyboard.JustDown(this.inventoryKey) ||
                (this.inventoryExitKey && Phaser.Input.Keyboard.JustDown(this.inventoryExitKey))) {
                this.closeInventory();
            }
            return;
        }

        // Open the inventory using the C hash-table module.
        if (this.inventoryKey && Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
            this.showInventory();
            return;
        }

        // DSA SCREEN OPEN
        if (this.dsaOpen) {

            this.player.body.setVelocity(0);

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.dsaExitKey
                )
            ) {

                this.closeDSAChallenge();

            }

            return;
        }

        // Open Tree Training using the T key.
        if (this.treeKey && Phaser.Input.Keyboard.JustDown(this.treeKey)) {
            this.showTreeChallenge();
            return;
        }

        // MOVEMENT: hold SHIFT to sprint using energy managed by C++ Player.
        const sprintKey = this.keys.SHIFT;
        const movingInput = this.keys.A.isDown || this.keys.D.isDown ||
            this.keys.W.isDown || this.keys.S.isDown;
        // Sprinting requires both SHIFT and a movement key; holding SHIFT while
        // standing still must not drain energy.
        const wantsToSprint = !!(sprintKey && sprintKey.isDown && movingInput);
        const hasEnergy = this.playerEnergy > 0;
        const sprinting = wantsToSprint && hasEnergy && !!cppPlayerModule;
        const speed = sprinting ? 300 : 200;
        this.tickPlayerEnergy(this.time.now, sprinting, wantsToSprint);

        // RESET VELOCITY
        this.player.body.setVelocity(0);

        // MOVE LEFT
        if (this.keys.A.isDown) {
            this.player.body.setVelocityX(-speed);
        }

        // MOVE RIGHT
        if (this.keys.D.isDown) {
            this.player.body.setVelocityX(speed);
        }

        // MOVE UP
        if (this.keys.W.isDown) {
            this.player.body.setVelocityY(-speed);
        }

        // MOVE DOWN
        if (this.keys.S.isDown) {
            this.player.body.setVelocityY(speed);
        }

        // NORMALIZE DIAGONAL MOVEMENT
        this.player.body.velocity.normalize().scale(speed);
        updatePlayerAnimation(this.player, this.player.body.velocity.x, this.player.body.velocity.y);

        // Find the closest interactable character/object.
        const targets = [
            { type: "hostelDoor", object: this.hostelDoor },
            { type: "labDoor", object: this.labDoor },
            { type: "libraryDoor", object: this.libraryDoor },
            { type: "canteenDoor", object: this.canteenDoor },
            { type: "shopDoor", object: this.shopDoor },
            { type: "treeGarden", object: this.treeGarden },
            { type: "friend", object: this.friend },
            { type: "vending", object: this.vendingMachine },
            { type: "mentor", object: this.npc },
            { type: "labAssistant", object: this.labAssistant }
        ].map(target => ({
            ...target,
            distance: Phaser.Math.Distance.Between(
                this.player.x, this.player.y, target.object.x, target.object.y
            )
        })).filter(target => target.distance <= this.interactionDistance)
          .sort((a, b) => a.distance - b.distance);

        const nearestTarget = targets[0] || null;

        if (nearestTarget) {
            this.interactionBox.setVisible(true);
            this.interactionText.setVisible(true);
            const prompts = {
                hostelDoor: "Press E to enter Hostel",
                labDoor: "Press E to enter Programming Lab",
                libraryDoor: "Press E to enter Library",
                canteenDoor: "Press E to enter Canteen",
                shopDoor: "Press E to enter Campus Shop",
                treeGarden: "Press E to explore the Binary Tree Garden",
                friend: this.coffeeQuestCompleted ? "Press E to talk to your friend" : "Press E to talk to your friend",
                vending: this.coffeeQuestCompleted ? "Press E to use vending machine" : "Press E to inspect vending machine",
                mentor: this.coffeeQuestCompleted
                    ? (!this.questCompleted ? "Press E to begin DSA training" : "Press E to talk to mentor")
                    : "Mentor: finish the Coffee Crisis first",
                labAssistant: "Press E to talk to Lab Assistant"
            };
            this.interactionText.setText(prompts[nearestTarget.type]);
        } else {
            this.interactionBox.setVisible(false);
            this.interactionText.setVisible(false);
        }

        // PRESS E TO INTERACT WITH THE CLOSEST NPC OR OBJECT
        const interactPressed = Phaser.Input.Keyboard.JustDown(this.interactKey);
        if (!suppressInteractionThisFrame && interactPressed && nearestTarget) {
            switch (nearestTarget.type) {
                case "hostelDoor": this.enterInterior("hostel"); break;
                case "labDoor": this.enterInterior("lab"); break;
                case "libraryDoor": this.enterInterior("library"); break;
                case "canteenDoor": this.enterInterior("canteen"); break;
                case "shopDoor": this.enterInterior("shop"); break;
                case "treeGarden": this.showTreeChallenge(); break;
                case "friend":
                    this.recordGameAction("Talked to Friend");
                    this.interactWithFriend();
                    break;
                case "vending":
                    this.recordGameAction("Inspected vending machine");
                    this.interactWithVendingMachine();
                    break;
                case "mentor":
                    this.logCppNpcInteraction(0);
                    this.interactWithMentor();
                    break;
                case "labAssistant":
                    this.interactWithLabAssistant();
                    break;
            }
        }

    }

}


// ==========================================
// FUNCTIONAL BUILDING INTERIORS
// ==========================================
class InteriorScene extends Phaser.Scene {
    constructor() {
        super("InteriorScene");
        this.location = "hostel";
        this.targets = [];
        this.solids = [];
        this.panelObjects = [];
        this.panelOpen = false;
        this.messageText = null;
    }

    init(data) {
        // Phaser reuses this Scene instance after stop()/launch(). Reset all
        // room-lifetime state so a prior return cannot lock out later exits.
        this.exiting = false;
        this.targets = [];
        this.solids = [];
        this.panelObjects = [];
        this.panelOpen = false;
        this.messageText = null;
        this.messageTimer = null;
        this.saveTimer = null;
        this.location = INTERIOR_LOCATIONS.includes(data?.location)
            ? data.location : "hostel";
        const savedPosition = gameState.interiorPositions?.[this.location] || DEFAULT_INTERIOR_POSITIONS[this.location];
        const defaultPosition = DEFAULT_INTERIOR_POSITIONS[this.location];
        this.spawnPosition = {
            x: Phaser.Math.Clamp(Number(savedPosition?.x) || defaultPosition.x, 80, 720),
            y: Phaser.Math.Clamp(Number(savedPosition?.y) || defaultPosition.y, 100, 500)
        };
    }

    create() {
        ensureCharacterAnimations(this);
        const colors = { hostel: 0x9a7252, lab: 0x34495e, library: 0x7056a5, canteen: 0xb95e36, shop: 0x376a87 };
        this.add.rectangle(400, 300, 800, 600, 0x18232c);
        this.add.rectangle(400, 300, 760, 560, colors[this.location]).setStrokeStyle(8, 0xe7d7bd);
        this.add.rectangle(400, 300, 700, 500, 0xd6c39e);
        this.add.rectangle(400, 52, 700, 8, 0x573d34);
        this.add.rectangle(400, 548, 700, 8, 0x573d34);
        this.add.rectangle(52, 300, 8, 500, 0x573d34);
        this.add.rectangle(748, 300, 8, 500, 0x573d34);

        this.player = this.add.sprite(
            this.spawnPosition.x,
            this.spawnPosition.y,
            "cv-player", "d0f0"
        ).setDisplaySize(36, 48);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(22, 20).setOffset(5, 24);

        this.add.text(75, 68, this.location.toUpperCase(), {
            fontSize: "20px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#17212b", padding: { x: 8, y: 5 }
        });
        this.clockText = this.add.text(575, 68, formatGameClock(), {
            fontSize: "15px", color: "#ffffff", backgroundColor: "#17212b", padding: { x: 8, y: 5 }
        });
        this.clockText.setScrollFactor(0);
        this.clockListener = text => { if (this.clockText?.active) this.clockText.setText(text); };
        gameClockListeners.add(this.clockListener);
        this.add.text(340, 570, "E: interact  |  WASD: move  |  X / ESC: campus", {
            fontSize: "13px", color: "#ffffff", backgroundColor: "#17212b", padding: { x: 8, y: 4 }
        }).setOrigin(0.5);

        // Keep a visible, direct way back in every room. This avoids trapping
        // the player if they miss the door marker or load beside furniture.
        this.returnButton = this.add.rectangle(680, 112, 184, 38, 0x245b49)
            .setStrokeStyle(2, 0x9be7b0).setInteractive({ useHandCursor: true }).setDepth(10);
        this.returnButtonLabel = this.add.text(680, 112, "← RETURN TO CAMPUS", {
            fontSize: "12px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5).setDepth(11);
        this.returnButton.on("pointerdown", () => this.returnToCampus());
        this.returnButtonLabel.setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.returnToCampus());

        this.createExitDoor();
        this.createInteriorLayout();
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.escapeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard.on("keydown-ESC", () => {
            if (this.panelOpen) this.closePanel();
            else this.returnToCampus();
        });
        this.input.keyboard.on("keydown-X", () => this.returnToCampus());
        this.returnShortcutHandler = event => {
            if (event.key?.toLowerCase() !== "x" || this.exiting) return;
            event.preventDefault();
            this.returnToCampus();
        };
        globalThis.window?.addEventListener("keydown", this.returnShortcutHandler, true);
        this.interactionText = this.add.text(400, 525, "", {
            fontSize: "17px", color: "#ffffff", backgroundColor: "#17212b", padding: { x: 9, y: 6 }
        }).setOrigin(0.5);
        this.messageText = this.add.text(400, 490, "", {
            fontSize: "15px", color: "#e8f5e9", backgroundColor: "#17212b", padding: { x: 8, y: 5 }, align: "center"
        }).setOrigin(0.5);
        this.saveTimer = this.time.addEvent({ delay: 1000, callback: this.saveInteriorProgress, callbackScope: this, loop: true });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            globalThis.window?.removeEventListener("keydown", this.returnShortcutHandler, true);
            gameClockListeners.delete(this.clockListener);
            this.saveInteriorProgress();
        });
        this.saveInteriorProgress();
    }

    addSolid(x, y, width, height, color, label) {
        const object = this.add.rectangle(x, y, width, height, color).setStrokeStyle(2, 0x463b35);
        this.physics.add.existing(object, true);
        this.solids.push(object);
        if (this.player) this.physics.add.collider(this.player, object);
        if (label) this.add.text(x, y - height / 2 - 18, label, { fontSize: "13px", color: "#1e272e", fontStyle: "bold" }).setOrigin(0.5);
        return object;
    }

    addTarget(x, y, label, action, color = 0x2d6a4f) {
        const marker = this.add.circle(x, y, 10, color).setStrokeStyle(2, 0xffffff);
        this.targets.push({ x, y, label, action, marker });
        return marker;
    }

    createExitDoor() {
        this.add.rectangle(400, 520, 72, 36, 0x70452f).setStrokeStyle(3, 0xf3d29a);
        this.addTarget(400, 495, "Return to Campus", "exit", 0xf2cc60);
    }

    createInteriorLayout() {
        if (this.location === "hostel") {
            this.add.rectangle(180, 115, 125, 54, 0x86c5df).setStrokeStyle(4, 0xffffff);
            this.add.text(180, 115, "WINDOW", { fontSize: "13px", color: "#173042" }).setOrigin(0.5);
            this.addSolid(205, 220, 190, 95, 0x526c82, "BED");
            this.add.rectangle(205, 220, 165, 34, 0xf0f4f8);
            this.addSolid(540, 265, 190, 56, 0x76563c, "");
            this.add.text(540, 230, "STUDY TABLE", { fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
            this.add.rectangle(530, 190, 48, 28, 0x243744).setStrokeStyle(3, 0x8dd7ff);
            this.add.rectangle(530, 190, 36, 17, 0x2a9d8f);
            this.addSolid(690, 350, 75, 100, 0x6d4c41, "CUPBOARD");
            this.addSolid(390, 325, 70, 52, 0x574238, "CHAIR");
            this.addTarget(205, 275, "Bed: sleep until 6:00 AM", "sleep", 0xf2cc60);
            this.addTarget(530, 215, "Study computer: read a booklet", "booklet", 0x53a8d6);
        } else if (this.location === "lab") {
            this.addSolid(400, 110, 360, 48, 0xf4f1de, "PROGRAMMING LAB — DEBUG, BUILD, LEARN");
            this.add.text(400, 110, "C  |  C++  |  DATA STRUCTURES", { fontSize: "15px", color: "#234", fontStyle: "bold" }).setOrigin(0.5);
            [[190, 245], [400, 245], [610, 245]].forEach(([x, y], i) => {
                this.addSolid(x, y, 150, 55, 0x76563c, `WORKSTATION ${i + 1}`);
                this.add.rectangle(x, y - 38, 70, 40, 0x263746).setStrokeStyle(3, 0x7cffb2);
                this.add.rectangle(x, y - 38, 55, 25, 0x1b6b64);
                this.addTarget(x, y + 15, `Workstation ${i + 1}: run a C DSA exercise`, "labStation", 0x2d6a4f);
            });
            this.addSolid(200, 400, 145, 75, 0x416a7d, "ASSISTANT DESK");
            this.add.sprite(200, 330, "cv-assistant", "d0f0").setDisplaySize(38, 48).setDepth(2);
            this.add.text(200, 292, "LAB ASSISTANT", {
                fontSize: "12px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#34495e", padding: { x: 6, y: 3 }
            }).setOrigin(0.5).setDepth(3);
            this.addTarget(200, 370, "Ask the Lab Assistant", "assistant", 0x38a3a5);
            this.addTarget(540, 400, "Read the DSA wall chart", "booklet", 0x53a8d6);
        } else if (this.location === "library") {
            [155, 325, 495, 645].forEach((x, i) => {
                this.addSolid(x, 145, 105, 100, [0x704b35, 0x5c4737, 0x704b35, 0x5c4737][i], "BOOKS");
                this.addTarget(x, 205, "Browse DSA booklets", "booklet", 0x53a8d6);
            });
            [[220, 340], [420, 340], [620, 340]].forEach(([x, y], i) => {
                this.addSolid(x, y, 140, 48, 0x76563c, `STUDY TABLE ${i + 1}`);
            });
            this.addTarget(420, 400, "Research desk: open a DSA exercise", "labStation", 0x2d6a4f);
        } else if (this.location === "canteen") {
            this.addSolid(520, 145, 300, 64, 0xb25d35, "FOOD COUNTER");
            this.add.sprite(620, 142, "cv-shopkeeper", "d0f0").setDisplaySize(40, 50).setDepth(2);
            this.add.text(620, 105, "CANTEEN KEEPER", {
                fontSize: "12px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#34495e", padding: { x: 6, y: 3 }
            }).setOrigin(0.5).setDepth(3);
            this.addTarget(400, 190, "Order food from the canteen", "canteenShop", 0xe9a23b);
            [[180, 315], [400, 315], [620, 315]].forEach(([x, y], i) => {
                this.addSolid(x, y, 125, 55, 0x76563c, `TABLE ${i + 1}`);
            });
            this.addTarget(620, 210, "Talk to the Canteen Keeper", "canteenNpc", 0x38a3a5);
        } else {
            this.addSolid(400, 145, 320, 65, 0x536b7a, "");
            this.add.sprite(400, 91, "cv-shopkeeper", "d0f0").setDisplaySize(42, 54).setDepth(2);
            this.add.text(400, 58, "SHOPKEEPER", {
                fontSize: "13px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#34495e", padding: { x: 7, y: 4 }
            }).setOrigin(0.5).setDepth(3);
            this.addTarget(400, 220, "Shopkeeper: browse wares", "shop", 0xe9a23b);
            [[180, 300], [620, 300]].forEach(([x, y], i) => {
                this.addSolid(x, y, 120, 100, 0x6b8794, i === 0 ? "BOOKS" : "SUPPLIES");
            });
        }
    }

    saveInteriorProgress() {
        if (!this.exiting) gameState.location = this.location;
        if (this.player) {
            gameState.interiorX = this.player.x;
            gameState.interiorY = this.player.y;
            gameState.interiorPositions ||= {};
            gameState.interiorPositions[this.location] = { x: this.player.x, y: this.player.y };
        }
        const campus = this.scene.get("GameScene");
        if (campus && campus.saveProgress) campus.saveProgress();
        else persistGameState();
    }

    showMessage(message) {
        this.messageText?.setText(message);
        if (this.messageTimer) this.messageTimer.remove(false);
        this.messageTimer = this.time.delayedCall(3500, () => this.messageText?.setText(""));
    }

    showPanel(title, body) {
        this.closePanel();
        this.panelOpen = true;
        const add = object => { object.setDepth(100); this.panelObjects.push(object); return object; };
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.92));
        add(this.add.rectangle(400, 300, 650, 465, 0x182b35).setStrokeStyle(3, 0x7cffb2));
        add(this.add.text(400, 105, title, { fontSize: "25px", color: "#7cffb2", fontStyle: "bold", align: "center" }).setOrigin(0.5));
        add(this.add.text(110, 150, body, { fontSize: "17px", color: "#ffffff", lineSpacing: 7, wordWrap: { width: 580 } }));
        const close = add(this.add.text(400, 505, "Close  [ESC]", { fontSize: "16px", color: "#c8d6e5" }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        close.on("pointerdown", () => this.closePanel());
        return add;
    }

    closePanel() {
        this.panelObjects.forEach(object => object?.destroy?.());
        this.panelObjects = [];
        this.panelOpen = false;
    }

    showBooklet(topic = "linked") {
        const booklets = {
            linked: ["LINKED LISTS", "A linked list stores values in nodes connected by pointers.", "Each node contains data and a link to the next node. The head points to the first node; the last node points to NULL.", "Insertion changes links. Traversal follows next pointers until NULL. Lists can grow without moving a whole array."],
            hash: ["HASH TABLES", "A hash function maps a key to an array index.", "Collisions happen when keys map to the same slot. Linear probing checks later slots until it finds the key or an empty slot.", "Cipher Valley uses this C implementation for inventory item lookup."],
            stack: ["STACKS", "A stack follows Last In, First Out (LIFO).", "Push adds an item at the top. Pop removes the newest item. Peek reads the top without removing it.", "The campus action history uses a C stack."],
            queue: ["QUEUES", "A queue follows First In, First Out (FIFO).", "Enqueue adds to the rear. Dequeue removes from the front. A circular queue reuses freed array slots.", "The laboratory task scheduler uses a C circular queue."],
            tree: ["BINARY SEARCH TREES", "A tree has a root, parent and child links, and leaves with no children.", "In a binary search tree, smaller values go left and larger values go right.", "Inorder traversal visits Left, Root, Right and returns values in sorted order."],
            debugging: ["DEBUGGING CHECKLIST", "Read the failing behavior and trace its inputs.", "Check boundary conditions, pointer validity, loop progress, and state changes.", "Change the smallest relevant piece, then verify with more than one input."],
            c: ["C PROGRAMMING", "C gives direct control over data representation and memory.", "A struct groups fields. Pointers refer to objects. Always validate pointers before dereferencing them.", "When using dynamic memory, pair allocations with frees and handle allocation failure."]
        };
        const [title, ...paragraphs] = booklets[topic] || booklets.linked;
        this.showPanel(title, paragraphs.map(p => "• " + p).join("\n\n"));
    }

    openLabStation() {
        const campus = this.scene.get("GameScene");
        const add = this.showPanel("C DSA WORKSTATION", "Run one operation against the compiled C data structures. Each station also has a booklet and a small concept check.");
        const actions = [
            ["Linked List", () => this.practiceStructure("linked")],
            ["Hash Table", () => this.practiceStructure("hash")],
            ["Stack", () => this.practiceStructure("stack")],
            ["Queue", () => this.practiceStructure("queue")],
            ["Binary Tree", () => this.practiceStructure("tree")],
            ["Read the Booklets", () => this.showBooklet("linked")]
        ];
        actions.forEach(([label, callback], index) => {
            const button = add(this.add.rectangle(400, 225 + index * 45, 390, 34, 0x263746).setStrokeStyle(1, 0x7cffb2).setInteractive({ useHandCursor: true }));
            const text = add(this.add.text(400, 225 + index * 45, label, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5));
            button.on("pointerdown", () => { this.closePanel(); callback(); });
            text.setInteractive({ useHandCursor: true }).on("pointerdown", () => { this.closePanel(); callback(); });
        });
    }

    practiceStructure(kind) {
        const names = { linked: "Linked List", hash: "Hash Table", stack: "Stack", queue: "Queue", tree: "Binary Search Tree" };
        const explanations = {
            linked: "Add a quest node, complete it, then traverse the C list to read its count.",
            hash: "Insert Lab Token and search the inventory by key in the C hash table.",
            stack: "Push a lab action, peek at the top, then pop it from the C stack.",
            queue: "Enqueue a lab task, inspect the front, then process it from the C queue.",
            tree: "Insert 40, 20, 60, 10, 30 into the C tree and read its inorder traversal."
        };
        const add = this.showPanel(names[kind].toUpperCase(), explanations[kind]);
        const output = add(this.add.text(115, 275, "Run the operation to inspect the C result.", {
            fontSize: "16px", color: "#b6e5ff", wordWrap: { width: 570 }
        }));
        const run = add(this.add.rectangle(400, 350, 300, 42, 0x245b49).setStrokeStyle(2, 0x7cffb2).setInteractive({ useHandCursor: true }));
        add(this.add.text(400, 350, "Run C operation", { fontSize: "17px", color: "#ffffff" }).setOrigin(0.5));
        run.on("pointerdown", () => {
            try {
                let result = "";
                if (kind === "linked") {
                    const id = 9001;
                    linkedListModule.ccall("addQuest", "number", ["number", "string"], [id, "Lab pointer exercise"]);
                    linkedListModule.ccall("completeQuest", "number", ["number"], [id]);
                    result = `C linked-list traversal reports ${linkedListModule.ccall("getQuestCount", "number", [], [])} quest nodes; exercise node ${id} is completed.`;
                } else if (kind === "hash") {
                    hashTableModule.ccall("insertItem", null, ["string", "number", "string"], ["Lab Token", 1, "Created at the lab workstation."]);
                    result = `Hash lookup for Lab Token returns quantity ${hashTableModule.ccall("searchItemQuantity", "number", ["string"], ["Lab Token"])}.`;
                } else if (kind === "stack") {
                    stackModule.ccall("stackPush", "number", ["string"], ["Lab: inspect stack top"]);
                    const top = stackModule.ccall("stackPeekAction", "string", [], []);
                    const removed = stackModule.ccall("stackPopAction", "string", [], []);
                    result = `Peek returned “${top}”; pop removed “${removed}”. The newest action is first.`;
                } else if (kind === "queue") {
                    queueModule.ccall("queueAddTask", "number", ["string"], ["Run lab task"]);
                    const front = queueModule.ccall("queuePeekTask", "string", [], []);
                    const removed = queueModule.ccall("queueProcessNextTask", "string", [], []);
                    result = `Front was “${front}”; processing removed “${removed}”. The oldest task runs first.`;
                } else {
                    treeModule.ccall("treeReset", null, [], []);
                    [40, 20, 60, 10, 30].forEach(value => treeModule.ccall("treeInsert", "number", ["number"], [value]));
                    const values = Array.from({ length: treeModule.ccall("treeGetCount", "number", [], []) }, (_, i) => treeModule.ccall("treeGetInorderAt", "number", ["number"], [i]));
                    result = `C tree traversal returned ${values.join(", ")}. Why does inorder visit left subtree, root, then right subtree?`;
                }
                output.setText(result);
                this.saveInteriorProgress();
            } catch (error) {
                output.setText("The C module did not complete the operation. Check the browser console and rebuild the modules.");
                console.error("C DSA workstation operation failed:", error);
            }
        });
        const booklet = add(this.add.text(400, 420, `Read the ${names[kind]} booklet`, { fontSize: "16px", color: "#7cffb2" }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
        booklet.on("pointerdown", () => this.showBooklet(kind));
    }

    purchaseItem(name, price, description) {
        if (gameState.coins < price) {
            this.showMessage(`You need ${price} coins. You have ${gameState.coins}.`);
            return;
        }
        const world = worldModule;
        const inventory = hashTableModule;
        if (!world || !inventory) {
            this.showMessage("The C++ Item or C inventory module is unavailable.");
            return;
        }
        const cppAdded = world.ccall("worldAddItem", "number", ["string", "number", "string"], [name, 1, description]);
        if (!cppAdded) return this.showMessage("The C++ Item system could not add that item.");
        inventory.ccall("insertItem", null, ["string", "number", "string"], [name, 1, description]);
        gameState.coins -= price;
        if (name === "Notebook" && gameState.notebookQuestAccepted && !gameState.notebookQuestCompleted) {
            const campus = this.scene.get("GameScene");
            campus?.completeQueuedTask("Collect Notebook");
            campus?.enqueueGameTask("Return Notebook to Mentor");
            campus?.recordGameAction("Collected Notebook from the campus shop");
        }
        this.showMessage(`${name} added to the C++ Item and C hash-table inventories. Coins left: ${gameState.coins}.`);
        this.saveInteriorProgress();
    }

    openShop(canteen = false) {
        const sellerIndex = 2;
        const greeting = worldModule?.ccall("worldNpcMessage", "string", ["number"], [sellerIndex]) || "Welcome to the campus shop.";
        const add = this.showPanel(canteen ? "CANTEEN COUNTER" : "CAMPUS SHOP", `${greeting}\n\nYour coins: ${gameState.coins}\nItems are recorded by the C++ Item class and the C hash-table inventory.`);
        const notebookQuantity = hashTableModule?.ccall("searchItemQuantity", "number", ["string"], ["Notebook"]) || 0;
        const notebookPrice = gameState.notebookQuestAccepted && !gameState.notebookQuestCompleted && notebookQuantity === 0 ? 0 : 10;
        const offers = canteen
            ? [["Snack", 8, "A canteen snack. Restores 10 energy."], ["Coffee", 12, "Fresh canteen coffee. Restores 20 energy."]]
            : [["Notebook", notebookPrice, notebookPrice === 0 ? "Quest notebook · collected free for the Mentor." : "A notebook for recording programming ideas."], ["Energy Drink", 15, "Restores player energy when used."]];
        offers.forEach((offer, index) => {
            const y = 315 + index * 55;
            const button = add(this.add.rectangle(400, y, 390, 40, 0x245b49).setStrokeStyle(1, 0x7cffb2).setInteractive({ useHandCursor: true }));
            const priceLabel = offer[1] === 0 ? "FREE" : `${offer[1]} coins`;
            const text = add(this.add.text(400, y, `${offer[0]}  —  ${priceLabel}`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5));
            button.on("pointerdown", () => { this.purchaseItem(...offer); this.closePanel(); });
            text.setInteractive({ useHandCursor: true }).on("pointerdown", () => { this.purchaseItem(...offer); this.closePanel(); });
        });
    }

    interact(target) {
        if (target.action === "exit") {
            this.returnToCampus();
            return;
        }
        if (target.action === "sleep") {
            const current = Number(gameState.gameMinutes) || 0;
            const minutesUntilSix = current < 360 ? 360 - current : 1440 - current + 360;
            const dayAdvance = Math.floor((current + minutesUntilSix) / 1440);
            gameState.gameMinutes = 360;
            gameState.gameDay += Math.max(1, dayAdvance);
            cppPlayerModule?.ccall("playerRestoreEnergy", null, ["number"], [100]);
            this.clockText.setText(formatGameClock());
            this.showMessage("You slept well. It is 6:00 AM and your energy is full.");
            this.saveInteriorProgress();
        } else if (target.action === "booklet") {
            this.showBooklet(this.location === "lab" ? "debugging" : this.location === "library" ? "tree" : "c");
        } else if (target.action === "labStation") {
            this.openLabStation();
        } else if (target.action === "assistant") {
            const message = worldModule?.ccall("worldNpcMessage", "string", ["number"], [1]) || "The C data-structure workstations are ready.";
            this.showMessage(message);
        } else if (target.action === "canteenNpc") {
            this.showMessage(worldModule?.ccall("worldNpcMessage", "string", ["number"], [2]) || "Fresh food is ready.");
        } else if (target.action === "canteenShop") {
            this.openShop(true);
        } else if (target.action === "shop") {
            this.scene.get("GameScene")?.logCppNpcInteraction(2);
            this.openShop(false);
        }
    }

    returnToCampus() {
        if (this.exiting) return;
        this.exiting = true;
        this.saveInteriorProgress();
        gameState.location = "campus";
        const campus = this.scene.get("GameScene");
        if (campus) {
            // GameScene keeps running behind this room. Consume the exit E edge
            // there before resuming it, or it can trigger a campus NPC too.
            if (campus.interactKey) Phaser.Input.Keyboard.JustDown(campus.interactKey);
            campus.currentLocation = "campus";
            campus.interiorActive = false;
            campus.minimapPanel?.setVisible(true);
            campus.minimapLabel?.setVisible(true);
            campus.minimapGraphic?.setVisible(true);
            campus.suppressNextInteraction = true;
            campus.recordGameAction(`Left ${this.location}`);
            campus.saveProgress();
        } else {
            persistGameState();
        }
        this.scene.stop("InteriorScene");
    }

    update() {
        if (this.panelOpen) {
            this.player.body.setVelocity(0);
            if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) this.closePanel();
            return;
        }
        this.player.body.setVelocity(0);
        if (this.keys.A.isDown) this.player.body.setVelocityX(-190);
        if (this.keys.D.isDown) this.player.body.setVelocityX(190);
        if (this.keys.W.isDown) this.player.body.setVelocityY(-190);
        if (this.keys.S.isDown) this.player.body.setVelocityY(190);
        this.player.body.velocity.normalize().scale(190);
        updatePlayerAnimation(this.player, this.player.body.velocity.x, this.player.body.velocity.y);
        const nearest = this.targets.map(target => ({
            ...target,
            distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y)
        })).filter(target => target.distance < 72).sort((a, b) => a.distance - b.distance)[0];
        this.interactionText.setText(nearest ? `E  ${nearest.label}` : "");
        if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) this.interact(nearest);
    }
}


// ==========================================
// GAME CONFIGURATION
// ==========================================

const config = {

    type: Phaser.AUTO,

    parent: "game-container",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    width: 800,

    height: 600,

    backgroundColor: "#222222",

    physics: {

        default: "arcade",

        arcade: {
            debug: false
        }

    },

    scene: [BootScene, PrologueScene, GameScene, InteriorScene]

};


// ==========================================
// START GAME
// ==========================================

const game = new Phaser.Game(config);
