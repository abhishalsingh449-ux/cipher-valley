#include "player.h"

static Player* activePlayer = nullptr;

extern "C" {

int playerInit(const char* name) {
    delete activePlayer;
    activePlayer = new Player(name ? name : "Cipher Valley Player");
    return 1;
}

void playerAddXP(int amount) {
    if (activePlayer) {
        activePlayer->addXP(amount);
    }
}

int playerUseEnergy(int amount) {
    if (!activePlayer) return 0;
    return activePlayer->tryUseEnergy(amount) ? 1 : 0;
}

void playerRestoreEnergy(int amount) {
    if (activePlayer) {
        activePlayer->restoreEnergyQuietly(amount);
    }
}

int playerGetEnergy() {
    return activePlayer ? activePlayer->getEnergy() : 0;
}

int playerGetLevel() {
    return activePlayer ? activePlayer->getLevel() : 1;
}

int playerGetXP() {
    return activePlayer ? activePlayer->getXP() : 0;
}

void playerDisplay() {
    if (activePlayer) {
        activePlayer->displayPlayer();
    }
}

}