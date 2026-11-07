#include <iostream>
#include "quest.h"

using namespace std;


// Constructor
Quest::Quest(
    int questId,
    string questTitle,
    string questDescription,
    int xp
)
{
    id = questId;
    title = questTitle;
    description = questDescription;
    rewardXP = xp;
    completed = false;
}


// Display quest
void Quest::displayQuest()
{
    cout << "\n--- QUEST ---" << endl;

    cout << "ID: " << id << endl;
    cout << "Title: " << title << endl;
    cout << "Description: " << description << endl;
    cout << "Reward XP: " << rewardXP << endl;

    if (completed)
        cout << "Status: Completed" << endl;
    else
        cout << "Status: Active" << endl;
}


// Complete quest
void Quest::completeQuest()
{
    if (!completed)
    {
        completed = true;

        cout << "\nQuest completed!" << endl;
        cout << "XP earned: " << rewardXP << endl;
    }
    else
    {
        cout << "Quest already completed." << endl;
    }
}


// Get quest ID
int Quest::getId()
{
    return id;
}


// Check completion
bool Quest::isCompleted()
{
    return completed;
}