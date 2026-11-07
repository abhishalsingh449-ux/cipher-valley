#include <iostream>

#include "player.h"
#include "items.h"
#include "NPC.h"
#include "quest.h"
extern "C"
{
    #include "../DSA/linkedlist.h"
}

using namespace std;

int main()
{
    // ---------------- PLAYER ----------------
    Player player("Cipher Student");

    player.displayPlayer();

    // ---------------- ITEM ----------------
    Item coffee(
        "Coffee",
        3,
        "Restores player energy."
    );

    coffee.displayItem();

    // ---------------- NPC ----------------
    ProgrammingMentor mentor(
        "Alex",
        "Programming Mentor"
    );

    LabAssistant assistant(
        "Sam",
        "Lab Assistant"
    );

    Shopkeeper shopkeeper(
        "Riya",
        "Shopkeeper"
    );

    NPC* npcs[3];

    npcs[0] = &mentor;
    npcs[1] = &assistant;
    npcs[2] = &shopkeeper;

    cout << "\n--- NPC INTERACTION ---" << endl;
    cout << "\n--- QUEST FROM MENTOR ---" << endl;

cout << "Programming Mentor gives you a new quest!" << endl;

addQuest(
    4,
    "Master Pointers"
);

displayQuests();

    for (int i = 0; i < 3; i++)
    {
        npcs[i]->displayNPC();
        npcs[i]->interact();
    }

    // ---------------- QUEST ----------------
    Quest quest(
        1,
        "Learn Linked Lists",
        "Complete the Linked List challenge.",
        100
    );

    // ---------------- C LINKED LIST ----------------

cout << "\n--- QUEST LINKED LIST ---" << endl;

addQuest(1, "Learn Linked Lists");
addQuest(2, "Solve the Pointer Challenge");
addQuest(3, "Complete the Programming Lab");

displayQuests();

completeQuest(1);

displayQuests();

    quest.displayQuest();

    quest.completeQuest();

    // ---------------- PLAYER ACTION ----------------
    player.useEnergy(20);
    coffee.useItem();
    player.restoreEnergy(10);

    cout << "\n--- FINAL PLAYER STATUS ---" << endl;

    player.displayPlayer();

    return 0;
}