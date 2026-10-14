

// ==========================================
// C LINKED LIST MODULE
// ==========================================

let linkedListModule = null;

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

        throw error;
    });

class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");

        // GAME PROGRESS
        this.dsaOpen = false;
        this.questCompleted = false;
        this.dsaXP = 0;
        this.answerSubmitted = false;
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
              "Total DSA XP: " + this.dsaXP
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

    correctDSAAnswer() {

        // Prevent duplicate rewards
        if (this.questCompleted) {
            return;
        }

        // Mark quest complete
this.questCompleted = true;

// Complete the quest using the actual C linked list
if (linkedListModule) {
    

    linkedListModule.ccall(
        "completeQuest",
        null,
        ["number"],
        [1]
    );

    linkedListModule.ccall(
        "displayQuests",
        null,
        [],
        []
    );

    console.log("C linked-list quest completed successfully!");
}

// Award XP once
this.dsaXP += 10;

        // Display feedback
        this.questionText.setText(
            "QUEST COMPLETED!\n\n" +
            "The last node has no next node.\n" +
            "Its next pointer is NULL.\n\n" +
            "+10 DSA XP\n\n" +
            "Total DSA XP: " + this.dsaXP
        );

        // Disable all answer options
        this.dsaOptions.forEach(option => {
            option.disableInteractive();
            option.setStyle({
                backgroundColor: "#222222"
            });
        });

        // Update HUD
        this.updateQuestHUD();

        console.log("Quest completed!");
        console.log("Total DSA XP:", this.dsaXP);
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
    // QUEST HUD
    // ==========================================

    updateQuestHUD() {

        if (this.questStatusText) {

            this.questStatusText.setText(
                this.questCompleted
                    ? "Quest: Linked List — COMPLETED"
                    : "Quest: Linked List — ACTIVE"
            );

        }

        if (this.xpText) {

            this.xpText.setText(
                "DSA XP: " + this.dsaXP
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

        // LAB PHYSICS
        this.physics.add.existing(this.lab, true);

        // HOSTEL PHYSICS
        this.physics.add.existing(this.hostel, true);

        // NPC PHYSICS
        this.physics.add.existing(this.npc, true);

        // COLLISIONS
        this.physics.add.collider(this.player, this.lab);
        this.physics.add.collider(this.player, this.hostel);
        this.physics.add.collider(this.player, this.npc);

        // KEYBOARD CONTROLS
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });

        // INTERACTION SETTINGS
        this.interactionDistance = 80;

        this.interactKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );

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
            "DSA XP: 0",
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

        this.updateQuestHUD();
    }


    // ==========================================
    // UPDATE
    // ==========================================

    update() {

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

        // MOVEMENT SPEED
        const speed = 200;

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

        // DISTANCE FROM MENTOR
        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.npc.x,
            this.npc.y
        );

        // INTERACTION UI
        if (distance <= this.interactionDistance) {

            this.interactionBox.setVisible(true);
            this.interactionText.setVisible(true);

            this.interactionText.setText(
                this.questCompleted
                    ? "Press E to revisit mentor"
                    : "Press E to interact"
            );

        } else {

            this.interactionBox.setVisible(false);
            this.interactionText.setVisible(false);

        }

        // PRESS E TO INTERACT
        if (
            distance <= this.interactionDistance &&
            Phaser.Input.Keyboard.JustDown(this.interactKey)
        ) {

            this.showDSAChallenge();

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