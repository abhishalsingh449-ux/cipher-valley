#include <string.h>

/* The vending-machine dispenser logic used by the Coffee Crisis quest. */
int vendingCanDispense(int stock, int requested) {
    return stock >= 0 && requested > 0 && requested <= stock;
}

int vendingDispense(int stock, int requested) {
    return vendingCanDispense(stock, requested) ? requested : 0;
}

int vendingRunTests(void) {
    static const int stocks[] = {5, 5, 5, 3, 0};
    static const int requests[] = {2, 6, 0, 3, 1};
    static const int expected[] = {2, 0, 0, 3, 0};
    int passed = 0;
    for (int i = 0; i < 5; ++i) {
        if (vendingDispense(stocks[i], requests[i]) == expected[i]) ++passed;
    }
    return passed;
}

/* The player fills the missing parameter name, then the C tests run. */
int vendingValidateFix(const char *replacement) {
    if (!replacement || strcmp(replacement, "stock") != 0) return 0;
    return vendingRunTests() == 5 ? 1 : 0;
}
