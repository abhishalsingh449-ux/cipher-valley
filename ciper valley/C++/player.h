#ifndef PLAYER_H
#define PLAYER_H

#include <string>
using namespace std;

class Player
{
private:
    string name;
    int energy;
    int level;

public:
    Player(string playerName);

    void displayPlayer();
    void levelUp();
    void useEnergy(int amount);
    void restoreEnergy(int amount);
};

#endif