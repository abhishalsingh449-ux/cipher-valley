#ifndef ITEMS_H
#define ITEMS_H

#include <string>
using namespace std;

class Item
{
private:
    string name;
    int quantity;
    string description;

public:
    Item(string itemName, int itemQuantity, string itemDescription);

    void displayItem();
    void addItem(int amount);
    void useItem();
};

#endif