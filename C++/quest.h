#ifndef QUEST_H
#define QUEST_H

#include <string>
using namespace std;

class Quest
{
private:
    int id;
    string title;
    string description;
    int rewardXP;
    bool completed;

public:
    Quest(
        int questId,
        string questTitle,
        string questDescription,
        int xp
    );

    void displayQuest();

    void completeQuest();

    int getId();

    bool isCompleted();
};

#endif