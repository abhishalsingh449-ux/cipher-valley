

// ==========================================
// C++ PLAYER MODULE
// ==========================================
const SAVE_KEY = "cipher-valley-save-v1";

function loadGameState() {
    const defaults = {
        version: 1,
        location: "hostel",
        campusX: 400,
        campusY: 300,
        gameMinutes: 360,
        gameDay: 1,
        playerXP: 0,
        playerEnergy: 100,
        coins: 50,
        interiorX: 260,
        interiorY: 300,
        questCompleted: false,
        coffeeQuestAccepted: false,
        coffeeQuestCompleted: false,
        notebookQuestAccepted: false,
        notebookQuestCompleted: false,
        treeChallengeCompleted: false,
        labPracticeCompleted: {},
        debugQuestCompleted: {},
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
        return {
            ...defaults,
            ...saved,
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

const gameState = loadGameState();

function persistGameState() {
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
    ["pagehide", "beforeunload"].forEach(eventName => window.addEventListener(eventName, () => {
        if (activeGameScene) activeGameScene.saveProgress();
        else persistGameState();
    }));
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
                    "LEVEL " + this.playerLevel + "  |  XP " + this.playerTotalXP + "\nENERGY " + this.playerEnergy + "/100  |  Hold SHIFT to sprint"
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
                    ? "Main Quest: Coffee Crisis — " + (this.coffeeQuestAccepted ? "ACTIVE" : "START HERE")
                    : this.questCompleted
                        ? "Quest: Linked List — COMPLETED"
                        : "Quest: Linked List — ACTIVE"
            );
        }
        if (this.coffeeQuestStatusText) {
            this.coffeeQuestStatusText.setText(
                this.coffeeQuestCompleted
                    ? "Coffee Crisis: COMPLETED"
                    : this.coffeeQuestAccepted
                        ? "Coffee Crisis: Repair the vending machine"
                        : "Coffee Crisis: Talk to your friend"
            );
        }

        if (this.xpText) {

            this.xpText.setText(
                "Total XP: " + this.dsaXP
            );

        }

        if (this.notebookQuestStatusText) {
            this.notebookQuestStatusText.setText(
                this.notebookQuestCompleted
                    ? "Quest: Notebook — COMPLETED"
                    : this.notebookQuestAccepted
                        ? "Quest: Notebook — ACTIVE"
                        : "Quest: Notebook — LOCKED"
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
        const box = this.add.rectangle(400, 470, 590, 42, 0x10251d, 0.96).setStrokeStyle(1, 0x7cffb2).setDepth(30);
        const text = this.add.text(400, 470, message, {
            fontSize: "15px", color: "#ffffff", align: "center", wordWrap: { width: 560 }
        }).setOrigin(0.5).setDepth(31);
        this.time.delayedCall(2600, () => { box.destroy(); text.destroy(); });
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
        const add = (obj) => { obj.setDepth(60); this.integrationPanelObjects.push(obj); return obj; };
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
            obj.setDepth(40);
            this.inventoryObjects.push(obj);
            return obj;
        };

        add(this.add.rectangle(400, 300, 800, 600, 0x101820, 0.97));
        add(this.add.text(400, 48, "CIPHER VALLEY — INVENTORY", {
            fontSize: "28px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 84, "C hash table inventory + C++ Item objects", {
            fontSize: "16px", color: "#b8d8d8"
        }).setOrigin(0.5));

        this.inventoryListText = add(this.add.text(95, 130, "Loading C inventory...", {
            fontSize: "18px", color: "#ffffff", lineSpacing: 8,
            wordWrap: { width: 610 }
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
        button(400, 555, "Close  [I / Esc]", () => this.closeInventory());

        this.inventoryExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
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
            const lines = ["ITEMS STORED IN THE C HASH TABLE", ""];
            for (let i = 0; i < count; i++) {
                const name = module.ccall("getItemNameAt", "string", ["number"], [i]);
                const quantity = module.ccall("getItemQuantityAt", "number", ["number"], [i]);
                const description = module.ccall("getItemDescriptionAt", "string", ["number"], [i]);
                lines.push((i + 1) + ". " + name + "  × " + quantity);
                lines.push("   " + description);
                lines.push("");
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
            obj.setDepth(60);
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
            "I need a notebook for our next DSA lesson. Visit the campus shop, collect one, then return to me.",
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
                            "Find the Shopkeeper, press E, and collect a Notebook. Return to the Mentor afterward.",
                            [{ label: "Let's go!", callback: () => {} }]
                        );
                    }
                },
                { label: "Later", callback: () => {} }
            ]
        );
    }

    async interactWithMentor() {
        // The opening story quest teaches interaction and code repair before DSA training.
        if (!this.coffeeQuestCompleted) {
            this.showQuestDialogue(
                "MENTOR",
                "Welcome to Cipher Valley — a campus where every broken machine hides a programming lesson. The coding festival begins tonight, but the hostel vending machine has failed and your friend is counting on you. Repair it first; then I will teach you how to turn data structures into tools, not just textbook definitions.",
                [{ label: "I'll do it", callback: () => {} }]
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
                    "You haven't collected a Notebook yet. Visit the Shopkeeper, press E, and collect one from the campus shop.",
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
            Phaser.Input.Keyboard.KeyCodes.I
        ];
        this.input.keyboard.removeCapture(this.coffeeReleasedKeyCapture);
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);
        this.coffeeOverlayElements = [];

        const add = (obj) => {
            obj.setDepth(80);
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

        // CAMPUS BACKGROUND
        this.campusBackground = this.add.rectangle(
            400, 300, 800, 600,
            0x3a7d44
        );

        // CAMPUS PATHS
        this.add.rectangle(
            400, 300, 800, 70,
            0xc2a878
        );

        this.add.rectangle(
            500, 300, 70, 600,
            0xc2a878
        );

        // PROGRAMMING LAB
        this.lab = this.add.rectangle(
            200, 150, 220, 120,
            0x555555
        );

        this.add.text(
            125, 135,
            "PROGRAMMING LAB",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );

        // HOSTEL
        this.hostel = this.add.rectangle(
            650, 150, 180, 120,
            0x8b5a2b
        );

        this.add.text(
            600, 135,
            "HOSTEL",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );

        this.hostelDoor = this.add.circle(650, 226, 8, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.labDoor = this.add.circle(200, 226, 8, 0xf2cc60).setStrokeStyle(2, 0xffffff);

        // Additional campus facilities with their own playable interiors.
        this.library = this.add.rectangle(130, 455, 155, 100, 0x7056a5).setStrokeStyle(3, 0xd8c7ff);
        this.add.text(83, 445, "LIBRARY", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
        this.libraryDoor = this.add.circle(130, 512, 8, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.canteen = this.add.rectangle(400, 455, 155, 100, 0xb95e36).setStrokeStyle(3, 0xffd3a8);
        this.add.text(356, 445, "CANTEEN", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
        this.canteenDoor = this.add.circle(400, 512, 8, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.campusShop = this.add.rectangle(670, 500, 155, 85, 0x376a87).setStrokeStyle(3, 0xb6e5ff);
        this.add.text(630, 480, "CAMPUS SHOP", { fontSize: "14px", color: "#ffffff", fontStyle: "bold" });
        this.shopDoor = this.add.circle(670, 552, 8, 0xf2cc60).setStrokeStyle(2, 0xffffff);
        this.treeGarden = this.add.rectangle(400, 105, 170, 70, 0x2c6e49).setStrokeStyle(2, 0x8be0a6);
        this.add.text(345, 97, "TREE GARDEN", { fontSize: "15px", color: "#ffffff", fontStyle: "bold" });
        [315, 350, 455, 490].forEach(x => this.add.circle(x, 95, 12, 0x174f2b).setStrokeStyle(2, 0x80c783));
        [[70, 100], [80, 325], [285, 510], [520, 510], [590, 260]].forEach(([x, y]) => {
            this.add.circle(x, y, 15, 0x245b36).setStrokeStyle(2, 0x9acb72);
            this.add.rectangle(x, y + 20, 6, 15, 0x72512e);
        });
        [[300, 385], [520, 385]].forEach(([x, y]) => {
            this.add.rectangle(x, y, 62, 11, 0x8d6748).setStrokeStyle(2, 0x533f32);
            this.add.rectangle(x, y + 12, 52, 5, 0x614832);
        });

        // PLAYER
        this.player = this.add.sprite(
            Phaser.Math.Clamp(Number(gameState.campusX) || 400, 25, 775),
            Phaser.Math.Clamp(Number(gameState.campusY) || 300, 25, 575),
            "cv-player", "d0f0"
        ).setDisplaySize(40, 48);
        activeGameScene = this;

        // PLAYER PHYSICS
        this.physics.add.existing(this.player);

        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(22, 20).setOffset(5, 24);

        // MENTOR NPC
        this.npc = this.add.sprite(600, 350, "cv-mentor", "d0f0").setDisplaySize(38, 48);

        this.add.text(
            570, 375,
            "MENTOR",
            {
                fontSize: "16px",
                color: "#ffffff"
            }
        );

        // SHOPKEEPER NPC — Notebook quest item source
        this.shopkeeper = this.add.sprite(200, 400, "cv-shopkeeper", "d0f0").setDisplaySize(38, 48);

        this.add.text(
            150, 425,
            "SHOPKEEPER",
            {
                fontSize: "15px",
                color: "#ffffff"
            }
        );

        // LAB ASSISTANT — backed by the C++ LabAssistant class.
        this.labAssistant = this.add.sprite(330, 220, "cv-assistant", "d0f0").setDisplaySize(34, 44);
        this.add.text(292, 241, "LAB ASSISTANT", {
            fontSize: "11px", color: "#ffffff", fontStyle: "bold"
        });

        // FRIEND NPC — introduces the mandatory opening quest.
        this.friend = this.add.sprite(330, 300, "cv-friend", "d0f0").setDisplaySize(36, 46);
        this.add.text(300, 325, "FRIEND", {
            fontSize: "14px", color: "#ffffff"
        });

        // VENDING MACHINE — major interactive object with a real code-repair challenge.
        this.vendingMachine = this.add.rectangle(700, 390, 58, 78, 0x273746)
            .setStrokeStyle(3, 0x57cc99);
        this.add.rectangle(700, 377, 38, 28, 0x5dade2);
        this.add.rectangle(700, 410, 38, 20, 0x17202a);
        this.add.text(665, 440, "VENDING", {
            fontSize: "14px", color: "#ffffff", fontStyle: "bold"
        });
        this.vendingStatus = this.add.text(660, 455, this.coffeeQuestCompleted ? "ONLINE" : "ERROR", {
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
        this.physics.add.existing(this.shopkeeper, true);
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
        this.physics.add.collider(this.player, this.shopkeeper);
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
        this.interactionDistance = 80;

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
        this.interactionBox = this.add.rectangle(
            400, 520, 300, 55,
            0x000000
        );

        this.interactionBox.setAlpha(0.85);
        this.interactionBox.setDepth(10);

        // INTERACTION TEXT
        this.interactionText = this.add.text(
            400, 520, "",
            {
                fontSize: "20px",
                color: "#ffffff"
            }
        );

        this.interactionText.setOrigin(0.5);
        this.interactionText.setDepth(11);

        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        // QUEST STATUS HUD
        this.questStatusText = this.add.text(
            15, 15,
            "Quest: Linked List — ACTIVE",
            {
                fontSize: "16px",
                color: "#ffffff",
                backgroundColor: "#000000",
                padding: {
                    x: 8,
                    y: 6
                }
            }
        );

        this.questStatusText.setDepth(5);

        // XP HUD
        this.xpText = this.add.text(
            15, 55,
            "Total XP: 0",
            {
                fontSize: "16px",
                color: "#ffffff",
                backgroundColor: "#000000",
                padding: {
                    x: 8,
                    y: 6
                }
            }
        );

        this.xpText.setDepth(5);

        this.notebookQuestStatusText = this.add.text(
            15, 95,
            "Quest: Notebook — LOCKED",
            {
                fontSize: "16px",
                color: "#ffffff",
                backgroundColor: "#000000",
                padding: { x: 8, y: 6 }
            }
        );
        this.notebookQuestStatusText.setDepth(5);

        this.inventoryHintText = this.add.text(15, 135, "Press I: Inventory", {
            fontSize: "15px", color: "#ffffff", backgroundColor: "#000000",
            padding: { x: 8, y: 5 }
        });
        this.inventoryHintText.setDepth(5);

        this.treeHintText = this.add.text(15, 215, "Press T: Tree DSA Training", {
            fontSize: "14px", color: "#7CFFB2", backgroundColor: "#10251d",
            padding: { x: 8, y: 5 }
        });
        this.treeHintText.setDepth(5);

        this.integrationHintText = this.add.text(15, 245, "H: History | Q: Tasks | B: Debug Quests", {
            fontSize: "14px", color: "#d8f4e6", backgroundColor: "#10251d", padding: { x: 8, y: 5 }
        });
        this.integrationHintText.setDepth(5);
        this.historyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.taskQueueKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.integrationExitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Continuous campus clock: one game minute per two real seconds.
        this.gameMinutes = Phaser.Math.Clamp(Number(gameState.gameMinutes ?? 360), 0, 1439);
        this.gameDay = Math.max(1, Number(gameState.gameDay) || 1);
        this.gameClockText = this.add.text(520, 80, formatGameClock(), {
            fontSize: "16px", color: "#ffffff", backgroundColor: "#263238",
            padding: { x: 8, y: 6 }
        });
        this.gameClockText.setDepth(5);
        this.gameClockListener = (timeText) => {
            this.gameMinutes = gameState.gameMinutes;
            this.gameDay = gameState.gameDay;
            if (this.gameClockText?.active) this.gameClockText.setText(timeText);
            this.updateWorldLighting?.();
        };
        gameClockListeners.add(this.gameClockListener);
        startGameClock();

        this.coffeeQuestStatusText = this.add.text(15, 175, "Coffee Crisis: Talk to your friend", {
            fontSize: "14px", color: "#ffffff", backgroundColor: "#000000",
            padding: { x: 8, y: 5 }
        });
        this.coffeeQuestStatusText.setDepth(5);

        this.playerStatsText = this.add.text(520, 15, "Loading C++ Player...", {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 8, y: 6 },
            lineSpacing: 4
        });
        this.playerStatsText.setDepth(5);
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

        this.autoSaveTimer = this.time.addEvent({ delay: 1000, callback: this.saveProgress, callbackScope: this, loop: true });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.saveProgress();
            gameClockListeners.delete(this.gameClockListener);
            if (activeGameScene === this) activeGameScene = null;
        });
        this.saveProgress();
        if (gameState.location !== "campus") {
            this.interiorActive = true;
            this.scene.launch("InteriorScene", { location: gameState.location });
        }
    }

    saveProgress() {
        if (this.player) {
            gameState.campusX = this.player.x;
            gameState.campusY = this.player.y;
        }
        gameState.questCompleted = !!this.questCompleted;
        gameState.coffeeQuestAccepted = !!this.coffeeQuestAccepted;
        gameState.coffeeQuestCompleted = !!this.coffeeQuestCompleted;
        gameState.notebookQuestAccepted = !!this.notebookQuestAccepted;
        gameState.notebookQuestCompleted = !!this.notebookQuestCompleted;
        gameState.treeChallengeCompleted = !!this.treeChallengeCompleted;
        gameState.debugQuestCompleted = { ...this.debugQuestCompleted };
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
    showDebugQuestBoard() {
        if (this.debugQuestOpen || this.treeChallengeOpen || this.dsaOpen ||
            this.inventoryOpen || this.questDialogueOpen || this.coffeeChallengeOpen) return;
        this.debugQuestOpen = true;
        this.player.body.setVelocity(0);
        this.recordGameAction("Opened Debug Quest Board");
        if (Object.keys(this.debugQuestCompleted).length < 4) this.enqueueGameTask("Complete a debugging side quest");
        this.debugQuestObjects = [];
        const add = (obj) => {
            obj.setDepth(120);
            this.debugQuestObjects.push(obj);
            return obj;
        };
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.96));
        add(this.add.rectangle(400, 300, 650, 480, 0x152b35, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 85, "DEBUGGING QUEST BOARD", {
            fontSize: "25px", color: "#7CFFB2", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 120, "Help the campus team fix four small code issues. Each quest pays +10 XP.", {
            fontSize: "15px", color: "#d8f4e6", align: "center", wordWrap: { width: 570 }
        }).setOrigin(0.5));
        const quests = [
            { id: "null", title: "1. NULL Pointer", detail: "A linked-list head is NULL. What should you do before reading head->next?",
                options: ["Check head != NULL", "Call free(head)", "Use head->next first"], correct: 0,
                success: "Good safety check! Always validate a pointer before dereferencing it." },
            { id: "loop", title: "2. Infinite Loop", detail: "A loop never ends because i stays at 0. What is missing?",
                options: ["An update such as i++", "Another printf", "A larger array"], correct: 0,
                success: "Correct! Loop control needs an update that moves toward the stopping condition." },
            { id: "hash", title: "3. Hash Collision", detail: "Two items map to the same hash-table index. What is a common fix?",
                options: ["Linear probing", "Delete the whole table", "Always use index 0"], correct: 0,
                success: "Correct! Linear probing checks later slots until a suitable one is found." },
            { id: "condition", title: "4. Broken Condition", detail: "A vending machine should work only when stock > 0. Which condition is right?",
                options: ["stock > 0", "stock < 0", "stock == -1"], correct: 0,
                success: "Fixed! A clear condition prevents the machine from serving an empty slot." }
        ];
        quests.forEach((quest, i) => {
            const y = 175 + i * 72;
            const done = !!this.debugQuestCompleted[quest.id];
            const button = add(this.add.rectangle(400, y, 540, 54, done ? 0x245b49 : 0x263746)
                .setStrokeStyle(1, 0x7CFFB2).setInteractive({ useHandCursor: !done }));
            const label = add(this.add.text(400, y, done ? quest.title + "  ✓ COMPLETED" : quest.title, {
                fontSize: "17px", color: done ? "#7CFFB2" : "#ffffff", align: "center"
            }).setOrigin(0.5));
            if (!done) button.on("pointerdown", () => this.showDebugQuestQuestion(quest));
        });
        add(this.add.text(400, 475, "Press B or ESC to close", {
            fontSize: "15px", color: "#b8c7d9"
        }).setOrigin(0.5));
    }

    showDebugQuestQuestion(quest) {
        if (!this.debugQuestOpen || this.debugQuestCompleted[quest.id]) return;
        this.debugQuestObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        this.debugQuestObjects = [];
        const add = (obj) => {
            obj.setDepth(125);
            this.debugQuestObjects.push(obj);
            return obj;
        };
        add(this.add.rectangle(400, 300, 800, 600, 0x071019, 0.97));
        add(this.add.rectangle(400, 300, 650, 430, 0x152b35, 1).setStrokeStyle(3, 0x57cc99));
        add(this.add.text(400, 125, quest.title, {
            fontSize: "24px", color: "#7CFFB2", fontStyle: "bold"
        }).setOrigin(0.5));
        add(this.add.text(400, 185, quest.detail, {
            fontSize: "18px", color: "#ffffff", align: "center", wordWrap: { width: 540 }
        }).setOrigin(0.5));
        const feedback = add(this.add.text(400, 410, "", {
            fontSize: "16px", color: "#ffcc66", align: "center", wordWrap: { width: 550 }
        }).setOrigin(0.5));
        quest.options.forEach((option, index) => {
            const y = 270 + index * 52;
            const button = add(this.add.rectangle(400, y, 520, 40, 0x263746)
                .setStrokeStyle(1, 0x7CFFB2).setInteractive({ useHandCursor: true }));
            const label = add(this.add.text(400, y, String.fromCharCode(65 + index) + ") " + option, {
                fontSize: "16px", color: "#ffffff", align: "center", wordWrap: { width: 490 }
            }).setOrigin(0.5));
            button.on("pointerdown", async () => {
                if (this.debugQuestCompleted[quest.id]) return;
                if (index !== quest.correct) {
                    feedback.setText("Not quite — try another answer.");
                    return;
                }
                this.debugQuestCompleted[quest.id] = true;
                this.completeQueuedTask("Complete a debugging side quest");
                this.recordGameAction("Completed " + quest.title + " (+10 XP)");
                feedback.setColor("#7CFFB2");
                feedback.setText(quest.success + "\n+10 XP");
                await this.awardXP(10);
                this.updateQuestHUD();
                this.time.delayedCall(1100, () => {
                    if (!this.scene || !this.scene.isActive()) return;
                    this.closeDebugQuestBoard();
                    this.showDebugQuestBoard();
                });
            });
        });
        add(this.add.text(400, 500, "Choose the best fix. Incorrect answers can be retried.", {
            fontSize: "14px", color: "#b8c7d9", align: "center"
        }).setOrigin(0.5));
    }

    closeDebugQuestBoard() {
        this.debugQuestOpen = false;
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

        const add = (obj) => { this.treeChallengeObjects.push(obj); return obj; };
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
        if (gameState.location !== "campus") return;
        this.currentLocation = location;
        this.interiorActive = true;
        gameState.location = location;
        this.recordGameAction(`Entered ${location}`);
        this.saveProgress();
        this.scene.launch("InteriorScene", { location });
    }

    // ==========================================
    // UPDATE
    // ==========================================

    update() {

        if (this.interiorActive) {
            this.player.body.setVelocity(0);
            return;
        }

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
            { type: "shopkeeper", object: this.shopkeeper },
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
                shopkeeper: "Press E to visit campus shop",
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
        if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nearestTarget) {
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
                case "shopkeeper":
                    this.logCppNpcInteraction(2);
                    this.openCampusShop();
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
        this.location = ["hostel", "lab", "library", "canteen", "shop"].includes(data?.location)
            ? data.location : "hostel";
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
            Phaser.Math.Clamp(Number(gameState.interiorX ?? 400), 80, 720),
            Phaser.Math.Clamp(Number(gameState.interiorY ?? 450), 100, 500),
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
        this.add.text(340, 570, "E: interact  |  WASD: move  |  Door: return to campus", {
            fontSize: "14px", color: "#ffffff", backgroundColor: "#17212b", padding: { x: 8, y: 4 }
        }).setOrigin(0.5);

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
        });
        this.interactionText = this.add.text(400, 525, "", {
            fontSize: "17px", color: "#ffffff", backgroundColor: "#17212b", padding: { x: 9, y: 6 }
        }).setOrigin(0.5);
        this.messageText = this.add.text(400, 490, "", {
            fontSize: "15px", color: "#e8f5e9", backgroundColor: "#17212b", padding: { x: 8, y: 5 }, align: "center"
        }).setOrigin(0.5);
        this.saveTimer = this.time.addEvent({ delay: 1000, callback: this.saveInteriorProgress, callbackScope: this, loop: true });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
            this.addSolid(200, 400, 145, 75, 0x416a7d, "LAB ASSISTANT");
            this.addTarget(200, 350, "Ask the Lab Assistant", "assistant", 0x38a3a5);
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
            this.addSolid(400, 145, 300, 64, 0xb25d35, "FOOD COUNTER");
            this.addTarget(400, 190, "Order food from the canteen", "canteenShop", 0xe9a23b);
            [[180, 315], [400, 315], [620, 315]].forEach(([x, y], i) => {
                this.addSolid(x, y, 125, 55, 0x76563c, `TABLE ${i + 1}`);
            });
            this.addTarget(620, 210, "Talk to the Canteen Keeper", "canteenNpc", 0x38a3a5);
        } else {
            this.addSolid(400, 145, 320, 65, 0x536b7a, "SHOP COUNTER");
            this.addTarget(400, 190, "Browse the campus shop", "shop", 0xe9a23b);
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
        this.showMessage(`${name} added to the C++ Item and C hash-table inventories. Coins left: ${gameState.coins}.`);
        this.saveInteriorProgress();
    }

    openShop(canteen = false) {
        const sellerIndex = 2;
        const greeting = worldModule?.ccall("worldNpcMessage", "string", ["number"], [sellerIndex]) || "Welcome to the campus shop.";
        const add = this.showPanel(canteen ? "CANTEEN COUNTER" : "CAMPUS SHOP", `${greeting}\n\nYour coins: ${gameState.coins}\nItems are recorded by the C++ Item class and the C hash-table inventory.`);
        const offers = canteen
            ? [["Snack", 8, "A canteen snack. Restores 10 energy."], ["Coffee", 12, "Fresh canteen coffee. Restores 20 energy."]]
            : [["Notebook", 10, "A notebook for recording programming ideas."], ["Energy Drink", 15, "Restores player energy when used."]];
        offers.forEach((offer, index) => {
            const y = 315 + index * 55;
            const button = add(this.add.rectangle(400, y, 390, 40, 0x245b49).setStrokeStyle(1, 0x7cffb2).setInteractive({ useHandCursor: true }));
            const text = add(this.add.text(400, y, `${offer[0]}  —  ${offer[1]} coins`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5));
            button.on("pointerdown", () => { this.purchaseItem(...offer); this.closePanel(); });
            text.setInteractive({ useHandCursor: true }).on("pointerdown", () => { this.purchaseItem(...offer); this.closePanel(); });
        });
    }

    interact(target) {
        if (target.action === "exit") {
            this.saveInteriorProgress();
            gameState.location = "campus";
            this.exiting = true;
            const campus = this.scene.get("GameScene");
            campus.currentLocation = "campus";
            campus.interiorActive = false;
            campus.recordGameAction(`Left ${this.location}`);
            campus.saveProgress();
            this.scene.stop("InteriorScene");
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
            this.openShop(false);
        }
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

    scene: [GameScene, InteriorScene]

};


// ==========================================
// START GAME
// ==========================================

const game = new Phaser.Game(config);
