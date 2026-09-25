Option Explicit

Dim shell, fileSystem, scriptDirectory, launcher, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
launcher = fileSystem.BuildPath(scriptDirectory, "launcher-gui.ps1")
command = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & launcher & """"

' 0 = fenetre totalement masquee. False = le .bat peut se fermer immediatement.
shell.Run command, 0, False
