#include <stdio.h>
#include <string.h>

#define CV_QUEUE_MAX 10
#define CV_TASK_LEN 80
static char taskQueue[CV_QUEUE_MAX][CV_TASK_LEN];
static int queueFront = -1;
static int queueRear = -1;
static int queueCount = 0;
static char resultBuffer[CV_TASK_LEN];

int queueAddTask(const char *task) {
    if (!task || queueCount >= CV_QUEUE_MAX) return 0;
    if (queueFront < 0) queueFront = 0;
    queueRear = (queueRear + 1) % CV_QUEUE_MAX;
    snprintf(taskQueue[queueRear], CV_TASK_LEN, "%s", task);
    ++queueCount;
    return 1;
}

const char *queueProcessNextTask(void) {
    if (queueCount == 0 || queueFront < 0) return "";
    snprintf(resultBuffer, sizeof(resultBuffer), "%s", taskQueue[queueFront]);
    taskQueue[queueFront][0] = '\0';
    if (queueCount == 1) {
        queueFront = queueRear = -1;
    } else {
        queueFront = (queueFront + 1) % CV_QUEUE_MAX;
    }
    --queueCount;
    return resultBuffer;
}

const char *queuePeekTask(void) {
    return queueCount == 0 || queueFront < 0 ? "" : taskQueue[queueFront];
}

int queueRemoveTask(const char *task) {
    if (!task || queueCount == 0 || queueFront < 0) return 0;
    int foundOffset = -1;
    for (int offset = 0; offset < queueCount; ++offset) {
        int index = (queueFront + offset) % CV_QUEUE_MAX;
        if (strcmp(taskQueue[index], task) == 0) { foundOffset = offset; break; }
    }
    if (foundOffset < 0) return 0;
    for (int offset = foundOffset; offset < queueCount - 1; ++offset) {
        int current = (queueFront + offset) % CV_QUEUE_MAX;
        int next = (queueFront + offset + 1) % CV_QUEUE_MAX;
        memmove(taskQueue[current], taskQueue[next], CV_TASK_LEN);
    }
    taskQueue[queueRear][0] = '\0';
    if (queueCount == 1) queueFront = queueRear = -1;
    else queueRear = (queueRear - 1 + CV_QUEUE_MAX) % CV_QUEUE_MAX;
    --queueCount;
    return 1;
}

int queueGetCount(void) { return queueCount; }

const char *queueGetTaskAt(int index) {
    if (index < 0 || index >= queueCount || queueFront < 0) return "";
    return taskQueue[(queueFront + index) % CV_QUEUE_MAX];
}

void queueClear(void) {
    while (queueCount > 0) {
        taskQueue[queueFront][0] = '\0';
        queueFront = (queueFront + 1) % CV_QUEUE_MAX;
        --queueCount;
    }
    queueFront = queueRear = -1;
}

#ifdef CIPHER_VALLEY_STANDALONE
int main(void) {
    queueAddTask("Repair vending machine");
    queueAddTask("Meet programming mentor");
    queueAddTask("Complete DSA challenge");
    for (int i = 0; i < queueGetCount(); ++i) printf("%d. %s\n", i + 1, queueGetTaskAt(i));
    printf("Processing: %s\n", queueProcessNextTask());
    return 0;
}
#endif
