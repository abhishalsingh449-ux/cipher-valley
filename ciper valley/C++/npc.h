#ifndef NPC_H
#define NPC_H

#include <string>
using namespace std;


// BASE CLASS
class NPC
{
protected:
    string name;
    string role;

public:
    NPC(string npcName, string npcRole);

    void displayNPC();

    virtual void interact();

    virtual ~NPC();
};


// PROGRAMMING MENTOR
class ProgrammingMentor : public NPC
{
public:
    ProgrammingMentor(string npcName, string npcRole);

    void interact() override;
};


// LAB ASSISTANT
class LabAssistant : public NPC
{
public:
    LabAssistant(string npcName, string npcRole);

    void interact() override;
};


// SHOPKEEPER
class Shopkeeper : public NPC
{
public:
    Shopkeeper(string npcName, string npcRole);

    void interact() override;
};

#endif