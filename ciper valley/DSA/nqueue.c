#include <stdio.h>

#define MAX 10

char queue[MAX][50];

int front = -1;
int rear = -1;


// ENQUEUE
void enqueue(const char task[]) {

    if (rear == MAX - 1) {
        printf("Queue Overflow\n");
        return;
    }

    if (front == -1) {
        front = 0;
    }

    rear++;

    snprintf(queue[rear], 50, "%s", task);

    printf("Task added: %s\n", task);
}


// DEQUEUE
void dequeue() {

    if (front == -1 || front > rear) {
        printf("Queue is empty.\n");
        return;
    }

    printf("Processing task: %s\n", queue[front]);

    front++;
}


// PEEK
void peekQueue() {

    if (front == -1 || front > rear) {
        printf("Queue is empty.\n");
        return;
    }

    printf("Next task: %s\n", queue[front]);
}


// DISPLAY
void displayQueue() {

    if (front == -1 || front > rear) {
        printf("Queue is empty.\n");
        return;
    }

    printf("\nTask Queue:\n");

    for (int i = front; i <= rear; i++) {

        printf("%d. %s\n",
               i - front + 1,
               queue[i]);
    }
}


// MAIN
int main() {

    enqueue("Talk to Mentor");
    enqueue("Deliver Assignment");
    enqueue("Start DSA Challenge");

    printf("\n");

    displayQueue();

    printf("\n");

    peekQueue();

    printf("\n");

    dequeue();

    printf("\n");

    displayQueue();

    return 0;
}