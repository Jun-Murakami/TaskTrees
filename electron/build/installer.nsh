; Fix: electron-builder's default NSIS upgrade runs the old uninstaller which
; uses PowerShell Get-CimInstance to check ALL processes in $INSTDIR, causing
; false positives. The old uninstaller is already compiled and cannot be fixed.
; Solution: Remove old uninstall registry key BEFORE uninstallOldVersion runs,
; so it skips the old uninstaller entirely. New installer overwrites files directly.
; See: https://github.com/electron-userland/electron-builder/issues/8131

!include "getProcessInfo.nsh"
Var /GLOBAL pid

; --- customInit: prevent old uninstaller from running ---
; Runs in .onInit AFTER initMultiUser (SHELL_CONTEXT is set).
; uninstallOldVersion checks UNINSTALL_REGISTRY_KEY for UninstallString.
; If key is missing, it returns early without running old uninstaller.
!macro customInit
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
