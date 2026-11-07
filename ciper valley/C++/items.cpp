#include "items.h"
#include <iostream>

Item::Item(const std::string& itemName, int itemQuantity, const std::string& itemDescription)
    : name(itemName), quantity(itemQuantity < 0 ? 0 : itemQuantity), description(itemDescription) {}

void Item::displayItem() {
    std::cout << "\n--- ITEM ---\nName: " << name << "\nQuantity: " << quantity
              << "\nDescription: " << description << std::endl;
}

void Item::addItem(int amount) {
    if (amount <= 0) return;
    addItemQuietly(amount);
    std::cout << amount << " " << name << " added." << std::endl;
}

void Item::useItem() {
    if (tryUseItem()) std::cout << name << " used." << std::endl;
    else std::cout << "Item not available." << std::endl;
}

void Item::addItemQuietly(int amount) {
    if (amount > 0) quantity += amount;
}

bool Item::tryUseItem() {
    if (quantity <= 0) return false;
    --quantity;
    return true;
}

const std::string& Item::getName() const { return name; }
const std::string& Item::getDescription() const { return description; }
int Item::getQuantity() const { return quantity; }
