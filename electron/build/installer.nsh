; Custom NSIS hooks for TaskTrees installer.
;
; Fix 1: Install directory name correction.
;   After repo merge, package.json "name" changed from "tasktrees-electron" to
;   "tasktree-s", which changed the default install folder (APP_FILENAME).
;   We override $INSTDIR to maintain the legacy folder name so upgrades work
;   and existing installs are found correctly.
;
; Fix 2: Skip old uninstaller on upgrade.
;   electron-builder's default upgrade runs the old (already-compiled) uninstaller
;   which uses PowerShell Get-CimInstance to check ALL processes in $INSTDIR,
;   causing false positives. We remove UNINSTALL_REGISTRY_KEY before
;   uninstallOldVersion runs so it returns early, skipping the old uninstaller.
;   The new installer overwrites files directly.
;   See: https://github.com/electron-userland/electron-builder/issues/8131
;
; Fix 3: Exact process detection with nsProcess.
;   Replaces default PowerShell-based detection with nsProcess::FindProcess
;   for exact exe name matching (customCheckAppRunning below).

!include "getProcessInfo.nsh"
Var /GLOBAL pid

; --- customInit: fix install dir + prevent old uninstaller from running ---
; Runs in .onInit AFTER initMultiUser sets SHELL_CONTEXT and $INSTDIR.
!macro customInit
  ; Fix install directory: if no existing InstallLocation in registry,
  ; initMultiUser defaults to "$LOCALAPPDATA\Programs\${APP_FILENAME}" which
  ; resolves to "tasktree-s" (wrong). Override to legacy "tasktrees-electron".
  ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $0 == ""
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\tasktrees-electron"
  ${endif}

  ; Skip old uninstaller: delete UNINSTALL_REGISTRY_KEY so uninstallOldVersion
  ; finds no UninstallString and returns early.
  DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
!macroend

; --- customCheckAppRunning: use nsProcess for exact exe name matching ---
; Replaces default PowerShell Get-CimInstance which checks ALL processes in $INSTDIR.
!macro customCheckAppRunning
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${if} ${isUpdated}
      Sleep 300
    ${endIf}

    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      ${if} ${isUpdated}
        Sleep 1000
        Goto _customStopProcess
      ${endIf}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK _customStopProcess
      Quit

      _customStopProcess:
        DetailPrint "$(appClosing)"
        ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        Sleep 300

        StrCpy $R1 0
      _customLoop:
        IntOp $R1 $R1 + 1
        ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          Sleep 1000
          ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
          ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto _customNotRunning
          ${endIf}
        ${else}
          Goto _customNotRunning
        ${endIf}

        ${if} $R1 > 1
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY _customLoop
          Quit
        ${else}
          Goto _customLoop
        ${endIf}
      _customNotRunning:
    ${endIf}
  ${endIf}
!macroend
