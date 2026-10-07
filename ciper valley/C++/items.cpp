#include <iostream>
#include "items.h"

using namespace std;


// Constructor
Item::Item(string itemName, int itemQuantity, string itemDescription)
{
    name = itemName;
    quantity = itemQuantity;
    description = itemDescription;
}


// Display item
void Item::displayItem()
{
    cout << "\n--- ITEM ---" << endl;
    cout << "Name: " << name << endl;
    cout << "Quantity: " << quantity << endl;
    cout << "Description: " << description << endl;
}


// Add quantity
void Item::addItem(int amount)
{
    quantity += amount;

    cout << amount << " "
         << name
         << " added." << endl;
}


// Use item
void Item::useItem()
{
    if (quantity > 0)
    {
        quantity--;

        cout << name
             << " used." << endl;
    }
    else
    {
        cout << "Item not available." << endl;
    }
}