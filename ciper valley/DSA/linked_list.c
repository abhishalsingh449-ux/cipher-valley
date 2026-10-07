#include <stdio.h>
#include <stdlib.h>
#include <string.h>


// QUEST NODE
struct Quest
{
    int id;
    char name[50];
    int completed;

    struct Quest *next;
};


struct Quest *head = NULL;


// ADD QUEST AT END
void addQuest(int id, const char name[])
{
    struct Quest *newQuest;

    newQuest = (struct Quest *)malloc(sizeof(struct Quest));

    newQuest->id = id;
    strcpy(newQuest->name, name);
    newQuest->completed = 0;
    newQuest->next = NULL;


    // If list is empty
    if (head == NULL)
    {
        head = newQuest;
        return;
    }


    // Traverse to last node
    struct Quest *temp = head;

    while (temp->next != NULL)
    {
        temp = temp->next;
    }

    temp->next = newQuest;
}


// COMPLETE QUEST
void completeQuest(int id)
{
    struct Quest *temp = head;

    while (temp != NULL)
    {
        if (temp->id == id)
        {
            temp->completed = 1;

            printf("\nQuest completed: %s\n",
                   temp->name);

            return;
        }

        temp = temp->next;
    }

    printf("\nQuest not found.\n");
}


// DISPLAY QUESTS
void displayQuests()
{
    struct Quest *temp = head;

    printf("\n--- CIPHER VALLEY QUESTS ---\n");

    while (temp != NULL)
    {
        printf("\nQuest ID: %d", temp->id);
        printf("\nQuest: %s", temp->name);

        if (temp->completed == 1)
            printf("\nStatus: Completed\n");
        else
            printf("\nStatus: Active\n");

        temp = temp->next;
    }
}


