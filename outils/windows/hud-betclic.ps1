<#
  hud-betclic.ps1 — HUD Expresso Trainer pour Windows (PowerShell + WPF, rien à installer).

  Une petite fenêtre noire, toujours au-dessus des tables, qui affiche :
    - le chrono depuis le premier lancement de table de la session,
    - le nombre de parties jouées (+1 / −1 à la main, et détection automatique :
      chaque nouvelle fenêtre de table ouverte dans Betclic compte une partie),
    - la cadence en parties par heure.
  Elle s'ouvre toute seule quand Betclic Poker démarre (mode veille) et se range
  quand il se ferme. Les sessions terminées sont archivées dans sessions.csv.

  Lancement (double-clic sur les .cmd fournis, ou depuis PowerShell) :
    hud-betclic.cmd                 ouvre le HUD maintenant
    installer-hud-betclic.cmd       veille : HUD automatique à chaque lancement de Betclic,
                                    relancée à chaque démarrage de Windows
    desinstaller-hud-betclic.cmd    retire la veille du démarrage et l'arrête

  Options (à ajouter après la commande, ex. : installer-hud-betclic.cmd -FiltreTable "*Expresso*") :
    -Processus "*betclic*"   nom du processus du client Betclic (joker * accepté ;
                             Gestionnaire des tâches → Détails si le client porte un autre nom)
    -FiltreTable "*"         ne compter que les fenêtres dont le titre correspond
    -CompterTitres           compter aussi un changement de titre d'une table déjà ouverte
                             (si le client réutilise la même fenêtre d'une partie à l'autre)
    -DelaiDemarrage 30       secondes après le lancement de Betclic pendant lesquelles les
                             fenêtres (connexion, lobby) ne comptent pas
    -PauseMax 120            minutes sans activité au-delà desquelles une nouvelle session commence
    -Dossier "<chemin>"      où sont écrits session, sessions.csv et journal.log
                             (par défaut : %LOCALAPPDATA%\Expresso Trainer)

  Dans la fenêtre : + ou Entrée = +1, − = −1, clic droit = menu (terminer la session,
  ouvrir le dossier, quitter), glisser pour déplacer, Échap pour ranger.
  Tout ce que le HUD voit est noté dans <Dossier>\journal.log.
#>
param(
  [switch]$Veille,
  [switch]$Installer,
  [switch]$Desinstaller,
  [switch]$CompterTitres,
  [string]$Processus = "*betclic*",
  [string]$FiltreTable = "*",
  [int]$DelaiDemarrage = 30,
  [int]$PauseMax = 120,
  [int]$TailleMinTable = 300,
  [string]$Dossier = (Join-Path $env:LOCALAPPDATA "Expresso Trainer")
)

$ErrorActionPreference = "Stop"
trap {
  # Erreur fatale (console cachée) : on la note et on l'affiche avant de s'arrêter.
  $message = "Erreur fatale : " + $_.Exception.Message + " (ligne " + $_.InvocationInfo.ScriptLineNumber + ")"
  try { Journal $message } catch {}
  try { Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show($message, "HUD Expresso Trainer") } catch {}
  break
}
$NomRaccourci = "HUD Expresso Trainer.lnk"
$DossierParDefaut = Join-Path $env:LOCALAPPDATA "Expresso Trainer"
$UrlSite = "https://theclearboy.github.io/spinall/"
$Navigateurs = @("chrome", "msedge", "firefox", "opera", "brave", "vivaldi", "iexplore")

if (-not (Test-Path $Dossier)) { New-Item -ItemType Directory -Path $Dossier | Out-Null }

function Journal([string]$texte) {
  $ligne = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $texte
  Write-Host $ligne
  try { Add-Content -Path (Join-Path $Dossier "journal.log") -Value $ligne -Encoding UTF8 } catch {}
}

# ======================================================= installation au démarrage
function Arguments-Veille {
  $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ('"' + $PSCommandPath + '"'), "-Veille")
  if ($Processus -ne "*betclic*") { $a += @("-Processus", ('"' + $Processus + '"')) }
  if ($FiltreTable -ne "*") { $a += @("-FiltreTable", ('"' + $FiltreTable + '"')) }
  if ($DelaiDemarrage -ne 30) { $a += @("-DelaiDemarrage", $DelaiDemarrage) }
  if ($PauseMax -ne 120) { $a += @("-PauseMax", $PauseMax) }
  if ($TailleMinTable -ne 300) { $a += @("-TailleMinTable", $TailleMinTable) }
  if ($Dossier -ne $DossierParDefaut) { $a += @("-Dossier", ('"' + $Dossier + '"')) }
  if ($CompterTitres) { $a += "-CompterTitres" }
  return ($a -join " ")
}

function Instances-Veille {
  $moi = $PID
  @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" |
    Where-Object { $_.ProcessId -ne $moi -and $_.CommandLine -like "*hud-betclic.ps1*" -and $_.CommandLine -like "*-Veille*" })
}

function Arreter-Veilles {
  foreach ($v in (Instances-Veille)) {
    Stop-Process -Id $v.ProcessId -Force
    Journal ("Veille arrêtée (processus " + $v.ProcessId + ").")
  }
}

function Installer-Demarrage {
  $arguments = Arguments-Veille
  $raccourci = Join-Path ([Environment]::GetFolderPath("Startup")) $NomRaccourci
  $wsh = New-Object -ComObject WScript.Shell
  $s = $wsh.CreateShortcut($raccourci)
  $s.TargetPath = "powershell.exe"
  $s.Arguments = $arguments
  $s.WorkingDirectory = Split-Path -Parent $PSCommandPath
  $s.Description = "HUD Expresso Trainer : s'ouvre avec Betclic et compte les parties"
  $s.Save()
  Journal "Veille installée au démarrage de Windows : $raccourci"
  Arreter-Veilles
  Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WindowStyle Hidden
  Journal "Veille lancée en arrière-plan."
  Write-Host ""
  Write-Host "C'est en place : dès que Betclic Poker tourne, le HUD apparaît en haut à droite"
  Write-Host "de l'écran et chaque nouvelle table ouverte compte une partie."
  Write-Host "Pour le voir tout de suite sans Betclic : double-clique sur hud-betclic.cmd."
  Write-Host "Journal et sessions : $Dossier"
}

function Desinstaller-Demarrage {
  $raccourci = Join-Path ([Environment]::GetFolderPath("Startup")) $NomRaccourci
  if (Test-Path $raccourci) { Remove-Item $raccourci; Journal "Raccourci de démarrage supprimé." }
  else { Journal "Aucun raccourci de démarrage à supprimer." }
  Arreter-Veilles
}

if ($Desinstaller) { Desinstaller-Demarrage; return }
if ($Installer) { Installer-Demarrage; return }

# Lancement direct alors qu'une veille tourne déjà : on lui demande d'afficher sa fenêtre.
$FichierAfficher = Join-Path $Dossier "afficher.signal"
if (-not $Veille -and (Instances-Veille).Count -gt 0) {
  Set-Content -Path $FichierAfficher -Value (Get-Date) -Encoding ASCII
  Journal "Une veille tourne déjà : affichage demandé à cette instance."
  return
}

# ======================================================= fenêtres Windows (user32)
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class FenetresWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  public static List<string> Lister() {
    var liste = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      int n = GetWindowTextLength(h);
      if (n == 0) return true;
      var sb = new StringBuilder(n + 2);
      GetWindowText(h, sb, sb.Capacity);
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT r; GetWindowRect(h, out r);
      liste.Add(h.ToInt64() + "\t" + pid + "\t" + (r.R - r.L) + "\t" + (r.B - r.T) + "\t" + sb.ToString());
      return true;
    }, IntPtr.Zero);
    return liste;
  }
}
"@

function Lister-Fenetres {
  [FenetresWin]::Lister() | ForEach-Object {
    $p = $_ -split "`t", 5
    [pscustomobject]@{ Hwnd = $p[0]; ProcId = [int]$p[1]; Largeur = [int]$p[2]; Hauteur = [int]$p[3]; Titre = $p[4] }
  }
}

function Processus-Betclic {
  @(Get-Process | Where-Object {
    if ($_.ProcessName -like $Processus) { return $true }
    if ($Navigateurs -contains $_.ProcessName.ToLower()) { return $false }
    $titre = ""
    try { $titre = $_.MainWindowTitle } catch {}
    return ($titre -like "*Betclic*")
  })
}

# ======================================================= session (persistée dans session.json)
$script:etat = @{
  debut = $null              # horodatage (ms) du premier lancement de table
  parties = 0
  derniereActivite = $null   # ms ; au-delà de PauseMax minutes, nouvelle session
  betclicVu = $false
  momentDetection = Get-Date
  connues = @{}              # hwnd → titre des fenêtres de Betclic déjà vues
  tablesVues = 0
  quitter = $false
}
$FichierSession = Join-Path $Dossier "session.json"
$FichierSessions = Join-Path $Dossier "sessions.csv"
$FichierPosition = Join-Path $Dossier "position.json"

function Maintenant-Ms { [DateTimeOffset]::Now.ToUnixTimeMilliseconds() }
function Date-Locale([int64]$ms) { [DateTimeOffset]::FromUnixTimeMilliseconds($ms).ToLocalTime().DateTime }

function Sauver-Session {
  try {
    @{ debut = $script:etat.debut; parties = $script:etat.parties; derniereActivite = $script:etat.derniereActivite } |
      ConvertTo-Json -Compress | Set-Content -Path $FichierSession -Encoding UTF8
  } catch { Journal ("Session non sauvegardée : " + $_.Exception.Message) }
}

function Charger-Session {
  if (-not (Test-Path $FichierSession)) { return }
  try {
    $j = Get-Content -Path $FichierSession -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($j.debut) { $script:etat.debut = [int64]$j.debut }
    if ($j.parties) { $script:etat.parties = [int]$j.parties }
    if ($j.derniereActivite) { $script:etat.derniereActivite = [int64]$j.derniereActivite }
  } catch { Journal ("session.json illisible, nouvelle session : " + $_.Exception.Message) }
  Archiver-Si-Perimee
}

function Archiver-Si-Perimee {
  if (-not $script:etat.debut) { return }
  $ref = if ($script:etat.derniereActivite) { $script:etat.derniereActivite } else { $script:etat.debut }
  if ((Maintenant-Ms) - $ref -gt [int64]$PauseMax * 60000) {
    Journal "Session précédente inactive depuis plus de $PauseMax min : archivée."
    Terminer-Session $ref
  }
}

function Terminer-Session([int64]$fin = (Maintenant-Ms)) {
  if ($script:etat.debut) {
    if ($fin -lt $script:etat.debut) { $fin = $script:etat.debut }
    $duree = $fin - $script:etat.debut
    $minutes = [Math]::Round($duree / 60000.0, 1)
    $cadence = if ($duree -ge 60000) { [Math]::Round($script:etat.parties * 3600000.0 / $duree, 1) } else { "" }
    if (-not (Test-Path $FichierSessions)) {
      Set-Content -Path $FichierSessions -Value "debut;fin;duree_minutes;parties;parties_par_heure" -Encoding UTF8
    }
    $ligne = "{0:yyyy-MM-dd HH:mm};{1:yyyy-MM-dd HH:mm};{2};{3};{4}" -f (Date-Locale $script:etat.debut), (Date-Locale $fin), $minutes, $script:etat.parties, $cadence
    Add-Content -Path $FichierSessions -Value $ligne -Encoding UTF8
    Journal ("Session terminée : " + $script:etat.parties + " parties en " + $minutes + " min.")
  }
  $script:etat.debut = $null
  $script:etat.parties = 0
  $script:etat.derniereActivite = $null
  Sauver-Session
  Rafraichir
}

function Demarrer-Chrono {
  if (-not $script:etat.debut) {
    $script:etat.debut = Maintenant-Ms
    Journal "Chrono lancé."
  }
}

function Ajouter-Partie([int]$delta, [string]$origine) {
  Demarrer-Chrono
  $script:etat.parties = [Math]::Max(0, $script:etat.parties + $delta)
  $script:etat.derniereActivite = Maintenant-Ms
  Sauver-Session
  Journal ("Parties : " + $script:etat.parties + " (" + $origine + ")")
  Rafraichir
}

function Format-Chrono([int64]$ms) {
  $t = [TimeSpan]::FromMilliseconds([Math]::Max(0, $ms))
  if ($t.TotalHours -ge 1) { return ("{0}:{1:00}:{2:00}" -f [int][Math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds) }
  return ("{0}:{1:00}" -f $t.Minutes, $t.Seconds)
}

# ======================================================= fenêtre WPF
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="HUD Expresso Trainer" Width="300" Height="178"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ResizeMode="NoResize" ShowInTaskbar="True" ShowActivated="False"
        WindowStartupLocation="Manual" FontFamily="Segoe UI" SnapsToDevicePixels="True">
  <Window.Resources>
    <Style x:Key="Pilule" TargetType="Button">
      <Setter Property="FontWeight" Value="ExtraBold"/>
      <Setter Property="FontSize" Value="15"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Focusable" Value="False"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Fond" Background="{TemplateBinding Background}" CornerRadius="17" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Fond" Property="Opacity" Value="0.85"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Border Background="#FF000000" CornerRadius="20" BorderBrush="#FF2A2A2A" BorderThickness="1" Padding="16,11,14,13">
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <DockPanel Grid.Row="0" LastChildFill="True">
        <Button x:Name="Fermer" DockPanel.Dock="Right" Content="×" Width="22" Height="22" Background="Transparent"
                Foreground="#FF9A9A9A" BorderThickness="0" FontSize="17" Padding="0" Cursor="Hand" Focusable="False"
                ToolTip="Ranger le HUD (Échap)"/>
        <TextBlock x:Name="Cadence" DockPanel.Dock="Right" Text="— / h" Foreground="#FF9A9A9A" FontSize="11"
                   FontWeight="Bold" Margin="0,3,10,0"/>
        <StackPanel Orientation="Horizontal">
          <Ellipse x:Name="Point" Width="8" Height="8" Fill="#FF9A9A9A" Margin="0,1,7,0" VerticalAlignment="Center"/>
          <TextBlock Text="EXPRESSO" Foreground="#FFD9FF5A" FontSize="11" FontWeight="Bold" VerticalAlignment="Center"/>
        </StackPanel>
      </DockPanel>
      <TextBlock x:Name="Chrono" Grid.Row="1" Text="0:00" Foreground="#FFD9FF5A" FontSize="56" FontWeight="ExtraBold"
                 VerticalAlignment="Center" Margin="-2,0,0,0"/>
      <DockPanel Grid.Row="2" LastChildFill="True">
        <StackPanel DockPanel.Dock="Right" Orientation="Horizontal">
          <Button x:Name="Moins" Style="{StaticResource Pilule}" Content="−1" Width="46" Height="34"
                  Background="#FF262626" Foreground="#FFFFFFFF" ToolTip="Retirer une partie (touche −)"/>
          <Button x:Name="Plus" Style="{StaticResource Pilule}" Content="+1" Width="62" Height="34" Margin="6,0,0,0"
                  Background="#FFD9FF5A" Foreground="#FF111111" ToolTip="Ajouter une partie (touche + ou Entrée)"/>
        </StackPanel>
        <TextBlock VerticalAlignment="Center"><Run x:Name="Nombre" Text="0" Foreground="#FFFFFFFF" FontSize="24" FontWeight="ExtraBold"/><Run x:Name="Libelle" Text=" partie" Foreground="#FF9A9A9A" FontSize="14"/></TextBlock>
      </DockPanel>
    </Grid>
  </Border>
</Window>
"@

$window = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader ([xml]$xaml)))
$ctl = @{}
foreach ($nom in @("Fermer", "Cadence", "Point", "Chrono", "Moins", "Plus", "Nombre", "Libelle")) { $ctl[$nom] = $window.FindName($nom) }
$CouleurLime = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#FFD9FF5A")
$CouleurGris = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#FF9A9A9A")
$CouleurOrange = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#FFE8834A")

function Rafraichir {
  if (-not $window) { return }
  $maintenant = Maintenant-Ms
  $duree = if ($script:etat.debut) { $maintenant - $script:etat.debut } else { 0 }
  $ctl.Chrono.Text = Format-Chrono $duree
  $ctl.Nombre.Text = [string]$script:etat.parties
  $ctl.Libelle.Text = if ($script:etat.parties -gt 1) { " parties" } else { " partie" }
  $ctl.Cadence.Text = if ($duree -ge 60000) { ("{0:0.0} / h" -f ($script:etat.parties * 3600000.0 / $duree)) } else { "— / h" }
  $ctl.Point.Fill = if ($script:etat.betclicVu) { $CouleurLime } else { $CouleurGris }
  $ctl.Point.ToolTip = if ($script:etat.betclicVu) { "Betclic détecté — " + $script:etat.tablesVues + " table(s) vue(s) depuis le lancement" } else { "Betclic non détecté (processus " + $Processus + ")" }
}

function Sauver-Position {
  try { @{ left = $window.Left; top = $window.Top } | ConvertTo-Json -Compress | Set-Content -Path $FichierPosition -Encoding UTF8 } catch {}
}

function Placer-Fenetre {
  $zone = [System.Windows.SystemParameters]::WorkArea
  $window.Left = $zone.Right - $window.Width - 16
  $window.Top = $zone.Top + 16
  if (Test-Path $FichierPosition) {
    try {
      $p = Get-Content -Path $FichierPosition -Raw -Encoding UTF8 | ConvertFrom-Json
      $gauche = [double]$p.left
      $haut = [double]$p.top
      $ecran = [System.Windows.SystemParameters]::VirtualScreenWidth
      if ($gauche -gt -$window.Width + 40 -and $gauche -lt $ecran - 40 -and $haut -ge -10) { $window.Left = $gauche; $window.Top = $haut }
    } catch {}
  }
}

function Afficher-Hud {
  if (-not $window.IsVisible) { $window.Show() }
  Rafraichir
}

function Ranger-Hud {
  if ($Veille) { $window.Hide() } else { Quitter }
}

function Quitter {
  $script:etat.quitter = $true
  Sauver-Session
  try { $window.Close() } catch {}
  [System.Windows.Threading.Dispatcher]::CurrentDispatcher.InvokeShutdown()
}

$ctl.Plus.Add_Click({ Ajouter-Partie 1 "bouton +1" })
$ctl.Moins.Add_Click({ Ajouter-Partie -1 "bouton −1" })
$ctl.Fermer.Add_Click({ Ranger-Hud })
$window.Add_MouseLeftButtonDown({
  param($s, $e)
  try { $window.DragMove(); Sauver-Position } catch {}
})
$window.Add_TextInput({
  param($s, $e)
  if ($e.Text -eq "+") { Ajouter-Partie 1 "clavier" }
  elseif ($e.Text -eq "-") { Ajouter-Partie -1 "clavier" }
})
$window.Add_PreviewKeyDown({
  param($s, $e)
  if ($e.Key -eq [System.Windows.Input.Key]::Return) { Ajouter-Partie 1 "clavier"; $e.Handled = $true }
  elseif ($e.Key -eq [System.Windows.Input.Key]::Escape) { Ranger-Hud; $e.Handled = $true }
})
$window.Add_Closing({
  param($s, $e)
  if ($Veille -and -not $script:etat.quitter) { $e.Cancel = $true; $window.Hide() }
})

$menu = New-Object System.Windows.Controls.ContextMenu
foreach ($entree in @(
  @{ texte = "Terminer la session (archive dans sessions.csv)"; action = { Terminer-Session } },
  @{ texte = "Ouvrir le dossier (journal, sessions)"; action = { Start-Process $Dossier } },
  @{ texte = "Ouvrir Expresso Trainer (site)"; action = { Start-Process $UrlSite } },
  @{ texte = "Quitter le HUD"; action = { Quitter } }
)) {
  $item = New-Object System.Windows.Controls.MenuItem
  $item.Header = $entree.texte
  $item.Add_Click($entree.action)
  [void]$menu.Items.Add($item)
}
$window.ContextMenu = $menu
# Une erreur dans un gestionnaire d'événement ne doit pas fermer le HUD.
$window.Dispatcher.Add_UnhandledException({
  param($s, $e)
  Journal ("Erreur : " + $e.Exception.Message)
  $e.Handled = $true
})

# ======================================================= veille : Betclic et ses tables
function Est-Table($fenetre) {
  if ($fenetre.Largeur -lt $TailleMinTable -or $fenetre.Hauteur -lt $TailleMinTable) { return $false }
  return ($fenetre.Titre -like $FiltreTable)
}

function Passage-Veille {
  try {
    if (Test-Path $FichierAfficher) {
      Remove-Item $FichierAfficher -ErrorAction SilentlyContinue
      Afficher-Hud
    }
    $procs = Processus-Betclic
    if ($procs.Count -eq 0) {
      if ($script:etat.betclicVu) {
        $script:etat.betclicVu = $false
        $script:etat.connues = @{}
        Journal "Betclic fermé."
        if ($Veille) { $window.Hide() }
        Rafraichir
      }
      return
    }
    $premierPassage = -not $script:etat.betclicVu
    if ($premierPassage) {
      $script:etat.betclicVu = $true
      $script:etat.momentDetection = Get-Date
      $script:etat.tablesVues = 0
      Journal ("Betclic détecté (processus " + $procs[0].ProcessName + ").")
      Archiver-Si-Perimee
      $script:etat.derniereActivite = Maintenant-Ms
      Sauver-Session
      Afficher-Hud
    }
    $demarrage = ((Get-Date) - $script:etat.momentDetection).TotalSeconds -lt $DelaiDemarrage
    $pids = @{}
    foreach ($p in $procs) { $pids[[int]$p.Id] = $true }
    $fenetres = @(Lister-Fenetres | Where-Object { $pids.ContainsKey($_.ProcId) })
    $presentes = @{}
    foreach ($f in $fenetres) {
      $presentes[$f.Hwnd] = $true
      if ($script:etat.connues.ContainsKey($f.Hwnd)) {
        if ($CompterTitres -and $script:etat.connues[$f.Hwnd] -ne $f.Titre -and -not $demarrage -and (Est-Table $f)) {
          $script:etat.tablesVues += 1
          Journal ("Table (nouveau titre) : " + $f.Titre)
          Ajouter-Partie 1 "table"
        }
        $script:etat.connues[$f.Hwnd] = $f.Titre
        continue
      }
      $script:etat.connues[$f.Hwnd] = $f.Titre
      if ($premierPassage -or $demarrage) {
        Journal ("Fenêtre de démarrage, non comptée : " + $f.Titre + " (" + $f.Largeur + "x" + $f.Hauteur + ")")
      } elseif (Est-Table $f) {
        $script:etat.tablesVues += 1
        Journal ("Table détectée : " + $f.Titre + " (" + $f.Largeur + "x" + $f.Hauteur + ")")
        Ajouter-Partie 1 "table"
      } else {
        Journal ("Nouvelle fenêtre ignorée (" + $f.Largeur + "x" + $f.Hauteur + ") : " + $f.Titre)
      }
    }
    foreach ($cle in @($script:etat.connues.Keys)) { if (-not $presentes.ContainsKey($cle)) { $script:etat.connues.Remove($cle) } }
  } catch {
    Journal ("Erreur de veille : " + $_.Exception.Message)
  }
}

# ======================================================= démarrage
Charger-Session
Placer-Fenetre
Rafraichir

$timerHorloge = New-Object System.Windows.Threading.DispatcherTimer
$timerHorloge.Interval = [TimeSpan]::FromSeconds(1)
$timerHorloge.Add_Tick({ if ($window.IsVisible) { Rafraichir } })
$timerHorloge.Start()

$timerVeille = New-Object System.Windows.Threading.DispatcherTimer
$timerVeille.Interval = [TimeSpan]::FromSeconds(3)
$timerVeille.Add_Tick({ Passage-Veille })
$timerVeille.Start()

if ($Veille) {
  Journal "Veille démarrée : processus '$Processus', tables '$FiltreTable', dossier $Dossier"
  Passage-Veille
} else {
  Journal "HUD ouvert."
  Afficher-Hud
}
[System.Windows.Threading.Dispatcher]::Run()
