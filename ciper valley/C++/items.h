#ifndef CIPHER_VALLEY_ITEMS_H
#define CIPHER_VALLEY_ITEMS_H
#include <string>

class Item {
private:
    std::string name;
    int quantity;
    std::string description;
public:
    Item(const std::string& itemName, int itemQuantity, const std::string& itemDescription);
    void displayItem();
    void addItem(int amount);
    void useItem();
    void addItemQuietly(int amount);
    bool tryUseItem();
    const std::string& getName() const;
    const std::string& getDescription() const;
    int getQuantity() const;
};
#endif
