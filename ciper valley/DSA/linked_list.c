#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define QUEST_NAME_LEN 80
typedef struct QuestNode {
    int id;
    char name[QUEST_NAME_LEN];
    int completed;
    struct QuestNode *next;
} QuestNode;
static QuestNode *questHead = NULL;
static int questCount = 0;

static QuestNode *findQuest(int id) {
    for (QuestNode *p = questHead; p; p = p->next) if (p->id == id) return p;
    return NULL;
}

int addQuest(int id, const char *name) {
    if (!name || id < 0) return 0;
    QuestNode *existing = findQuest(id);
    if (existing) {
        snprintf(existing->name, QUEST_NAME_LEN, "%s", name);
        return 1;
    }
    QuestNode *node = (QuestNode *)calloc(1, sizeof(QuestNode));
    if (!node) return 0;
    node->id = id;
    snprintf(node->name, QUEST_NAME_LEN, "%s", name);
    if (!questHead) questHead = node;
    else {
        QuestNode *tail = questHead;
        while (tail->next) tail = tail->next;
        tail->next = node;
    }
    ++questCount;
    return 1;
}

int completeQuest(int id) {
    QuestNode *node = findQuest(id);
    if (!node) return 0;
    node->completed = 1;
    return 1;
}

int isQuestCompleted(int id) {
    QuestNode *node = findQuest(id);
    return node ? node->completed : 0;
}

int getQuestCount(void) { return questCount; }

void displayQuests(void) {
    for (QuestNode *p = questHead; p; p = p->next)
        printf("Quest %d: %s [%s]\n", p->id, p->name, p->completed ? "COMPLETED" : "ACTIVE");
}

void clearQuests(void) {
    while (questHead) {
        QuestNode *next = questHead->next;
        free(questHead);
        questHead = next;
    }
    questCount = 0;
}
