#include <stdio.h>
#include <string.h>

#define SIZE 10
#define NAME_SIZE 50
#define DESCRIPTION_SIZE 100

struct Item {
    char name[NAME_SIZE];
    int quantity;
    char description[DESCRIPTION_SIZE];
};

static struct Item table[SIZE];

static int hashFunction(const char *item) {
    if (item == NULL || item[0] == '\0') return 0;
    return (unsigned char)item[0] % SIZE;
}

static int findSlot(const char *name) {
    int index, start;
    if (name == NULL || name[0] == '\0') return -1;
    index = hashFunction(name);
    start = index;
    while (table[index].name[0] != '\0') {
        if (strcmp(table[index].name, name) == 0) return index;
        index = (index + 1) % SIZE;
        if (index == start) break;
    }
    return -1;
}

/* Insert a new item, or increase quantity if it already exists. */
void insertItem(const char *name, int quantity, const char *description) {
    int index, start;
    if (name == NULL || name[0] == '\0') {
        printf("Item name cannot be empty.\n");
        return;
    }
    if (quantity <= 0) quantity = 1;

    index = findSlot(name);
    if (index >= 0) {
        table[index].quantity += quantity;
        if (description != NULL && description[0] != '\0') {
            strncpy(table[index].description, description, DESCRIPTION_SIZE - 1);
            table[index].description[DESCRIPTION_SIZE - 1] = '\0';
        }
        printf("%s quantity updated to %d.\n", name, table[index].quantity);
        return;
    }

    index = hashFunction(name);
    start = index;
    while (table[index].name[0] != '\0') {
        index = (index + 1) % SIZE;
        if (index == start) {
            printf("Inventory is full.\n");
            return;
        }
    }

    strncpy(table[index].name, name, NAME_SIZE - 1);
    table[index].name[NAME_SIZE - 1] = '\0';
    table[index].quantity = quantity;
    if (description != NULL) {
        strncpy(table[index].description, description, DESCRIPTION_SIZE - 1);
        table[index].description[DESCRIPTION_SIZE - 1] = '\0';
    } else {
        table[index].description[0] = '\0';
    }
    printf("%s added to inventory at index %d.\n", name, index);
}

/* Returns quantity, or -1 if the item is absent. */
int searchItemQuantity(const char *name) {
    int index = findSlot(name);
    return index >= 0 ? table[index].quantity : -1;
}

const char *getItemDescription(const char *name) {
    int index = findSlot(name);
    return index >= 0 ? table[index].description : "";
}

int getInventoryCount(void) {
    int count = 0;
    for (int i = 0; i < SIZE; i++) if (table[i].name[0] != '\0') count++;
    return count;
}

/* These indexed getters let Phaser render the C inventory without duplicating its data. */
static int occupiedSlotAt(int itemNumber) {
    int count = 0;
    if (itemNumber < 0) return -1;
    for (int i = 0; i < SIZE; i++) {
        if (table[i].name[0] != '\0') {
            if (count == itemNumber) return i;
            count++;
        }
    }
    return -1;
}

const char *getItemNameAt(int itemNumber) {
    int index = occupiedSlotAt(itemNumber);
    return index >= 0 ? table[index].name : "";
}

int getItemQuantityAt(int itemNumber) {
    int index = occupiedSlotAt(itemNumber);
    return index >= 0 ? table[index].quantity : 0;
}

const char *getItemDescriptionAt(int itemNumber) {
    int index = occupiedSlotAt(itemNumber);
    return index >= 0 ? table[index].description : "";
}

void display(void) {
    printf("\n--- CIPHER VALLEY INVENTORY ---\n");
    for (int i = 0; i < SIZE; i++) {
        if (table[i].name[0] != '\0') {
            printf("Index %d | %s | Quantity: %d | %s\n", i,
                   table[i].name, table[i].quantity, table[i].description);
        }
    }
}

/* Keep original function names available for compatibility with the original C exercise. */
void insert(char name[], int quantity, char description[]) {
    insertItem(name, quantity, description);
}
void search(char name[]) {
    int quantity = searchItemQuantity(name);
    if (quantity < 0) printf("Item not found.\n");
    else printf("Item found: %s | Quantity: %d | Description: %s\n", name, quantity, getItemDescription(name));
}
