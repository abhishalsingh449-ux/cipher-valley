#include <stdio.h>

#define MAX 10

char queue[MAX][50];

int front = -1;
int rear = -1;


// ENQUEUE
void enqueue(const char task[]) {

    // Queue is full
    if ((rear + 1) % MAX == front) {
        printf("Queue Overflow\n");
        return;
    }

    // First element
    if (front == -1) {
        front = 0;
        rear = 0;
    }
    else {
        rear = (rear + 1) % MAX;
    }

    snprintf(queue[rear], 50, "%s", task);

    printf("Task added: %s\n", task);
}


// DEQUEUE
void dequeue() {

    // Queue is empty
    if (front == -1) {
        printf("Queue is empty.\n");
        return;
    }

    printf("Processing task: %s\n", queue[front]);

    // Only one element was present
    if (front == rear) {
        front = -1;
        rear = -1;
    }
    else {
        front = (front + 1) % MAX;
    }
}


// PEEK
void peekQueue() {

    if (front == -1) {
        printf("Queue is empty.\n");
        return;
    }

    printf("Next task: %s\n", queue[front]);
}


// DISPLAY
void displayQueue() {

    if (front == -1) {
        printf("Queue is empty.\n");
        return;
    }

    printf("\nTask Queue:\n");

    int i = front;
    int count = 1;

    while (1) {

        printf("%d. %s\n", count, queue[i]);

        if (i == rear) {
            break;
        }

        i = (i + 1) % MAX;
        count++;
    }
}


// MAIN
int main() {

    enqueue("Task A");
    enqueue("Task B");
    enqueue("Task C");
    enqueue("Task D");
    enqueue("Task E");

    printf("\n");

    displayQueue();

    printf("\n");

    dequeue();
    dequeue();

    printf("\n");

    enqueue("Task F");
    enqueue("Task G");

    printf("\n");

    peekQueue();

    displayQueue();

    return 0;
}