$ErrorActionPreference = 'Stop'
$gameDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = $null
$ownsServer = $false

Set-Location -LiteralPath $gameDirectory
$Host.UI.RawUI.WindowTitle = 'Archipel Nova - Launcher'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NovaWindow {
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@

function Minimize-Launcher {
    $window = [NovaWindow]::GetConsoleWindow()
    if ($window -ne [IntPtr]::Zero) { [void][NovaWindow]::ShowWindow($window, 6) }
}

function Write-Title {
    Clear-Host
    Write-Host '==================================================' -ForegroundColor Cyan
    Write-Host '          ARCHIPEL NOVA - SAISON ZERO' -ForegroundColor White
    Write-Host '==================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Get-FreePort {
    foreach ($candidate in 8765..8785) {
        if (-not (Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue)) {
            return $candidate
        }
    }
    throw 'Aucun port local disponible entre 8765 et 8785.'
}

function Find-ServerCommand([int]$port) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        return @{ File = $node.Source; Arguments = @('server.js', $port) }
    }

    foreach ($candidate in @('py', 'python')) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if (-not $command) { continue }
        & $command.Source --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return @{ File = $command.Source; Arguments = @('-m', 'http.server', $port, '--bind', '127.0.0.1') }
        }
    }
    return $null
}

function Wait-ForGame([string]$url, [System.Diagnostics.Process]$process) {
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        if ($process.HasExited) { return $false }
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
    return $false
}

Write-Title

if (-not (Test-Path -LiteralPath (Join-Path $gameDirectory 'index.html'))) {
    Write-Host '[ERREUR] Le fichier index.html est introuvable.' -ForegroundColor Red
    [void](Read-Host 'Appuie sur Entree pour fermer')
    exit 1
}

try {
    Write-Host '[1/3] Recherche du moteur local...' -ForegroundColor Gray
    $port = Get-FreePort
    $url = "http://127.0.0.1:$port/index.html"
    $serverCommand = Find-ServerCommand $port
    if (-not $serverCommand) {
        throw 'Node.js ou Python est necessaire pour lancer le jeu.'
    }

    Write-Host '[2/3] Demarrage du serveur...' -ForegroundColor Gray
    $server = Start-Process -FilePath $serverCommand.File `
        -ArgumentList $serverCommand.Arguments `
        -WorkingDirectory $gameDirectory `
        -WindowStyle Hidden `
        -PassThru
    $ownsServer = $true

    if (-not (Wait-ForGame $url $server)) {
        if ($server.HasExited) {
            throw "Le serveur s'est arrete au demarrage (code $($server.ExitCode))."
        }
        throw "Le jeu n'a pas repondu a temps sur $url."
    }

    Write-Host '[3/3] Ouverture du jeu...' -ForegroundColor Gray
    Start-Process $url
    Write-Host ''
    Write-Host 'JEU LANCE AVEC SUCCES !' -ForegroundColor Green
    Write-Host "Adresse : $url" -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'Le launcher va se reduire automatiquement.' -ForegroundColor Yellow
    Write-Host 'Restaure cette fenetre puis appuie sur Entree pour arreter.' -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    Minimize-Launcher
    [void](Read-Host)
}
catch {
    Write-Host ''
    Write-Host "[ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Verifie que Node.js est installe, puis reessaie.' -ForegroundColor Yellow
    [void](Read-Host 'Appuie sur Entree pour fermer')
    exit 1
}
finally {
    if ($ownsServer -and $server -and -not $server.HasExited) {
        Write-Host 'Arret du serveur...' -ForegroundColor Gray
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
