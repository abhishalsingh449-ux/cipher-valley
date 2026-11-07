#ifndef CIPHER_VALLEY_PLAYER_H
#define CIPHER_VALLEY_PLAYER_H

#include <string>

class Player {
private:
    std::string name;
    int energy;
    int level;
    int xp;

public:
    explicit Player(const std::string& playerName);

    // Original Player API retained.
    void displayPlayer();
    void levelUp();
    void useEnergy(int amount);
    void restoreEnergy(int amount);

    // Added integration methods for Phaser.js/WebAssembly.
    bool tryUseEnergy(int amount);
    void restoreEnergyQuietly(int amount);
    void addXP(int amount);
    int getEnergy() const;
    int getLevel() const;
    int getXP() const;
};

#endif
