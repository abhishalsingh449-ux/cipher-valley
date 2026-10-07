class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");

        this.dsaOpen = false;
    }


    // ==========================================
    // DSA CHALLENGE
    // ==========================================

    showDSAChallenge() {

        this.dsaOpen = true;

        // Stop player movement
        this.player.body.setVelocity(0);

        // Hide normal interaction UI
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);

        // ==========================================
        // FULL SCREEN BACKGROUND
        // ==========================================

        this.challengeBox = this.add.rectangle(
            400,
            300,
            800,
            600,
            0x111111,
            1
        );

        this.challengeBox.setDepth(20);


        // ==========================================
        // TITLE
        // ==========================================

        this.dsaTitle = this.add.text(
            400,
            55,
            "CIPHER VALLEY",
            {
                fontSize: "32px",
                color: "#ffffff",
                fontStyle: "bold"
            }
        );

        this.dsaTitle.setOrigin(0.5);
        this.dsaTitle.setDepth(21);


        this.dsaSubtitle = this.add.text(
            400,
            95,
            "DSA TRAINING — LINKED LIST",
            {
                fontSize: "18px",
                color: "#aaaaaa"
            }
        );

        this.dsaSubtitle.setOrigin(0.5);
        this.dsaSubtitle.setDepth(21);


        // ==========================================
        // QUESTION
        // ==========================================

        this.questionText = this.add.text(
            400,
            190,
            "A linked list contains:\n\n" +
            "10 → 20 → 30 → NULL\n\n" +
            "What does the next pointer\n" +
            "of node 30 contain?",
            {
                fontSize: "23px",
                color: "#ffffff",
                align: "center"
            }
        );

        this.questionText.setOrigin(0.5);
        this.questionText.setDepth(21);


        // ==========================================
        // OPTIONS
        // ==========================================

        this.createOption(
            220,
            380,
            "A) 10",
            false
        );

        this.createOption(
            580,
            380,
            "B) 20",
            false
        );

        this.createOption(
            220,
            460,
            "C) NULL",
            true
        );

        this.createOption(
            580,
            460,
            "D) 30",
            false
        );


        // ==========================================
        // EXIT BUTTON
        // ==========================================

        this.exitButton = this.add.text(
            400,
            550,
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


        // E key for exit
        this.dsaExitKey =
            this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.E
            );
    }


    // ==========================================
    // CREATE ANSWER OPTION
    // ==========================================

    createOption(x, y, text, correct) {

        const option = this.add.text(
            x,
            y,
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


        // Store correct answer information
        option.correctAnswer = correct;


        // Hover
        option.on("pointerover", () => {

            option.setStyle({
                backgroundColor: "#444444"
            });

        });


        option.on("pointerout", () => {

            option.setStyle({
                backgroundColor: "#222222"
            });

        });


        // Click
        option.on("pointerdown", () => {

            if (option.correctAnswer) {

                this.correctDSAAnswer();

            } else {

                this.wrongDSAAnswer();

            }

        });


        // Store option
        if (!this.dsaOptions) {
            this.dsaOptions = [];
        }

        this.dsaOptions.push(option);
    }


    // ==========================================
    // CORRECT ANSWER
    // ==========================================

    correctDSAAnswer() {

        this.questionText.setText(
            "CORRECT!\n\n" +
            "The last node has no next node.\n" +
            "Therefore its next pointer is NULL.\n\n" +
            "+10 DSA XP"
        );


        // Disable answers
        if (this.dsaOptions) {

            this.dsaOptions.forEach(
                option => option.disableInteractive()
            );

        }
    }


    // ==========================================
    // WRONG ANSWER
    // ==========================================

    wrongDSAAnswer() {

        this.questionText.setText(
            "NOT QUITE!\n\n" +
            "Node 30 is the last node.\n\n" +
            "The last node points to NULL.\n\n" +
            "Try another answer."
        );
    }


    // ==========================================
    // CLOSE DSA SCREEN
    // ==========================================

    closeDSAChallenge() {

        this.dsaOpen = false;


        if (this.challengeBox) {
            this.challengeBox.destroy();
        }

        if (this.dsaTitle) {
            this.dsaTitle.destroy();
        }

        if (this.dsaSubtitle) {
            this.dsaSubtitle.destroy();
        }

        if (this.questionText) {
            this.questionText.destroy();
        }

        if (this.exitButton) {
            this.exitButton.destroy();
        }


        // Destroy answer options
        if (this.dsaOptions) {

            this.dsaOptions.forEach(
                option => option.destroy()
            );

            this.dsaOptions = [];
        }


        // Destroy E key listener
        if (this.dsaExitKey) {
            this.dsaExitKey.destroy();
            this.dsaExitKey = null;
        }


        // Show interaction UI again
        this.interactionBox.setVisible(false);
        this.interactionText.setVisible(false);
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


        // ==========================================
        // CAMPUS BACKGROUND
        // ==========================================

        this.add.rectangle(
            400,
            300,
            800,
            600,
            0x3a7d44
        );


        // ==========================================
        // CAMPUS PATHS
        // ==========================================

        this.add.rectangle(
            400,
            300,
            800,
            70,
            0xc2a878
        );

        this.add.rectangle(
            500,
            300,
            70,
            600,
            0xc2a878
        );


        // ==========================================
        // PROGRAMMING LAB
        // ==========================================

        this.lab = this.add.rectangle(
            200,
            150,
            220,
            120,
            0x555555
        );

        this.add.text(
            125,
            135,
            "PROGRAMMING LAB",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );


        // ==========================================
        // HOSTEL
        // ==========================================

        this.hostel = this.add.rectangle(
            650,
            150,
            180,
            120,
            0x8b5a2b
        );

        this.add.text(
            600,
            135,
            "HOSTEL",
            {
                fontSize: "18px",
                color: "#ffffff"
            }
        );


        // ==========================================
        // PLAYER
        // ==========================================

        this.player = this.add.rectangle(
            400,
            300,
            40,
            40,
            0xff0000
        );


        // ==========================================
        // PLAYER PHYSICS
        // ==========================================

        this.physics.add.existing(
            this.player
        );

        this.player.body.setCollideWorldBounds(
            true
        );


        // ==========================================
        // MENTOR NPC
        // ==========================================

        this.npc = this.add.rectangle(
            600,
            350,
            40,
            40,
            0x0000ff
        );

        this.add.text(
            570,
            375,
            "MENTOR",
            {
                fontSize: "16px",
                color: "#ffffff"
            }
        );


        // ==========================================
        // LAB PHYSICS
        // ==========================================

        this.physics.add.existing(
            this.lab,
            true
        );


        // ==========================================
        // HOSTEL PHYSICS
        // ==========================================

        this.physics.add.existing(
            this.hostel,
            true
        );


        // ==========================================
        // NPC PHYSICS
        // ==========================================

        this.physics.add.existing(
            this.npc,
            true
        );


        // ==========================================
        // COLLISIONS
        // ==========================================

        this.physics.add.collider(
            this.player,
            this.lab
        );

        this.physics.add.collider(
            this.player,
            this.hostel
        );


        // ==========================================
        // KEYBOARD CONTROLS
        // ==========================================

        this.keys =
            this.input.keyboard.addKeys({

                W: Phaser.Input.Keyboard.KeyCodes.W,

                A: Phaser.Input.Keyboard.KeyCodes.A,

                S: Phaser.Input.Keyboard.KeyCodes.S,

                D: Phaser.Input.Keyboard.KeyCodes.D

            });


        // ==========================================
        // INTERACTION SETTINGS
        // ==========================================

        this.interactionDistance = 80;

        this.interactKey =
            this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.E
            );


        // ==========================================
        // INTERACTION RECTANGLE
        // ==========================================

        this.interactionBox =
            this.add.rectangle(
                400,
                520,
                300,
                55,
                0x000000
            );

        this.interactionBox.setAlpha(0.85);

        this.interactionBox.setDepth(10);


        // ==========================================
        // INTERACTION TEXT
        // ==========================================

        this.interactionText =
            this.add.text(
                400,
                520,
                "",
                {
                    fontSize: "20px",
                    color: "#ffffff"
                }
            );

        this.interactionText.setOrigin(
            0.5
        );

        this.interactionText.setDepth(11);


        // Hide interaction UI initially

        this.interactionBox.setVisible(
            false
        );

        this.interactionText.setVisible(
            false
        );
    }


    // ==========================================
    // UPDATE
    // ==========================================

    update() {


        // ==========================================
        // DSA SCREEN IS OPEN
        // ==========================================

        if (this.dsaOpen) {

            // Freeze player
            this.player.body.setVelocity(
                0
            );


            // E exits the DSA screen
            if (
                Phaser.Input.Keyboard.JustDown(
                    this.dsaExitKey
                )
            ) {

                this.closeDSAChallenge();

            }

            return;
        }


        // ==========================================
        // MOVEMENT SPEED
        // ==========================================

        const speed = 200;


        // ==========================================
        // RESET VELOCITY
        // ==========================================

        this.player.body.setVelocity(
            0
        );


        // ==========================================
        // MOVE LEFT
        // ==========================================

        if (this.keys.A.isDown) {

            this.player.body.setVelocityX(
                -speed
            );

        }


        // ==========================================
        // MOVE RIGHT
        // ==========================================

        if (this.keys.D.isDown) {

            this.player.body.setVelocityX(
                speed
            );

        }


        // ==========================================
        // MOVE UP
        // ==========================================

        if (this.keys.W.isDown) {

            this.player.body.setVelocityY(
                -speed
            );

        }


        // ==========================================
        // MOVE DOWN
        // ==========================================

        if (this.keys.S.isDown) {

            this.player.body.setVelocityY(
                speed
            );

        }


        // ==========================================
        // DISTANCE FROM MENTOR
        // ==========================================

        const distance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.npc.x,
                this.npc.y
            );


        // ==========================================
        // SHOW INTERACTION UI
        // ==========================================

        if (
            distance <= this.interactionDistance
        ) {

            this.interactionBox.setVisible(
                true
            );

            this.interactionText.setVisible(
                true
            );

            this.interactionText.setText(
                "Press E to interact"
            );

        } else {

            this.interactionBox.setVisible(
                false
            );

            this.interactionText.setVisible(
                false
            );

        }


        // ==========================================
        // PRESS E
        // ==========================================

        if (
            distance <= this.interactionDistance &&
            Phaser.Input.Keyboard.JustDown(
                this.interactKey
            )
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

const game =
    new Phaser.Game(config);
    