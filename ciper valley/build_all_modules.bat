@echo off
setlocal
set "GAME_ROOT=%~dp0"
set "SDK_ROOT=%GAME_ROOT%emsdk"

if not exist "%SDK_ROOT%\upstream\emscripten\emcc.exe" (
    echo Emscripten SDK was not found at "%SDK_ROOT%".
    exit /b 1
)

rem The SDK's compiler launcher calls python.exe, so expose its bundled Python.
set "PATH=%SDK_ROOT%\python\3.13.3_64bit;%PATH%"
call "%SDK_ROOT%\emsdk_env.bat" >nul
set "EMCC=%SDK_ROOT%\upstream\emscripten\emcc.exe"
set "EMXX=%SDK_ROOT%\upstream\emscripten\em++.exe"
set "C_FLAGS=-s MODULARIZE=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s ALLOW_MEMORY_GROWTH=1"

pushd "%GAME_ROOT%"

"%EMCC%" DSA\linked_list.c -std=c11 -o linked_list.js %C_FLAGS% -s EXPORT_NAME=createLinked_list -s EXPORTED_FUNCTIONS=['_addQuest','_completeQuest','_isQuestCompleted','_getQuestCount','_displayQuests','_clearQuests']
if errorlevel 1 goto :failed

"%EMCC%" DSA\hash_table.c -std=c11 -o hash_table.js %C_FLAGS% -s EXPORT_NAME=createHash_table -s EXPORTED_FUNCTIONS=['_insertItem','_searchItemQuantity','_getItemDescription','_decrementItemQuantity','_getInventoryCount','_getItemNameAt','_getItemQuantityAt','_getItemDescriptionAt']
if errorlevel 1 goto :failed

"%EMCC%" DSA\stack.c -std=c11 -o stack_module.js %C_FLAGS% -s EXPORT_NAME=createStackModule -s EXPORTED_FUNCTIONS=['_stackPush','_stackPopAction','_stackPeekAction','_stackGetCount','_stackDropOldest','_stackGetActionAt','_stackClear']
if errorlevel 1 goto :failed

"%EMCC%" DSA\queue.c -std=c11 -o queue_module.js %C_FLAGS% -s EXPORT_NAME=createQueueModule -s EXPORTED_FUNCTIONS=['_queueAddTask','_queueProcessNextTask','_queuePeekTask','_queueRemoveTask','_queueGetCount','_queueGetTaskAt','_queueClear']
if errorlevel 1 goto :failed

"%EMCC%" DSA\tree.c -std=c11 -o tree_module.js %C_FLAGS% -s EXPORT_NAME=createTreeModule -s EXPORTED_FUNCTIONS=['_treeReset','_treeInsert','_treeSearch','_treeGetCount','_treeGetInorderAt','_treeGetRootValue']
if errorlevel 1 goto :failed

"%EMXX%" C++\player.cpp C++\player_bridge.cpp -std=c++17 -o C++\player_module.js %C_FLAGS% -s EXPORT_NAME=createPlayerModule -s EXPORTED_FUNCTIONS=['_playerInit','_playerAddXP','_playerUseEnergy','_playerRestoreEnergy','_playerGetEnergy','_playerGetLevel','_playerGetXP','_playerDisplay']
if errorlevel 1 goto :failed

"%EMXX%" C++\quest.cpp C++\quest_bridge.cpp -std=c++17 -o C++\quest_module.js %C_FLAGS% -s EXPORT_NAME=createQuestModule -s EXPORTED_FUNCTIONS=['_isLinkedListQuestCompleted','_getLinkedListQuestId','_getLinkedListQuestXP','_completeLinkedListQuest']
if errorlevel 1 goto :failed

"%EMXX%" C++\NPC.cpp C++\items.cpp C++\world_bridge.cpp -std=c++17 -o C++\world_module.js %C_FLAGS% -s EXPORT_NAME=createWorldModule -s EXPORTED_FUNCTIONS=['_worldInit','_worldNpcName','_worldNpcMessage','_worldAddItem','_worldGetItemQuantity','_worldUseItem','_worldGetItemCount','_worldGetItemNameAt','_worldClearItems']
if errorlevel 1 goto :failed

popd
echo All Cipher Valley WebAssembly modules compiled successfully.
exit /b 0

:failed
set "BUILD_ERROR=%ERRORLEVEL%"
popd
echo WebAssembly build failed with exit code %BUILD_ERROR%.
exit /b %BUILD_ERROR%
