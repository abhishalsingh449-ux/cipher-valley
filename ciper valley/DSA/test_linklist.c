#include <stdio.h>
#include "linkedlist.h"

int main()
{
    addQuest(1, "Learn Linked Lists");
    addQuest(2, "Solve the Pointer Challenge");
    addQuest(3, "Complete the Programming Lab");

    displayQuests();

    completeQuest(1);

    displayQuests();

    return 0;
}