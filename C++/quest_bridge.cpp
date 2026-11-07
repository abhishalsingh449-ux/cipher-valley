
#include <emscripten.h>
#include <string>
#include "quest.h"

using namespace std;

// The C++ quest instance used by Cipher Valley.
static Quest linkedListQuest(
    1,
    "Learn Linked List",
    "Understand why the last node points to NULL.",
    10
);

extern "C"
{
    // Check whether the quest has been completed.
    EMSCRIPTEN_KEEPALIVE
    int isLinkedListQuestCompleted()
    {
        return linkedListQuest.isCompleted() ? 1 : 0;
    }

    // Return the quest ID.
    EMSCRIPTEN_KEEPALIVE
    int getLinkedListQuestId()
    {
        return linkedListQuest.getId();
    }

    // Return the XP reward.
    EMSCRIPTEN_KEEPALIVE
    int getLinkedListQuestXP()
    {
        return 10;
    }

    // Complete the quest.
    // Returns 1 if newly completed, 0 if already completed.
    EMSCRIPTEN_KEEPALIVE
    int completeLinkedListQuest()
    {
        if (linkedListQuest.isCompleted())
        {
            return 0;
        }

        linkedListQuest.completeQuest();
        return 1;
    }
}

