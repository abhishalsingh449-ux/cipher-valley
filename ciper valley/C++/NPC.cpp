#include "npc.h"
#include <iostream>
#include <utility>

NPC::NPC(std::string npcName, std::string npcRole)
    : name(std::move(npcName)), role(std::move(npcRole)) {}

void NPC::displayNPC() {
    std::cout << "\n--- NPC ---\nName: " << name << "\nRole: " << role << std::endl;
}

std::string NPC::interactionMessage() const { return "Welcome to Cipher Valley!"; }
void NPC::interact() { std::cout << name << " says: " << interactionMessage() << std::endl; }
const std::string& NPC::getName() const { return name; }
const std::string& NPC::getRole() const { return role; }
NPC::~NPC() = default;

ProgrammingMentor::ProgrammingMentor(std::string npcName, std::string npcRole)
    : NPC(std::move(npcName), std::move(npcRole)) {}
std::string ProgrammingMentor::interactionMessage() const { return "Today we are learning Linked Lists!"; }
void ProgrammingMentor::interact() { NPC::interact(); }

LabAssistant::LabAssistant(std::string npcName, std::string npcRole)
    : NPC(std::move(npcName), std::move(npcRole)) {}
std::string LabAssistant::interactionMessage() const { return "The Programming Lab is ready."; }
void LabAssistant::interact() { NPC::interact(); }

Shopkeeper::Shopkeeper(std::string npcName, std::string npcRole)
    : NPC(std::move(npcName), std::move(npcRole)) {}
std::string Shopkeeper::interactionMessage() const { return "I have some useful items for you."; }
void Shopkeeper::interact() { NPC::interact(); }
