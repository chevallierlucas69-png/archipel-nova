param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$gameDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = $null
$gameUrl = $null

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading;
using System.Windows.Forms;

public static class NovaExceptionGuard
{
    public static void Install(string logPath)
    {
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs args)
        {
            Exception error = args.Exception;
            if (IsPipelineStopped(error)) return;
            try { File.AppendAllText(logPath, DateTime.Now.ToString("s") + " | " + error + Environment.NewLine); } catch { }
            MessageBox.Show("Le launcher a rencontre une erreur. Consulte launcher-error.log.", "Archipel Nova", MessageBoxButtons.OK, MessageBoxIcon.Error);
        };
    }

    private static bool IsPipelineStopped(Exception error)
    {
        while (error != null)
        {
            if (error.GetType().FullName == "System.Management.Automation.PipelineStoppedException") return true;
            error = error.InnerException;
        }
        return false;
    }
}
'@ -ReferencedAssemblies @('System.Windows.Forms.dll', 'System.dll')

[NovaExceptionGuard]::Install((Join-Path $gameDirectory 'launcher-error.log'))

function Get-FreePort {
    foreach ($port in 8765..8785) {
        if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { return $port }
    }
    throw 'Aucun port local disponible.'
}

function Stop-GameServer {
    if ($script:server -and -not $script:server.HasExited) {
        Stop-Process -Id $script:server.Id -Force -ErrorAction SilentlyContinue
    }
    $script:server = $null
}

function Test-GameFiles {
    $required = @(
        'index.html','style.css','game3d.js','server.js',
        'vendor\three.module.js','vendor\three.core.js','vendor\PointerLockControls.js',
        'assets\nova-guardian.png','assets\nova-island-map.png','assets\lobby-bg-realistic-v2.png','assets\favicon.svg'
    )
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $gameDirectory $_)) })
    if ($missing.Count) { throw "Fichiers manquants : $($missing -join ', ')" }
    foreach ($file in $required) {
        if ((Get-Item -LiteralPath (Join-Path $gameDirectory $file)).Length -eq 0) { throw "Fichier vide : $file" }
    }
    return $required.Count
}

if ($SelfTest) {
    $testServer = $null
    try {
        $fileCount = Test-GameFiles
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) { throw 'Node.js est introuvable.' }
        $port = Get-FreePort
        $url = "http://127.0.0.1:$port/index.html"
        $testServer = Start-Process -FilePath $node.Source -ArgumentList @('server.js', $port) -WorkingDirectory $gameDirectory -WindowStyle Hidden -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ($testServer.HasExited) { throw "Le serveur de test s'est arrete (code $($testServer.ExitCode))." }
            try {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
                if ($response.StatusCode -eq 200 -and $response.Content -match 'Archipel Nova') {
                    $ready = $true
                    break
                }
            } catch { }
            Start-Sleep -Milliseconds 120
        }
        if (-not $ready) { throw "Le jeu n'a pas repondu pendant l'auto-test." }
        [PSCustomObject]@{
            Passed = $true
            Files = $fileCount
            Node = (& $node.Source --version)
            Port = $port
            ServerResponded = $true
        } | ConvertTo-Json -Compress
        exit 0
    } catch {
        [PSCustomObject]@{
            Passed = $false
            Error = $_.Exception.Message
        } | ConvertTo-Json -Compress
        exit 1
    } finally {
        if ($testServer -and -not $testServer.HasExited) {
            Stop-Process -Id $testServer.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Open-GameWindow([string]$url) {
    $browsers = @(
        @{ Path = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"; Args = @('--new-window', '--window-size=1280,800', '--window-position=80,60', '--no-first-run', $url) },
        @{ Path = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"; Args = @('--new-window', '--window-size=1280,800', '--window-position=80,60', '--no-first-run', $url) },
        @{ Path = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"; Args = @('--new-window', '--window-size=1280,800', '--window-position=80,60', '--no-first-run', $url) },
        @{ Path = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"; Args = @('--new-window', '--window-size=1280,800', '--window-position=80,60', '--no-first-run', $url) },
        @{ Path = "$env:LOCALAPPDATA\Programs\Opera\opera.exe"; Args = @('--new-window', '--window-size=1280,800', '--window-position=80,60', $url) }
    )
    foreach ($browser in $browsers) {
        if (Test-Path -LiteralPath $browser.Path) {
            Start-Process -FilePath $browser.Path -ArgumentList $browser.Args
            return
        }
    }
    Start-Process $url
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Archipel Nova - Launcher'
$form.Size = New-Object System.Drawing.Size(900, 560)
$form.MinimumSize = New-Object System.Drawing.Size(760, 500)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(9, 17, 32)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$hero = New-Object System.Windows.Forms.Panel
$hero.Dock = 'Fill'
$hero.BackColor = [System.Drawing.Color]::FromArgb(18, 45, 76)
$form.Controls.Add($hero)

$accent = New-Object System.Windows.Forms.Panel
$accent.Dock = 'Left'; $accent.Width = 12
$accent.BackColor = [System.Drawing.Color]::FromArgb(65, 218, 255)
$hero.Controls.Add($accent)

$season = New-Object System.Windows.Forms.Label
$season.Text = 'SAISON ZERO  |  PROTOTYPE LOCAL'
$season.AutoSize = $true; $season.Location = New-Object System.Drawing.Point(55, 48)
$season.ForeColor = [System.Drawing.Color]::FromArgb(91, 225, 255)
$season.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
$hero.Controls.Add($season)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'ARCHIPEL NOVA'
$title.AutoSize = $true; $title.Location = New-Object System.Drawing.Point(48, 78)
$title.Font = New-Object System.Drawing.Font('Segoe UI Black', 34)
$hero.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Explore l'ile, construis et remporte la victoire."
$subtitle.AutoSize = $true; $subtitle.Location = New-Object System.Drawing.Point(55, 145)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(190, 211, 230)
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 13)
$hero.Controls.Add($subtitle)

$news = New-Object System.Windows.Forms.Panel
$news.Size = New-Object System.Drawing.Size(255, 118); $news.Location = New-Object System.Drawing.Point(570, 48)
$news.BackColor = [System.Drawing.Color]::FromArgb(28, 61, 96); $hero.Controls.Add($news)
$newsTitle = New-Object System.Windows.Forms.Label
$newsTitle.Text = 'NOUVEAUTES 0.9'; $newsTitle.AutoSize = $true; $newsTitle.Location = New-Object System.Drawing.Point(16, 14)
$newsTitle.ForeColor = [System.Drawing.Color]::FromArgb(255, 224, 79); $newsTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10); $news.Controls.Add($newsTitle)
$newsText = New-Object System.Windows.Forms.Label
$newsText.Text = "Bus Nova et planeur`n4 armes et inventaire`nIA, tempete et constructions"
$newsText.AutoSize = $true; $newsText.Location = New-Object System.Drawing.Point(16, 41)
$newsText.ForeColor = [System.Drawing.Color]::FromArgb(205, 222, 237); $news.Controls.Add($newsText)

$card = New-Object System.Windows.Forms.Panel
$card.Size = New-Object System.Drawing.Size(770, 240)
$card.Location = New-Object System.Drawing.Point(55, 205)
$card.BackColor = [System.Drawing.Color]::FromArgb(11, 27, 49)
$hero.Controls.Add($card)

$statusDot = New-Object System.Windows.Forms.Label
$statusDot.Text = [char]0x25CF; $statusDot.AutoSize = $true
$statusDot.Location = New-Object System.Drawing.Point(28, 25)
$statusDot.ForeColor = [System.Drawing.Color]::FromArgb(255, 210, 70)
$statusDot.Font = New-Object System.Drawing.Font('Segoe UI', 14)
$card.Controls.Add($statusDot)

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Pret a demarrer'; $status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(57, 29)
$status.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 12)
$card.Controls.Add($status)

$details = New-Object System.Windows.Forms.Label
$details.Text = 'Le serveur local sera lance automatiquement.'
$details.AutoSize = $true; $details.Location = New-Object System.Drawing.Point(31, 67)
$details.ForeColor = [System.Drawing.Color]::FromArgb(155, 177, 198)
$card.Controls.Add($details)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(34, 104)
$progress.Size = New-Object System.Drawing.Size(700, 8)
$progress.Style = 'Continuous'; $progress.Value = 0
$card.Controls.Add($progress)

$play = New-Object System.Windows.Forms.Button
$play.Text = 'JOUER'
$play.Location = New-Object System.Drawing.Point(34, 145)
$play.Size = New-Object System.Drawing.Size(455, 58)
$play.FlatStyle = 'Flat'; $play.FlatAppearance.BorderSize = 0
$play.BackColor = [System.Drawing.Color]::FromArgb(248, 220, 60)
$play.ForeColor = [System.Drawing.Color]::FromArgb(18, 25, 37)
$play.Font = New-Object System.Drawing.Font('Segoe UI Black', 16)
$card.Controls.Add($play)

$stop = New-Object System.Windows.Forms.Button
$stop.Text = 'ARRETER'
$stop.Location = New-Object System.Drawing.Point(505, 145)
$stop.Size = New-Object System.Drawing.Size(229, 58)
$stop.FlatStyle = 'Flat'; $stop.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(76, 115, 148)
$stop.BackColor = [System.Drawing.Color]::FromArgb(20, 50, 80)
$stop.ForeColor = [System.Drawing.Color]::White
$stop.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 12)
$stop.Enabled = $false
$card.Controls.Add($stop)

$footer = New-Object System.Windows.Forms.Label
$footer.Text = 'Version locale 0.9  |  Three.js  |  Aucun paiement reel'
$footer.AutoSize = $true; $footer.Location = New-Object System.Drawing.Point(55, 475)
$footer.ForeColor = [System.Drawing.Color]::FromArgb(105, 133, 158)
$hero.Controls.Add($footer)

$verify = New-Object System.Windows.Forms.Button
$verify.Text = 'VERIFIER LES FICHIERS'; $verify.Location = New-Object System.Drawing.Point(545, 465); $verify.Size = New-Object System.Drawing.Size(155, 34)
$verify.FlatStyle = 'Flat'; $verify.BackColor = [System.Drawing.Color]::FromArgb(20, 50, 80); $verify.ForeColor = [System.Drawing.Color]::White; $hero.Controls.Add($verify)
$folder = New-Object System.Windows.Forms.Button
$folder.Text = 'OUVRIR LE DOSSIER'; $folder.Location = New-Object System.Drawing.Point(710, 465); $folder.Size = New-Object System.Drawing.Size(130, 34)
$folder.FlatStyle = 'Flat'; $folder.BackColor = [System.Drawing.Color]::FromArgb(20, 50, 80); $folder.ForeColor = [System.Drawing.Color]::White; $hero.Controls.Add($folder)

# Refonte visuelle du launcher Nova.
$form.FormBorderStyle = 'None'
$form.Size = New-Object System.Drawing.Size(1040, 640)
$form.MinimumSize = New-Object System.Drawing.Size(1040, 640)
$form.Padding = New-Object System.Windows.Forms.Padding(1)
$form.BackColor = [System.Drawing.Color]::FromArgb(65, 217, 255)
$hero.BackColor = [System.Drawing.Color]::FromArgb(7, 16, 31)
$accent.Width = 5

$hero.Add_Paint({
    param($sender, $e)
    $bounds = $sender.ClientRectangle
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bounds, [System.Drawing.Color]::FromArgb(8, 20, 39), [System.Drawing.Color]::FromArgb(16, 33, 67), 18)
    $e.Graphics.FillRectangle($brush, $bounds)
    $brush.Dispose()
})

# Barre de titre personnalisee.
$titleBar = New-Object System.Windows.Forms.Panel
$titleBar.Dock = 'Top'; $titleBar.Height = 48
$titleBar.BackColor = [System.Drawing.Color]::FromArgb(5, 12, 25)
$hero.Controls.Add($titleBar); $titleBar.BringToFront()
$appMark = New-Object System.Windows.Forms.Label
$appMark.Text = 'N'; $appMark.TextAlign = 'MiddleCenter'; $appMark.Location = New-Object System.Drawing.Point(16, 9); $appMark.Size = New-Object System.Drawing.Size(30, 30)
$appMark.BackColor = [System.Drawing.Color]::FromArgb(58, 198, 235); $appMark.ForeColor = [System.Drawing.Color]::White
$appMark.Font = New-Object System.Drawing.Font('Segoe UI Black', 13); $titleBar.Controls.Add($appMark)
$appName = New-Object System.Windows.Forms.Label
$appName.Text = 'ARCHIPEL NOVA'; $appName.AutoSize = $true; $appName.Location = New-Object System.Drawing.Point(56, 15)
$appName.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10); $appName.ForeColor = [System.Drawing.Color]::FromArgb(218, 236, 249); $titleBar.Controls.Add($appName)
$channel = New-Object System.Windows.Forms.Label
$channel.Text = 'LOCAL BUILD'; $channel.AutoSize = $true; $channel.Location = New-Object System.Drawing.Point(180, 17)
$channel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 7); $channel.ForeColor = [System.Drawing.Color]::FromArgb(80, 205, 235); $titleBar.Controls.Add($channel)
$minimize = New-Object System.Windows.Forms.Button
$minimize.Text = [char]0x2014; $minimize.Location = New-Object System.Drawing.Point(946, 0); $minimize.Size = New-Object System.Drawing.Size(46, 47); $minimize.FlatStyle = 'Flat'; $minimize.FlatAppearance.BorderSize = 0; $minimize.BackColor = $titleBar.BackColor; $minimize.ForeColor = [System.Drawing.Color]::FromArgb(160, 185, 205); $titleBar.Controls.Add($minimize)
$close = New-Object System.Windows.Forms.Button
$close.Text = [char]0x00D7; $close.Location = New-Object System.Drawing.Point(992, 0); $close.Size = New-Object System.Drawing.Size(46, 47); $close.FlatStyle = 'Flat'; $close.FlatAppearance.BorderSize = 0; $close.BackColor = $titleBar.BackColor; $close.ForeColor = [System.Drawing.Color]::FromArgb(190, 210, 224); $close.Font = New-Object System.Drawing.Font('Segoe UI', 15); $titleBar.Controls.Add($close)
$minimize.Add_Click({ $form.WindowState = 'Minimized' }); $close.Add_Click({ $form.Close() })
$close.Add_MouseEnter({ $close.BackColor = [System.Drawing.Color]::FromArgb(164, 48, 69) }); $close.Add_MouseLeave({ $close.BackColor = $titleBar.BackColor })
$dragPoint = New-Object System.Drawing.Point
$titleBar.Add_MouseDown({ param($s,$e) if ($e.Button -eq 'Left') { $script:dragPoint = $e.Location } })
$titleBar.Add_MouseMove({ param($s,$e) if ($e.Button -eq 'Left') { $form.Location = New-Object System.Drawing.Point(($form.Left + $e.X - $script:dragPoint.X), ($form.Top + $e.Y - $script:dragPoint.Y)) } })

# Illustration de saison a gauche.
$visual = New-Object System.Windows.Forms.Panel
$visual.Location = New-Object System.Drawing.Point(32, 73); $visual.Size = New-Object System.Drawing.Size(335, 340)
$visual.BackColor = [System.Drawing.Color]::FromArgb(14, 42, 72); $hero.Controls.Add($visual); $visual.SendToBack()
$visual.Add_Paint({
    param($sender, $e)
    $e.Graphics.SmoothingMode = 'AntiAlias'
    $rect = $sender.ClientRectangle
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(23, 92, 133), [System.Drawing.Color]::FromArgb(70, 40, 121), 135)
    $e.Graphics.FillRectangle($gradient, $rect); $gradient.Dispose()
    $aura = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 135, 235, 255))
    $e.Graphics.FillEllipse($aura, 48, 47, 240, 240); $aura.Dispose()
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 121, 232, 255), 2)
    $e.Graphics.DrawEllipse($pen, 75, 74, 186, 186); $pen.Dispose()
    $starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(155, 210, 247, 255))
    foreach ($point in @(@(28,35),@(294,52),@(44,208),@(284,225),@(68,96),@(264,136),@(39,278),@(306,291),@(115,30),@(224,282))) {
        $e.Graphics.FillEllipse($starBrush, $point[0], $point[1], 3, 3)
    }
    $starBrush.Dispose()
})
$visualN = New-Object System.Windows.Forms.Label
$visualN.Text = 'N'; $visualN.TextAlign = 'MiddleCenter'; $visualN.Location = New-Object System.Drawing.Point(84, 72); $visualN.Size = New-Object System.Drawing.Size(170, 170)
$visualN.BackColor = [System.Drawing.Color]::Transparent; $visualN.ForeColor = [System.Drawing.Color]::White; $visualN.Font = New-Object System.Drawing.Font('Segoe UI Black', 76); $visual.Controls.Add($visualN)
$visualTag = New-Object System.Windows.Forms.Label
$visualTag.Text = "SAISON ZERO`nL'EVEIL DE NOVA"; $visualTag.Location = New-Object System.Drawing.Point(24, 270); $visualTag.Size = New-Object System.Drawing.Size(280, 48)
$visualTag.BackColor = [System.Drawing.Color]::Transparent; $visualTag.ForeColor = [System.Drawing.Color]::White; $visualTag.Font = New-Object System.Drawing.Font('Segoe UI Black', 13); $visual.Controls.Add($visualTag)

# Nouvelle composition des informations.
$season.Location = New-Object System.Drawing.Point(410, 82); $season.Text = 'SAISON ZERO  /  VERSION 1.0'; $season.ForeColor = [System.Drawing.Color]::FromArgb(82, 222, 255)
$title.Location = New-Object System.Drawing.Point(402, 111); $title.Font = New-Object System.Drawing.Font('Segoe UI Black', 35)
$subtitle.Location = New-Object System.Drawing.Point(410, 177); $subtitle.ForeColor = [System.Drawing.Color]::FromArgb(157, 183, 207)
$news.Location = New-Object System.Drawing.Point(32, 430); $news.Size = New-Object System.Drawing.Size(335, 105); $news.BackColor = [System.Drawing.Color]::FromArgb(12, 32, 57)
$newsTitle.Text = 'MISE A JOUR - NOVA 1.0'; $newsTitle.ForeColor = [System.Drawing.Color]::FromArgb(255, 218, 72)
$newsText.Text = "12 personnages et boutique`nComptes locaux securises`nBus Nova, IA et construction"

$card.Location = New-Object System.Drawing.Point(405, 230); $card.Size = New-Object System.Drawing.Size(595, 305); $card.BackColor = [System.Drawing.Color]::FromArgb(8, 23, 43)
$statusDot.Location = New-Object System.Drawing.Point(28, 27); $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(83, 226, 145)
$status.Location = New-Object System.Drawing.Point(57, 31); $status.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 13)
$details.Location = New-Object System.Drawing.Point(31, 70)
$progress.Location = New-Object System.Drawing.Point(32, 111); $progress.Size = New-Object System.Drawing.Size(531, 6)
$progress.Visible = $false
$progressTrack = New-Object System.Windows.Forms.Panel
$progressTrack.Location = New-Object System.Drawing.Point(32, 111); $progressTrack.Size = New-Object System.Drawing.Size(531, 7); $progressTrack.BackColor = [System.Drawing.Color]::FromArgb(24, 48, 72); $card.Controls.Add($progressTrack)
$progressFill = New-Object System.Windows.Forms.Panel
$progressFill.Location = New-Object System.Drawing.Point(0, 0); $progressFill.Size = New-Object System.Drawing.Size(0, 7); $progressFill.BackColor = [System.Drawing.Color]::FromArgb(75, 218, 250); $progressTrack.Controls.Add($progressFill)
function Set-NovaProgress([int]$value) {
    $safeValue = [Math]::Max(0, [Math]::Min(100, $value))
    $progress.Value = $safeValue
    $progressFill.Width = [Math]::Round($progressTrack.ClientSize.Width * ($safeValue / 100))
    $progressFill.Refresh()
}
$play.Location = New-Object System.Drawing.Point(32, 145); $play.Size = New-Object System.Drawing.Size(365, 65); $play.Text = 'LANCER LE JEU'; $play.BackColor = [System.Drawing.Color]::FromArgb(252, 218, 55); $play.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(255, 232, 93)
$stop.Location = New-Object System.Drawing.Point(411, 145); $stop.Size = New-Object System.Drawing.Size(152, 65); $stop.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(62, 94, 124); $stop.ForeColor = [System.Drawing.Color]::FromArgb(130, 154, 176)
$tip = New-Object System.Windows.Forms.Label
$tip.Text = 'Le serveur tourne uniquement sur ton PC - 127.0.0.1'; $tip.AutoSize = $true; $tip.Location = New-Object System.Drawing.Point(32, 272); $tip.ForeColor = [System.Drawing.Color]::FromArgb(76, 111, 140); $tip.Font = New-Object System.Drawing.Font('Segoe UI', 8); $card.Controls.Add($tip)

function Add-StatusChip([string]$text, [int]$x, [System.Drawing.Color]$color) {
    $chip = New-Object System.Windows.Forms.Panel
    $chip.Location = New-Object System.Drawing.Point($x, 228); $chip.Size = New-Object System.Drawing.Size(166, 30); $chip.BackColor = [System.Drawing.Color]::FromArgb(11, 34, 57); $card.Controls.Add($chip)
    $dot = New-Object System.Windows.Forms.Label
    $dot.Text = [char]0x25CF; $dot.AutoSize = $true; $dot.Location = New-Object System.Drawing.Point(10, 7); $dot.ForeColor = $color; $dot.Font = New-Object System.Drawing.Font('Segoe UI', 7); $chip.Controls.Add($dot)
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $text; $label.AutoSize = $true; $label.Location = New-Object System.Drawing.Point(27, 7); $label.ForeColor = [System.Drawing.Color]::FromArgb(150, 178, 200); $label.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 8); $chip.Controls.Add($label)
    return $chip
}
$nodeVersion = try { (& node --version 2>$null) } catch { 'indisponible' }
[void](Add-StatusChip 'SERVEUR LOCAL' 32 ([System.Drawing.Color]::FromArgb(74, 226, 145)))
[void](Add-StatusChip "NODE $nodeVersion" 210 ([System.Drawing.Color]::FromArgb(77, 210, 245)))
[void](Add-StatusChip 'DONNEES PRIVEES' 388 ([System.Drawing.Color]::FromArgb(174, 126, 255)))

$footer.Location = New-Object System.Drawing.Point(32, 574); $footer.Text = 'NOVA CLIENT 1.0   -   SERVEUR LOCAL   -   AUCUN PAIEMENT REEL'
$verify.Location = New-Object System.Drawing.Point(700, 565); $verify.Size = New-Object System.Drawing.Size(145, 38); $verify.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(55, 103, 139); $verify.BackColor = [System.Drawing.Color]::FromArgb(11, 31, 54)
$folder.Location = New-Object System.Drawing.Point(854, 565); $folder.Size = New-Object System.Drawing.Size(146, 38); $folder.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(55, 103, 139); $folder.BackColor = [System.Drawing.Color]::FromArgb(11, 31, 54)

# Coins arrondis et interactions premium.
function Set-RoundedRegion($control, [int]$radius) {
    if ($control.Width -le 0 -or $control.Height -le 0) { return }
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($control.Width - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($control.Width - $diameter, $control.Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $control.Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $oldRegion = $control.Region
    $control.Region = New-Object System.Drawing.Region($path)
    if ($oldRegion) { $oldRegion.Dispose() }
    $path.Dispose()
}

$form.Add_Shown({
    Set-RoundedRegion $form 12
    Set-RoundedRegion $visual 18
    Set-RoundedRegion $card 14
    Set-RoundedRegion $news 11
    Set-RoundedRegion $play 9
    Set-RoundedRegion $stop 9
    Set-RoundedRegion $verify 7
    Set-RoundedRegion $folder 7
    foreach ($chip in $card.Controls | Where-Object { $_ -is [System.Windows.Forms.Panel] -and $_ -ne $progressTrack }) { Set-RoundedRegion $chip 7 }
})

$play.Add_MouseEnter({ $play.ForeColor = [System.Drawing.Color]::FromArgb(5, 15, 28) })
$stop.Add_MouseEnter({ if ($stop.Enabled) { $stop.BackColor = [System.Drawing.Color]::FromArgb(47, 29, 43); $stop.ForeColor = [System.Drawing.Color]::FromArgb(255, 139, 154) } })
$stop.Add_MouseLeave({ $stop.BackColor = [System.Drawing.Color]::FromArgb(20, 50, 80); if ($stop.Enabled) { $stop.ForeColor = [System.Drawing.Color]::White } })
$verify.Add_MouseEnter({ $verify.BackColor = [System.Drawing.Color]::FromArgb(18, 55, 83) }); $verify.Add_MouseLeave({ $verify.BackColor = [System.Drawing.Color]::FromArgb(11, 31, 54) })
$folder.Add_MouseEnter({ $folder.BackColor = [System.Drawing.Color]::FromArgb(18, 55, 83) }); $folder.Add_MouseLeave({ $folder.BackColor = [System.Drawing.Color]::FromArgb(11, 31, 54) })


$verify.Add_Click({
    try { $count=Test-GameFiles; $status.Text='Installation valide'; $details.Text="$count fichiers principaux verifies."; $statusDot.ForeColor=[System.Drawing.Color]::FromArgb(73,230,125); Set-NovaProgress 100 }
    catch { $status.Text='Reparation necessaire'; $details.Text=$_.Exception.Message; $statusDot.ForeColor=[System.Drawing.Color]::FromArgb(255,90,105); Set-NovaProgress 0 }
})
$folder.Add_Click({ Start-Process explorer.exe -ArgumentList $gameDirectory })

$play.Add_Click({
    try {
        if ($script:server -and -not $script:server.HasExited) {
            Open-GameWindow $script:gameUrl
            return
        }
        $play.Enabled = $false; Set-NovaProgress 25
        $status.Text = 'Demarrage du serveur...'; $details.Text = 'Preparation de la carte 3D et des fichiers du jeu.'
        [System.Windows.Forms.Application]::DoEvents()
        [void](Test-GameFiles)
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) { throw 'Node.js est introuvable sur cet ordinateur.' }
        $port = Get-FreePort
        $script:gameUrl = "http://127.0.0.1:$port/index.html"
        $script:server = Start-Process -FilePath $node.Source -ArgumentList @('server.js', $port) -WorkingDirectory $gameDirectory -WindowStyle Hidden -PassThru
        Set-NovaProgress 65
        $ready = $false
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Milliseconds 150
            try { if ((Invoke-WebRequest $script:gameUrl -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200) { $ready = $true; break } } catch { }
        }
        if (-not $ready) { throw "Le serveur n'a pas repondu." }
        Set-NovaProgress 100; $status.Text = 'Jeu pret !'; $details.Text = "Serveur actif : $script:gameUrl"
        $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(73, 230, 125)
        $play.Text = 'OUVRIR NOVA'; $play.Enabled = $true; $stop.Enabled = $true
        Open-GameWindow $script:gameUrl
        $form.WindowState = 'Minimized'
    } catch {
        Stop-GameServer
        Set-NovaProgress 0; $play.Enabled = $true; $stop.Enabled = $false
        $status.Text = 'Erreur de lancement'; $details.Text = $_.Exception.Message
        $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(255, 90, 105)
        [void][System.Windows.Forms.MessageBox]::Show("Impossible de lancer Archipel Nova.`n`n$($_.Exception.Message)", 'Archipel Nova', 'OK', 'Error')
    }
})

$stop.Add_Click({
    Stop-GameServer
    Set-NovaProgress 0; $status.Text = 'Serveur arrete'; $details.Text = 'Clique sur JOUER pour recommencer.'
    $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(255, 210, 70)
    $play.Text = 'LANCER LE JEU'; $stop.Enabled = $false
})

function Show-NovaSplash {
    $imagePath = Join-Path $gameDirectory 'assets\launcher-splash.png'
    if (-not (Test-Path -LiteralPath $imagePath)) { return }

    $splash = New-Object System.Windows.Forms.Form
    $splash.FormBorderStyle = 'None'
    $splash.StartPosition = 'CenterScreen'
    $splash.Size = New-Object System.Drawing.Size(1000, 563)
    $splash.BackColor = [System.Drawing.Color]::Black
    $splash.ShowInTaskbar = $false
    $splash.TopMost = $true

    $artwork = [System.Drawing.Image]::FromFile($imagePath)
    $picture = New-Object System.Windows.Forms.PictureBox
    $picture.Dock = 'Fill'; $picture.SizeMode = 'Zoom'; $picture.Image = $artwork
    $splash.Controls.Add($picture)

    $loadingPanel = New-Object System.Windows.Forms.Panel
    $loadingPanel.Dock = 'Bottom'; $loadingPanel.Height = 58
    $loadingPanel.BackColor = [System.Drawing.Color]::FromArgb(12, 15, 29)
    $splash.Controls.Add($loadingPanel); $loadingPanel.BringToFront()

    $loadingLabel = New-Object System.Windows.Forms.Label
    $loadingLabel.Text = 'INITIALISATION DU CLIENT NOVA'
    $loadingLabel.AutoSize = $true; $loadingLabel.Location = New-Object System.Drawing.Point(24, 12)
    $loadingLabel.ForeColor = [System.Drawing.Color]::FromArgb(213, 226, 239)
    $loadingLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
    $loadingPanel.Controls.Add($loadingLabel)

    $versionLabel = New-Object System.Windows.Forms.Label
    $versionLabel.Text = 'SAISON ZERO  |  LOCAL BUILD 1.0'
    $versionLabel.AutoSize = $true; $versionLabel.Location = New-Object System.Drawing.Point(779, 12)
    $versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(116, 138, 160)
    $versionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8)
    $loadingPanel.Controls.Add($versionLabel)

    $track = New-Object System.Windows.Forms.Panel
    $track.Location = New-Object System.Drawing.Point(24, 37); $track.Size = New-Object System.Drawing.Size(952, 5)
    $track.BackColor = [System.Drawing.Color]::FromArgb(31, 43, 64); $loadingPanel.Controls.Add($track)
    $fill = New-Object System.Windows.Forms.Panel
    $fill.Location = New-Object System.Drawing.Point(0, 0); $fill.Size = New-Object System.Drawing.Size(0, 5)
    $fill.BackColor = [System.Drawing.Color]::FromArgb(133, 66, 255); $track.Controls.Add($fill)

    $splash.Show(); $splash.Activate()
    for ($step = 1; $step -le 45; $step++) {
        $fill.Width = [Math]::Round($track.Width * ($step / 45))
        if ($step -eq 16) { $loadingLabel.Text = 'VERIFICATION DES FICHIERS' }
        if ($step -eq 31) { $loadingLabel.Text = 'PREPARATION DU LAUNCHER' }
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 30
    }
    $splash.Close(); $picture.Image = $null; $artwork.Dispose(); $splash.Dispose()
}

$trayMenu = New-Object System.Windows.Forms.ContextMenuStrip
$trayOpen = $trayMenu.Items.Add('Ouvrir le jeu')
$trayStop = $trayMenu.Items.Add('Arreter Archipel Nova')
$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Icon = [System.Drawing.SystemIcons]::Application
$trayIcon.Text = 'Archipel Nova - serveur local'
$trayIcon.ContextMenuStrip = $trayMenu
$trayIcon.Visible = $true
$trayOpen.Add_Click({
    if ($script:gameUrl -and $script:server -and -not $script:server.HasExited) { Open-GameWindow $script:gameUrl }
})
$trayStop.Add_Click({ $form.Close() })
$trayIcon.Add_DoubleClick({
    if ($script:gameUrl -and $script:server -and -not $script:server.HasExited) { Open-GameWindow $script:gameUrl }
})

$form.Add_Shown({
    $play.PerformClick()
    $form.Hide()
})
$form.Add_FormClosing({ $trayIcon.Visible = $false; $trayIcon.Dispose(); Stop-GameServer })
Show-NovaSplash
[System.Windows.Forms.Application]::Run($form)
