#include <iostream>
#include "NPC.h"

using namespace std;


// ==================== NPC BASE CLASS ====================

// Constructor
NPC::NPC(string npcName, string npcRole)
{
    name = npcName;
    role = npcRole;
}


// Display NPC information
void NPC::displayNPC()
{
    cout << "\n--- NPC ---" << endl;
    cout << "Name: " << name << endl;
    cout << "Role: " << role << endl;
}


// Default interaction
void NPC::interact()
{
    cout << name
         << " says: Welcome to Cipher Valley!"
         << endl;
}


// Destructor
NPC::~NPC()
{
}


// ==================== PROGRAMMING MENTOR ====================

ProgrammingMentor::ProgrammingMentor(
    string npcName,
    string npcRole
)
    : NPC(npcName, npcRole)
{
}


void ProgrammingMentor::interact()
{
    cout << name
         << " says: Today we are learning Linked Lists!"
         << endl;
}


// ==================== LAB ASSISTANT ====================

LabAssistant::LabAssistant(
    string npcName,
    string npcRole
)
    : NPC(npcName, npcRole)
{
}


void LabAssistant::interact()
{
    cout << name
         << " says: The Programming Lab is ready."
         << endl;
}


// ==================== SHOPKEEPER ====================

Shopkeeper::Shopkeeper(
    string npcName,
    string npcRole
)
    : NPC(npcName, npcRole)
{
}


void Shopkeeper::interact()
{
    cout << name
         << " says: I have some useful items for you."
         << endl;
}