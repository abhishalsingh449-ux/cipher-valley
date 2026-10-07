#include <iostream>
#include "player.h"

using namespace std;


// Constructor
Player::Player(string playerName)
{
    name = playerName;
    energy = 100;
    level = 1;
}


// Display player information
void Player::displayPlayer()
{
    cout << "\n--- PLAYER ---" << endl;
    cout << "Name: " << name << endl;
    cout << "Level: " << level << endl;
    cout << "Energy: " << energy << endl;
}


// Increase level
void Player::levelUp()
{
    level++;

    cout << name
         << " reached Level "
         << level << "!" << endl;
}


// Use energy
void Player::useEnergy(int amount)
{
    if (energy >= amount)
    {
        energy -= amount;

        cout << "Energy used: "
             << amount << endl;
    }
    else
    {
        cout << "Not enough energy!" << endl;
    }
}


// Restore energy
void Player::restoreEnergy(int amount)
{
    energy += amount;

    if (energy > 100)
    {
        energy = 100;
    }

    cout << "Energy restored!" << endl;
}