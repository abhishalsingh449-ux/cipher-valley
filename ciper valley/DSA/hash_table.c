#include <stdio.h>
#include <string.h>

#define HASH_SIZE 10
#define ITEM_NAME_LEN 50
#define ITEM_DESC_LEN 120
typedef struct {
    char name[ITEM_NAME_LEN];
    int quantity;
    char description[ITEM_DESC_LEN];
    int occupied;
    int deleted; /* tombstone keeps linear-probing searches valid after removal */
} InventoryItem;
static InventoryItem items[HASH_SIZE];

static unsigned hashName(const char *name) {
    unsigned hash = 5381u;
    if (!name) return 0;
    while (*name) hash = ((hash << 5) + hash) + (unsigned char)*name++;
    return hash % HASH_SIZE;
}

static int locate(const char *name, int forInsert) {
    if (!name || !*name) return -1;
    unsigned start = hashName(name);
    int firstDeleted = -1;
    for (int offset = 0; offset < HASH_SIZE; ++offset) {
        int index = (int)((start + offset) % HASH_SIZE);
        if (items[index].occupied && strcmp(items[index].name, name) == 0) return index;
        if (!items[index].occupied) {
            if (items[index].deleted) {
                if (firstDeleted < 0) firstDeleted = index;
                continue;
            }
            if (!forInsert) return -1;
            return firstDeleted >= 0 ? firstDeleted : index;
        }
    }
    return forInsert ? firstDeleted : -1;
}

void insertItem(const char *name, int quantity, const char *description) {
    if (!name || quantity <= 0) return;
    int index = locate(name, 1);
    if (index < 0) return;
    if (!items[index].occupied) {
        memset(&items[index], 0, sizeof(items[index]));
        snprintf(items[index].name, ITEM_NAME_LEN, "%s", name);
        snprintf(items[index].description, ITEM_DESC_LEN, "%s", description ? description : "");
        items[index].occupied = 1;
    } else if (description && *description) {
        snprintf(items[index].description, ITEM_DESC_LEN, "%s", description);
    }
    items[index].quantity += quantity;
}

int searchItemQuantity(const char *name) {
    int index = locate(name, 0);
    return index < 0 ? -1 : items[index].quantity;
}

const char *getItemDescription(const char *name) {
    int index = locate(name, 0);
    return index < 0 ? "" : items[index].description;
}

int decrementItemQuantity(const char *name, int amount) {
    if (amount <= 0) return 0;
    int index = locate(name, 0);
    if (index < 0 || items[index].quantity < amount) return 0;
    items[index].quantity -= amount;
    if (items[index].quantity == 0) {
        items[index].occupied = 0;
        items[index].deleted = 1;
    }
    return 1;
}

int getInventoryCount(void) {
    int count = 0;
    for (int i = 0; i < HASH_SIZE; ++i) if (items[i].occupied) ++count;
    return count;
}

const char *getItemNameAt(int ordinal) {
    if (ordinal < 0) return "";
    for (int i = 0; i < HASH_SIZE; ++i) {
        if (items[i].occupied && ordinal-- == 0) return items[i].name;
    }
    return "";
}

int getItemQuantityAt(int ordinal) {
    if (ordinal < 0) return 0;
    for (int i = 0; i < HASH_SIZE; ++i) {
        if (items[i].occupied && ordinal-- == 0) return items[i].quantity;
    }
    return 0;
}

const char *getItemDescriptionAt(int ordinal) {
    if (ordinal < 0) return "";
    for (int i = 0; i < HASH_SIZE; ++i) {
        if (items[i].occupied && ordinal-- == 0) return items[i].description;
    }
    return "";
}
