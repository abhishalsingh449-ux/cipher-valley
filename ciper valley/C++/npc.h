#ifndef CIPHER_VALLEY_NPC_H
#define CIPHER_VALLEY_NPC_H
#include <string>

class NPC {
protected:
    std::string name;
    std::string role;
public:
    NPC(std::string npcName, std::string npcRole);
    void displayNPC();
    virtual void interact();
    virtual std::string interactionMessage() const;
    const std::string& getName() const;
    const std::string& getRole() const;
    virtual ~NPC();
};

class ProgrammingMentor : public NPC {
public:
    ProgrammingMentor(std::string npcName, std::string npcRole);
    void interact() override;
    std::string interactionMessage() const override;
};

class LabAssistant : public NPC {
public:
    LabAssistant(std::string npcName, std::string npcRole);
    void interact() override;
    std::string interactionMessage() const override;
};

class Shopkeeper : public NPC {
public:
    Shopkeeper(std::string npcName, std::string npcRole);
    void interact() override;
    std::string interactionMessage() const override;
};
#endif
