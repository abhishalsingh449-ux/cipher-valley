#include <stdio.h>

#define MAX 10

char stack[MAX][50];
int top = -1;

void push(const char action[]) {

    if (top == MAX - 1) {
        printf("Stack Overflow\n");
        return;
    }

    top++;

    snprintf(stack[top], 50, "%s", action);

    printf("Action added: %s\n", action);
}

void pop() {

    if (top == -1) {
        printf("No action to undo.\n");
        return;
    }

    printf("Undoing: %s\n", stack[top]);

    top--;
}

void peek() {

    if (top == -1) {
        printf("No recent action.\n");
        return;
    }

    printf("Latest action: %s\n", stack[top]);
}
 
void displayStack() {

    if (top == -1) {
        printf("Action history is empty.\n");
        return;
    }

    printf("\nAction History:\n");

    for (int i = top; i >= 0; i--) {
        printf("%d. %s\n", i + 1, stack[i]);
    }
}

int main() {

    push("Entered Programming Lab");
    push("Talked to Mentor");
    push("Started Linked List Quest");

    displayStack();

    pop();

    displayStack();

    return 0;
}