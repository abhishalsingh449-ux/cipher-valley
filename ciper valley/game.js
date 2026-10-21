

// ==========================================
// C++ PLAYER MODULE
// ==========================================
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

        // Register the quest once when the C module loads
        linkedListModule.ccall(
            "addQuest",
            null,
            ["number", "string"],
            [1, "Learn Linked List"]
        );

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
        console.log("C hash-table inventory loaded successfully!");
        return Module;
    })
    .catch((error) => {
        console.error("Failed to load C hash-table inventory:", error);
        return null;
    });

class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");

        // GAME PROGRESS
        this.dsaOpen = false;
        this.questCompleted = false;
        this.dsaXP = 0;
        this.playerEnergy = 100;
        this.playerLevel = 1;
        this.playerTotalXP = 0;
        this.nextEnergyTick = 0;
        this.playerStatsText = null;
        this.answerSubmitted = false;
        this.inventoryOpen = false;
        this.inventoryMessage = "";

        // MANDATORY OPENING QUEST: THE COFFEE CRISIS
        this.coffeeQuestAccepted = false;
        this.coffeeQuestCompleted = false;
        this.coffeeChallengeOpen = false;
        this.coffeeHintLevel = 0;
        this.coffeeAttempts = 0;
        this.coffeeOverlayElements = [];

        // NOTEBOOK QUEST PROGRESS
        this.notebookQuestAccepted = false;
        this.notebookQuestCompleted = false;
        this.questDialogueOpen = false;
        this.questDialogueObjects = [];
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
        add(this.add.text(400, 84, "Powered by your C hash table (linear probing)", {
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

        button(145, 500, "Add Coffee +1", () => this.addInventoryItem("Coffee", "Restores energy during campus exploration."));
        button(355, 500, "Add Notebook +1", () => this.addInventoryItem("Notebook", "A notebook for recording DSA clues."));
        button(565, 500, "Search Coffee", () => this.searchInventoryItem("Coffee"));
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
            this.setInventoryMessage(name + " added/updated by the C hash table.");
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
                "Before we begin DSA training, help your friend repair the vending machine. It introduces the interaction and coding mechanics used throughout Cipher Valley.",
                [{ label: "I'll do it", callback: () => {} }]
            );
            return;
        }

        // The linked-list challenge follows the mandatory opening quest.
        if (!this.questCompleted) {
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
        this.showQuestDialogue(
            "CAMPUS SHOP",
            this.notebookQuestAccepted
                ? "The mentor needs a Notebook. Collect one to complete the quest."
                : "Welcome to the campus shop. You can collect a Notebook here for your DSA notes.",
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
                            module.ccall(
                                "insertItem",
                                null,
                                ["string", "number", "string"],
                                ["Notebook", 1, "A notebook for recording DSA clues."]
                            );
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
                "The vending machine is beside the hostel. Inspect its program and repair the missing condition. You can use hints if you need them.",
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

        const status = add(this.add.text(400, 440, "", {
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
        if (answer !== "stock") {
            this.coffeeCodeStatus.setText(
                "TEST FAILED: The condition still can't compare the request with available stock. Review the hint and try again."
            );
            return;
        }

        this.coffeeCodeStatus.setText("TEST PASSED: The dispenser logic is valid. Restarting machine...");
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
                module.ccall("insertItem", null, ["string", "number", "string"], [
                    "Coffee", 1, "Fresh coffee collected after repairing the campus vending machine."
                ]);
            }
            const xpAwarded = await this.awardXP(15);
            if (!xpAwarded) {
                this.coffeeCodeStatus.setText("Coffee was added, but the C++ Player could not record XP. Check the Console before retrying.");
                return;
            }
            this.coffeeQuestCompleted = true;
            if (this.vendingStatus) {
                this.vendingStatus.setText("ONLINE").setColor("#7dffb3");
            }
            this.updateQuestHUD();
            this.coffeeCodeStatus.setText("SUCCESS! Coffee dispensed. +15 XP. Coffee was added to the C hash-table inventory.");
            console.log("Coffee Crisis completed. Attempts:", this.coffeeAttempts, "Hints used:", this.coffeeHintLevel);
            this.time.delayedCall(1600, () => {
                if (this.coffeeChallengeOpen) {
                    this.closeCoffeeCodingChallenge();
                    this.showQuestDialogue(
                        "QUEST COMPLETED: COFFEE CRISIS",
                        "You repaired the vending machine by fixing its stock condition. Your friend gets coffee, you earned 15 XP, and Coffee is now stored in the C hash-table inventory. Next: visit the mentor to begin the linked-list quest.",
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

        // Assets will be loaded here later

    }


    // ==========================================
    // CREATE
    // ==========================================

    create() {

        // CAMPUS BACKGROUND
        this.add.rectangle(
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

        // PLAYER
        this.player = this.add.rectangle(
            400, 300, 40, 40,
            0xff0000
        );

        // PLAYER PHYSICS
        this.physics.add.existing(this.player);

        this.player.body.setCollideWorldBounds(true);

        // MENTOR NPC
        this.npc = this.add.rectangle(
            600, 350, 40, 40,
            0x0000ff
        );

        this.add.text(
            570, 375,
            "MENTOR",
            {
                fontSize: "16px",
                color: "#ffffff"
            }
        );

        // SHOPKEEPER NPC — Notebook quest item source
        this.shopkeeper = this.add.rectangle(
            200, 400, 40, 40,
            0xffa500
        );

        this.add.text(
            150, 425,
            "SHOPKEEPER",
            {
                fontSize: "15px",
                color: "#ffffff"
            }
        );

        // FRIEND NPC — introduces the mandatory opening quest.
        this.friend = this.add.rectangle(330, 300, 38, 38, 0xd17ce8);
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
        this.vendingStatus = this.add.text(660, 455, "ERROR", {
            fontSize: "12px", color: "#ff7777", fontStyle: "bold"
        });

        // LAB PHYSICS
        this.physics.add.existing(this.lab, true);

        // HOSTEL PHYSICS
        this.physics.add.existing(this.hostel, true);

        // NPC PHYSICS
        this.physics.add.existing(this.npc, true);
        this.physics.add.existing(this.shopkeeper, true);
        this.physics.add.existing(this.friend, true);
        this.physics.add.existing(this.vendingMachine, true);

        // COLLISIONS
        this.physics.add.collider(this.player, this.lab);
        this.physics.add.collider(this.player, this.hostel);
        this.physics.add.collider(this.player, this.npc);
        this.physics.add.collider(this.player, this.shopkeeper);
        this.physics.add.collider(this.player, this.friend);
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
    }


    // ==========================================
    // UPDATE
    // ==========================================

    update() {

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

        // Find the closest interactable character/object.
        const targets = [
            { type: "friend", object: this.friend },
            { type: "vending", object: this.vendingMachine },
            { type: "shopkeeper", object: this.shopkeeper },
            { type: "mentor", object: this.npc }
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
                friend: this.coffeeQuestCompleted ? "Press E to talk to your friend" : "Press E to talk to your friend",
                vending: this.coffeeQuestCompleted ? "Press E to use vending machine" : "Press E to inspect vending machine",
                shopkeeper: "Press E to visit campus shop",
                mentor: this.coffeeQuestCompleted
                    ? (!this.questCompleted ? "Press E to begin DSA training" : "Press E to talk to mentor")
                    : "Mentor: finish the Coffee Crisis first"
            };
            this.interactionText.setText(prompts[nearestTarget.type]);
        } else {
            this.interactionBox.setVisible(false);
            this.interactionText.setVisible(false);
        }

        // PRESS E TO INTERACT WITH THE CLOSEST NPC OR OBJECT
        if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nearestTarget) {
            switch (nearestTarget.type) {
                case "friend": this.interactWithFriend(); break;
                case "vending": this.interactWithVendingMachine(); break;
                case "shopkeeper": this.openCampusShop(); break;
                case "mentor": this.interactWithMentor(); break;
            }
        }

    }

}


// ==========================================
// GAME CONFIGURATION
// ==========================================

const config = {

    type: Phaser.AUTO,

    width: 800,

    height: 600,

    backgroundColor: "#222222",

    physics: {

        default: "arcade",

        arcade: {
            debug: false
        }

    },

    scene: GameScene

};


// ==========================================
// START GAME
// ==========================================

const game = new Phaser.Game(config);