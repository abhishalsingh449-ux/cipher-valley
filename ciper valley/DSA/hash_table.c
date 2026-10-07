#include <stdio.h>
#include <string.h>

#define SIZE 10

struct Item
{
    char name[50];
    int quantity;
    char description[100];
};

struct Item table[SIZE];


// HASH FUNCTION
int hashFunction(char item[])
{
    return item[0] % SIZE;
}


// INSERT
void insert(char name[], int quantity, char description[])
{
    int index = hashFunction(name);
    int start = index;

    while (table[index].name[0] != '\0')
    {
        index = (index + 1) % SIZE;

        if (index == start)
        {
            printf("Inventory is full.\n");
            return;
        }
    }

    strcpy(table[index].name, name);
    table[index].quantity = quantity;
    strcpy(table[index].description, description);

    printf("%s added to inventory.\n", name);
}


// SEARCH
void search(char name[])
{
    int index = hashFunction(name);
    int start = index;

    while (table[index].name[0] != '\0')
    {
        if (strcmp(table[index].name, name) == 0)
        {
            printf("\nItem Found!\n");
            printf("Name: %s\n", table[index].name);
            printf("Quantity: %d\n", table[index].quantity);
            printf("Description: %s\n", table[index].description);
            return;
        }

        index = (index + 1) % SIZE;

        if (index == start)
            break;
    }

    printf("Item not found.\n");
}


// DISPLAY
void display()
{
    printf("\n--- CIPHER VALLEY INVENTORY ---\n");

    for (int i = 0; i < SIZE; i++)
    {
        if (table[i].name[0] != '\0')
        {
            printf("\nIndex %d\n", i);
            printf("Name: %s\n", table[i].name);
            printf("Quantity: %d\n", table[i].quantity);
            printf("Description: %s\n", table[i].description);
        }
    }
}


