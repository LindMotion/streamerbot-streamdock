/*
 * launcher.c — Windows CodePathWin fallback for StreamDock node plugins.
 *
 * Use only if FIFINE Control Deck ignores the manifest Nodejs block and
 * cannot launch plugin/index.js directly (SDPluginManager::restartPlugin loop).
 *
 * x86_64-w64-mingw32-gcc -O2 -s -mwindows launcher.c -o launch.exe
 */

#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>

static int fileExists(const wchar_t *p) {
  DWORD a = GetFileAttributesW(p);
  return (a != INVALID_FILE_ATTRIBUTES) && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

int main(void) {
  wchar_t dir[MAX_PATH];
  GetModuleFileNameW(NULL, dir, MAX_PATH);
  wchar_t *slash = wcsrchr(dir, L'\\');
  if (slash) *slash = 0;

  wchar_t script[MAX_PATH];
  swprintf(script, MAX_PATH, L"%ls\\index.js", dir);

  const wchar_t *candidates[] = {
    L"C:\\Program Files (x86)\\fifine Control Deck\\node\\node20.exe",
    L"C:\\Program Files\\fifine Control Deck\\node\\node20.exe",
    L"C:\\Program Files (x86)\\StreamDock\\node\\node20.exe",
    L"C:\\Program Files\\StreamDock\\node\\node20.exe"
  };
  wchar_t envNode[MAX_PATH];
  envNode[0] = 0;
  DWORD en = GetEnvironmentVariableW(L"SD_NODE", envNode, MAX_PATH);
  const wchar_t *node = NULL;
  if (en > 0 && en < MAX_PATH && fileExists(envNode)) node = envNode;
  for (size_t i = 0; !node && i < sizeof(candidates) / sizeof(candidates[0]); i++)
    if (fileExists(candidates[i])) node = candidates[i];
  const wchar_t *nodeExe = node ? node : L"node.exe";

  wchar_t *rest = GetCommandLineW();
  if (*rest == L'"') {
    rest++;
    while (*rest && *rest != L'"') rest++;
    if (*rest == L'"') rest++;
  } else {
    while (*rest && *rest != L' ' && *rest != L'\t') rest++;
  }

  size_t len = wcslen(nodeExe) + wcslen(script) + wcslen(rest) + 16;
  wchar_t *cmd = (wchar_t *)malloc(len * sizeof(wchar_t));
  if (!cmd) return 1;
  swprintf(cmd, len, L"\"%ls\" \"%ls\"%ls", nodeExe, script, rest);

  STARTUPINFOW si;
  PROCESS_INFORMATION pi;
  ZeroMemory(&si, sizeof(si));
  si.cb = sizeof(si);
  ZeroMemory(&pi, sizeof(pi));

  if (!CreateProcessW(NULL, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, dir, &si, &pi)) {
    wchar_t errPath[MAX_PATH];
    swprintf(errPath, MAX_PATH, L"%ls\\launch-error.log", dir);
    HANDLE h = CreateFileW(errPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h != INVALID_HANDLE_VALUE) {
      char buf[256];
      DWORD wrote;
      int n = snprintf(buf, sizeof(buf), "CreateProcess failed (err %lu)\n", GetLastError());
      WriteFile(h, buf, (DWORD)n, &wrote, NULL);
      CloseHandle(h);
    }
    return 1;
  }

  WaitForSingleObject(pi.hProcess, INFINITE);
  DWORD code = 0;
  GetExitCodeProcess(pi.hProcess, &code);
  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);
  return (int)code;
}
