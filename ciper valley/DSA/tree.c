#include <stddef.h>
#include <stdlib.h>

/* Cipher Valley Tree DSA: Binary Search Tree implemented in C. */
typedef struct TreeNode {
    int value;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

static TreeNode *root = NULL;
static int node_count = 0;
static int inorder_values[128];
static int inorder_count = 0;

static void free_nodes(TreeNode *node) {
    if (!node) return;
    free_nodes(node->left);
    free_nodes(node->right);
    free(node);
}

void treeReset(void) {
    free_nodes(root);
    root = NULL;
    node_count = 0;
    inorder_count = 0;
}

int treeInsert(int value) {
    TreeNode **cursor = &root;
    while (*cursor) {
        if ((*cursor)->value == value) return 0; /* Ignore duplicates. */
        cursor = value < (*cursor)->value ? &(*cursor)->left : &(*cursor)->right;
    }
    TreeNode *node = (TreeNode *)malloc(sizeof(TreeNode));
    if (!node) return -1;
    node->value = value;
    node->left = NULL;
    node->right = NULL;
    *cursor = node;
    node_count++;
    return 1;
}

int treeSearch(int value) {
    TreeNode *cursor = root;
    while (cursor) {
        if (cursor->value == value) return 1;
        cursor = value < cursor->value ? cursor->left : cursor->right;
    }
    return 0;
}

static void collect_inorder(TreeNode *node) {
    if (!node || inorder_count >= 128) return;
    collect_inorder(node->left);
    if (inorder_count < 128) inorder_values[inorder_count++] = node->value;
    collect_inorder(node->right);
}

int treeGetCount(void) { return node_count; }

int treeGetInorderAt(int index) {
    if (index < 0 || index >= inorder_count) {
        inorder_count = 0;
        collect_inorder(root);
    }
    if (index < 0 || index >= inorder_count) return -1;
    return inorder_values[index];
}

int treeGetRootValue(void) { return root ? root->value : -1; }
