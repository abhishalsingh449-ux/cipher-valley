#include "items.h"
#include "npc.h"

#include <emscripten.h>
#include <memory>
#include <string>
#include <vector>

namespace {
std::vector<std::unique_ptr<NPC>> npcs;
std::vector<Item> items;
std::string resultBuffer;

Item* findItem(const char* name) {
    if (!name || !*name) return nullptr;
    for (Item& item : items) {
        if (item.getName() == name) return &item;
    }
    return nullptr;
}
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
void worldInit() {
    npcs.clear();
    npcs.emplace_back(std::make_unique<ProgrammingMentor>("Alex", "Programming Mentor"));
    npcs.emplace_back(std::make_unique<LabAssistant>("Sam", "Lab Assistant"));
    npcs.emplace_back(std::make_unique<Shopkeeper>("Riya", "Shopkeeper"));
    items.clear();
}

EMSCRIPTEN_KEEPALIVE
const char* worldNpcName(int index) {
    if (index < 0 || index >= static_cast<int>(npcs.size())) return "";
    return npcs[index]->getName().c_str();
}

EMSCRIPTEN_KEEPALIVE
const char* worldNpcMessage(int index) {
    if (index < 0 || index >= static_cast<int>(npcs.size())) return "";
    resultBuffer = npcs[index]->interactionMessage();
    return resultBuffer.c_str();
}

EMSCRIPTEN_KEEPALIVE
int worldAddItem(const char* name, int quantity, const char* description) {
    if (!name || !*name || quantity <= 0) return 0;
    Item* item = findItem(name);
    if (item) item->addItemQuietly(quantity);
    else items.emplace_back(name, quantity, description ? description : "");
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int worldGetItemQuantity(const char* name) {
    Item* item = findItem(name);
    return item ? item->getQuantity() : 0;
}

EMSCRIPTEN_KEEPALIVE
int worldUseItem(const char* name) {
    Item* item = findItem(name);
    return item && item->tryUseItem() ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int worldGetItemCount() {
    int count = 0;
    for (const Item& item : items) if (item.getQuantity() > 0) ++count;
    return count;
}

EMSCRIPTEN_KEEPALIVE
const char* worldGetItemNameAt(int ordinal) {
    if (ordinal < 0) return "";
    for (const Item& item : items) {
        if (item.getQuantity() <= 0) continue;
        if (ordinal-- == 0) return item.getName().c_str();
    }
    return "";
}

EMSCRIPTEN_KEEPALIVE
void worldClearItems() {
    items.clear();
}

}
