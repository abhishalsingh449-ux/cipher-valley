#include "player.h"
#include <iostream>

using namespace std;

Player::Player(const string& playerName)
    : name(playerName), energy(100), level(1), xp(0) {}

void Player::displayPlayer() {
    cout << "\n--- PLAYER ---" << endl;
    cout << "Name: " << name << endl;
    cout << "Level: " << level << endl;
    cout << "Energy: " << energy << endl;
    cout << "XP: " << xp << endl;
}

void Player::levelUp() {
    ++level;
    cout << name << " reached Level " << level << "!" << endl;
}

// Preserves the original void method used by existing C++ code.
void Player::useEnergy(int amount) {
    if (tryUseEnergy(amount)) {
        cout << "Energy used: " << amount << endl;
    } else {
        cout << "Not enough energy!" << endl;
    }
}

// Non-printing version used by the real-time game loop.
bool Player::tryUseEnergy(int amount) {
    if (amount <= 0 || energy < amount) {
        return false;
    }
    energy -= amount;
    return true;
}

void Player::restoreEnergy(int amount) {
    if (amount <= 0) return;
    restoreEnergyQuietly(amount);
    cout << "Energy restored!" << endl;
}

// Used by the real-time game loop to avoid printing a console message every tick.
void Player::restoreEnergyQuietly(int amount) {
    if (amount <= 0) return;
    if (amount >= 100 - energy) {
        energy = 100;
    } else {
        energy += amount;
    }
}

void Player::addXP(int amount) {
    if (amount <= 0) return;
    xp += amount;

    // Level 2 at 25 total XP, level 3 at 50, level 4 at 75, etc.
    while (xp >= level * 25) {
        levelUp();
    }
}

int Player::getEnergy() const { return energy; }
int Player::getLevel() const { return level; }
int Player::getXP() const { return xp; }
