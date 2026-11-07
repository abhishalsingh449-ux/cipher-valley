#include <stdio.h>
#include <string.h>

#define CV_STACK_MAX 10
#define CV_ACTION_LEN 80
static char actionStack[CV_STACK_MAX][CV_ACTION_LEN];
static int actionTop = -1;
static char resultBuffer[CV_ACTION_LEN];

int stackPush(const char *action) {
    if (!action || actionTop >= CV_STACK_MAX - 1) return 0;
    ++actionTop;
    snprintf(actionStack[actionTop], CV_ACTION_LEN, "%s", action);
    return 1;
}

const char *stackPopAction(void) {
    if (actionTop < 0) return "";
    snprintf(resultBuffer, sizeof(resultBuffer), "%s", actionStack[actionTop]);
    actionStack[actionTop][0] = '\0';
    --actionTop;
    return resultBuffer;
}

const char *stackPeekAction(void) {
    return actionTop < 0 ? "" : actionStack[actionTop];
}

int stackGetCount(void) { return actionTop + 1; }

/* The gameplay history is a rolling stack: discard its oldest entry when full. */
int stackDropOldest(void) {
    if (actionTop < 0) return 0;
    for (int i = 0; i < actionTop; ++i) {
        memmove(actionStack[i], actionStack[i + 1], CV_ACTION_LEN);
    }
    actionStack[actionTop][0] = '\0';
    --actionTop;
    return 1;
}

/* Index 0 is the newest action; index 1 is the action before it, etc. */
const char *stackGetActionAt(int index) {
    if (index < 0 || index > actionTop) return "";
    return actionStack[actionTop - index];
}

void stackClear(void) {
    while (actionTop >= 0) actionStack[actionTop--][0] = '\0';
}

#ifdef CIPHER_VALLEY_STANDALONE
int main(void) {
    stackPush("Entered Programming Lab");
    stackPush("Talked to Mentor");
    stackPush("Started Linked List Quest");
    for (int i = 0; i < stackGetCount(); ++i) printf("%d. %s\n", i + 1, stackGetActionAt(i));
    printf("Popped action: %s\n", stackPopAction());
    return 0;
}
#endif
