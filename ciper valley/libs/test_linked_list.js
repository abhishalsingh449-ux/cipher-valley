const createLinked_list = require("../linked_list.js");

createLinked_list().then((Module) => {
    console.log("C Linked List loaded successfully!");

    Module.ccall(
        "addQuest",
        null,
        ["number", "string"],
        [1, "Find Mentor"]
    );

    Module.ccall(
        "addQuest",
        null,
        ["number", "string"],
        [2, "Learn Linked List"]
    );

    console.log("\nInitial quest list:");

    Module.ccall("displayQuests", null, [], []);

    console.log("\nCompleting quest 1...");

    Module.ccall("completeQuest", null, ["number"], [1]);

    console.log("\nUpdated quest list:");

    Module.ccall("displayQuests", null, [], []);

}).catch((error) => {
    console.error("Error loading C module:", error);
});
