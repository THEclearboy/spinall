<#
  hud-betclic.ps1 — HUD Expresso Trainer pour Windows (PowerShell + WPF, rien à installer).

  Une petite fenêtre noire, toujours au-dessus des tables, qui affiche :
    - le chrono depuis le premier lancement de table de la session,
    - le nombre de parties jouées (+1 / −1 à la main, et détection automatique :
      chaque nouvelle fenêtre de table ouverte dans Betclic compte une partie),
    - la cadence en parties par heure.
  Elle s'ouvre toute seule quand Betclic Poker démarre (mode veille) et se range
  quand il se ferme. Les sessions terminées sont archivées dans sessions.csv.

  Installation sans rien télécharger à la main (si Windows bloque les .cmd du zip),
  à coller dans PowerShell (Win+X → Terminal) :
    $d="$env:LOCALAPPDATA\Expresso Trainer"; $null=New-Item -ItemType Directory -Force $d; $r=Invoke-WebRequest -UseBasicParsing "https://theclearboy.github.io/spinall/hud-betclic.ps1.txt"; $t=[Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()).TrimStart([char]0xFEFF); [IO.File]::WriteAllText("$d\hud-betclic.ps1",$t,(New-Object Text.UTF8Encoding $true)); powershell -NoProfile -ExecutionPolicy Bypass -File "$d\hud-betclic.ps1" -Installer

  Lancement (double-clic sur les .cmd fournis, ou depuis PowerShell) :
    hud-betclic.cmd                 ouvre le HUD maintenant
    installer-hud-betclic.cmd       veille : HUD automatique à chaque lancement de Betclic,
                                    relancée à chaque démarrage de Windows
    desinstaller-hud-betclic.cmd    retire la veille du démarrage et l'arrête

  Clic droit sur le HUD → « Copier journal + diagnostic » met tout ce qu'il faut dans le
  presse-papiers (à coller à Claude) ; « Mettre à jour le HUD » installe la dernière version.
  En ligne de commande : -Copier, -MettreAJour.

  Si une table n'est pas comptée : avec une table ouverte, lancer
    powershell -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\Expresso Trainer\hud-betclic.ps1" -Diagnostic
  → diagnostic.txt s'ouvre dans le Bloc-notes avec tout ce que le HUD voit (processus, fenêtres, titres, tailles).

  Options (à ajouter après la commande, ex. : installer-hud-betclic.cmd -FiltreTable "*Expresso*") :
    -Processus "*betclic*"   nom du processus du client Betclic (joker * accepté ;
                             Gestionnaire des tâches → Détails si le client porte un autre nom)
    -MotifTable "Spin & Rush - *|Expresso*"
                             noms d'éléments d'interface qui signalent une table ouverte à l'intérieur
                             de la fenêtre Betclic (plusieurs motifs séparés par |, joker * accepté)
    -ModeTables uia          uia : tables lues à l'intérieur de la fenêtre Betclic (UI Automation) ;
                             fenetres : chaque nouvelle fenêtre à part compte ; auto : les deux
    -MotifDepart "10 - 20|10-20|10 / 20"
                             texte affiché seulement au début d'une partie (niveau de blinds 1) : quand
                             il apparaît, une partie commence. Signal par défaut, insensible au lobby.
    -RegleUia depart         depart : une partie quand un texte de -MotifDepart apparaît (confirmé à la
                             lecture suivante) ; nombre : quand le nombre d'éléments -MotifTable augmente ;
                             ids : chaque nouvel élément -MotifTable compte
    -DossierHistoriques "<chemin>"
                             si le client écrit ses historiques de mains sur le disque : chaque nouveau
                             « Game ID » qui apparaît compte une partie (le plus fiable quand ça existe)
    -FiltreTable "*"         fenêtres à part : ne compter que celles dont le titre correspond
    -CompterTitres           compter aussi un changement de titre d'une table déjà ouverte
                             (si le client réutilise la même fenêtre d'une partie à l'autre)
    -DelaiDemarrage 30       secondes après le lancement de Betclic pendant lesquelles les
                             fenêtres (connexion, lobby) ne comptent pas
    -PauseMax 120            minutes sans activité au-delà desquelles une nouvelle session commence
    -Dossier "<chemin>"      où sont écrits session, sessions.csv et journal.log
                             (par défaut : %LOCALAPPDATA%\Expresso Trainer)

  Dans la fenêtre : + ou Entrée = +1, − = −1, ↺ deux fois = remise à zéro, clic droit = menu
  (terminer la session, ouvrir le dossier, quitter), glisser pour déplacer, Échap pour ranger.
  Tout ce que le HUD voit est noté dans <Dossier>\journal.log.
#>
param(
  [switch]$Veille,
  [switch]$Installer,
  [switch]$Desinstaller,
  [switch]$Diagnostic,
  [switch]$Copier,
  [switch]$MettreAJour,
  [switch]$CompterTitres,
  [string]$Processus = "*betclic*",
  [string]$FiltreTable = "*",
  [string]$MotifTable = "Spin & Rush - *|Expresso*",
  [ValidateSet("auto", "uia", "fenetres")][string]$ModeTables = "uia",
  [string]$MotifDepart = "10 - 20|10-20|10 / 20",
  [ValidateSet("depart", "nombre", "ids")][string]$RegleUia = "depart",
  [string]$DossierHistoriques = "",
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
$UrlScript = "https://theclearboy.github.io/spinall/hud-betclic.ps1.txt"
$Navigateurs = @("chrome", "msedge", "firefox", "opera", "brave", "vivaldi", "iexplore")

if (-not (Test-Path $Dossier)) { New-Item -ItemType Directory -Path $Dossier | Out-Null }

function Journal([string]$texte) {
  $ligne = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $texte
  Write-Host $ligne
  try { Add-Content -Path (Join-Path $Dossier "journal.log") -Value $ligne -Encoding UTF8 } catch {}
}

# ======================================================= installation au démarrage
function Arguments-Veille([string]$script = $PSCommandPath) {
  $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ('"' + $script + '"'), "-Veille")
  if ($Processus -ne "*betclic*") { $a += @("-Processus", ('"' + $Processus + '"')) }
  if ($FiltreTable -ne "*") { $a += @("-FiltreTable", ('"' + $FiltreTable + '"')) }
  if ($MotifTable -ne "Spin & Rush - *|Expresso*") { $a += @("-MotifTable", ('"' + $MotifTable + '"')) }
  if ($ModeTables -ne "uia") { $a += @("-ModeTables", $ModeTables) }
  if ($MotifDepart -ne "10 - 20|10-20|10 / 20") { $a += @("-MotifDepart", ('"' + $MotifDepart + '"')) }
  if ($RegleUia -ne "depart") { $a += @("-RegleUia", $RegleUia) }
  if ($DossierHistoriques) { $a += @("-DossierHistoriques", ('"' + $DossierHistoriques + '"')) }
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
  # Copie locale du script, réécrite sans la marque « téléchargé d'Internet » :
  # la veille tourne depuis là, le dossier du zip peut ensuite être supprimé.
  $cible = Join-Path $Dossier "hud-betclic.ps1"
  if ($PSCommandPath -and ($PSCommandPath -ne $cible)) {
    $texte = [System.IO.File]::ReadAllText($PSCommandPath).TrimStart([char]0xFEFF)
    [System.IO.File]::WriteAllText($cible, $texte, (New-Object System.Text.UTF8Encoding $true))
    Journal "Script installé dans $cible"
  }
  $arguments = Arguments-Veille $cible
  $raccourci = Join-Path ([Environment]::GetFolderPath("Startup")) $NomRaccourci
  $wsh = New-Object -ComObject WScript.Shell
  $s = $wsh.CreateShortcut($raccourci)
  $s.TargetPath = "powershell.exe"
  $s.Arguments = $arguments
  $s.WorkingDirectory = $Dossier
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
if ($Diagnostic) { [void](Diagnostic); return }
if ($Copier) {
  if (Copier-Pour-Claude) { Write-Host "Copié : colle maintenant (Ctrl+V) dans la conversation avec Claude." }
  return
}
if ($MettreAJour) { Mettre-A-Jour; return }

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
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  static string Titre(IntPtr h) {
    int n = GetWindowTextLength(h);
    if (n == 0) return "";
    var sb = new StringBuilder(n + 2);
    GetWindowText(h, sb, sb.Capacity);
    return sb.ToString();
  }
  static string Classe(IntPtr h) {
    var sb = new StringBuilder(256);
    GetClassName(h, sb, sb.Capacity);
    return sb.ToString();
  }
  // "hwnd TAB pid TAB largeur TAB hauteur TAB classe TAB titre" pour chaque fenêtre visible (titrée ou non)
  public static List<string> Lister() {
    var liste = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT r; GetWindowRect(h, out r);
      liste.Add(h.ToInt64() + "\t" + pid + "\t" + (r.R - r.L) + "\t" + (r.B - r.T) + "\t" + Classe(h) + "\t" + Titre(h));
      return true;
    }, IntPtr.Zero);
    return liste;
  }
  // Fenêtres enfants visibles d'au moins 100 px (diagnostic : tables intégrées dans la fenêtre principale ?)
  public static List<string> ListerEnfants(long parent) {
    var liste = new List<string>();
    EnumChildWindows(new IntPtr(parent), delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L < 100 || r.B - r.T < 100) return true;
      liste.Add(h.ToInt64() + "\t" + (r.R - r.L) + "\t" + (r.B - r.T) + "\t" + Classe(h) + "\t" + Titre(h));
      return true;
    }, IntPtr.Zero);
    return liste;
  }
}
"@

function Lister-Fenetres {
  [FenetresWin]::Lister() | ForEach-Object {
    $p = $_ -split "`t", 6
    [pscustomobject]@{ Hwnd = $p[0]; ProcId = [int]$p[1]; Largeur = [int]$p[2]; Hauteur = [int]$p[3]; Classe = $p[4]; Titre = $p[5] }
  }
}

function Est-Table($fenetre) {
  if ($fenetre.Largeur -lt $TailleMinTable -or $fenetre.Hauteur -lt $TailleMinTable) { return $false }
  if ($FiltreTable -eq "*") { return $true }
  return ($fenetre.Titre -like $FiltreTable)
}

function Libelle-Fenetre($f) {
  $titre = if ($f.Titre) { $f.Titre } else { "(sans titre)" }
  return ($titre + " [" + $f.Classe + ", " + $f.Largeur + "x" + $f.Hauteur + "]")
}

# Processus reconnus + leurs processus fils (un client peut ouvrir ses tables dans un autre processus),
# sans les navigateurs ni l'Explorateur qu'il aurait lancés.
function Pids-Betclic($procs) {
  $pids = @{}
  foreach ($p in $procs) { $pids[[int]$p.Id] = $true }
  try {
    $tous = @(Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name)
    $exclus = @("explorer.exe") + ($Navigateurs | ForEach-Object { $_ + ".exe" })
    $ajout = $true
    while ($ajout) {
      $ajout = $false
      foreach ($t in $tous) {
        if ($pids.ContainsKey([int]$t.ParentProcessId) -and -not $pids.ContainsKey([int]$t.ProcessId) -and ($exclus -notcontains $t.Name.ToLower())) {
          $pids[[int]$t.ProcessId] = $true
          $ajout = $true
        }
      }
    }
  } catch {}
  return $pids
}

# ======================================================= tables intégrées : UI Automation
# Le client Betclic dessine ses tables à l'intérieur de sa fenêtre principale : on lit
# l'arbre d'accessibilité de cette fenêtre et on y cherche les éléments nommés comme
# une table (-MotifTable). Chaque nouvel élément = une table ouverte = une partie.
$MotifsTable = @($MotifTable -split "\|" | Where-Object { $_ })
$MotifsDepart = @($MotifDepart -split "\|" | Where-Object { $_ })
$script:uiaDisponible = $null

function Initialiser-Uia {
  if ($script:uiaDisponible -ne $null) { return $script:uiaDisponible }
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $script:uiaDisponible = $true
  } catch {
    $script:uiaDisponible = $false
    Journal ("UI Automation indisponible : " + $_.Exception.Message)
  }
  return $script:uiaDisponible
}

function Elements-Tables([string]$hwnd) {
  # Éléments de la fenêtre hwnd dont le nom correspond à un motif de table (Genre « table »)
  # ou de début de partie (Genre « depart ») : [{ Cle, Nom, Type, Classe, Genre }]
  $resultat = New-Object System.Collections.Generic.List[object]
  $racine = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][int64]$hwnd)
  if (-not $racine) { return $resultat }
  $tous = $racine.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $script:uiaElementsVus = $tous.Count
  foreach ($e in $tous) {
    $nom = $null
    try { $nom = $e.Current.Name } catch { continue }
    if (-not $nom) { continue }
    $nom = ($nom -replace "\s+", " ").Trim()
    $genre = $null
    foreach ($motif in $MotifsDepart) { if ($nom -like $motif) { $genre = "depart"; break } }
    if (-not $genre) { foreach ($motif in $MotifsTable) { if ($nom -like $motif) { $genre = "table"; break } } }
    if (-not $genre) { continue }
    $type = ""
    $classe = ""
    try { $type = $e.Current.ControlType.ProgrammaticName.Replace("ControlType.", ""); $classe = $e.Current.ClassName } catch {}
    $resultat.Add([pscustomobject]@{ Cle = (($e.GetRuntimeId()) -join "."); Nom = $nom; Type = $type; Classe = $classe; Genre = $genre })
  }
  return $resultat
}

function Dump-Uia([string]$hwnd, $l, [int]$max = 2500) {
  # Arbre d'accessibilité (vue contrôle) : type | classe | automationId | nom, indenté par profondeur.
  $racine = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][int64]$hwnd)
  $marcheur = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $pile = New-Object System.Collections.Generic.Stack[object]
  $pile.Push(@($racine, 0))
  $compte = 0
  while ($pile.Count -gt 0 -and $compte -lt $max) {
    $paire = $pile.Pop()
    $e = $paire[0]
    $prof = $paire[1]
    $compte += 1
    try {
      $c = $e.Current
      $nom = if ($c.Name) { ($c.Name -replace "\s+", " ") } else { "" }
      if ($nom.Length -gt 90) { $nom = $nom.Substring(0, 90) + "…" }
      $l.Add("   " + ("  " * $prof) + $c.ControlType.ProgrammaticName.Replace("ControlType.", "") + " | " + $c.ClassName + " | " + $c.AutomationId + " | " + $nom)
    } catch { continue }
    if ($prof -ge 16) { continue }
    $enfants = New-Object System.Collections.Generic.List[object]
    try {
      $x = $marcheur.GetFirstChild($e)
      while ($x) { $enfants.Add($x); $x = $marcheur.GetNextSibling($x) }
    } catch {}
    for ($i = $enfants.Count - 1; $i -ge 0; $i--) { $pile.Push(@($enfants[$i], $prof + 1)) }
  }
  if ($compte -ge $max) { $l.Add("   … (arrêt à $max éléments)") }
}

# ======================================================= historiques de mains sur le disque
$script:historiques = @{ fichiers = @{}; connus = @{}; initialise = $false }

function Ids-Parties-Du-Texte([string]$texte) {
  $ids = New-Object System.Collections.Generic.List[string]
  foreach ($m in [regex]::Matches($texte, "(?m)^(?:Game ID|Tournament ID|Tournoi)\s*[:#]\s*(\S+)\s*$")) { $ids.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($texte, "(?m)Tournament #(\d+)")) { $ids.Add("t" + $m.Groups[1].Value) }
  return $ids
}

function Scanner-Historiques {
  # Premier passage : mémorise les parties déjà présentes (pas comptées) ; ensuite, renvoie les ids nouveaux.
  $nouvelles = New-Object System.Collections.Generic.List[string]
  if (-not $DossierHistoriques -or -not (Test-Path $DossierHistoriques)) { return $nouvelles }
  $limite = (Get-Date).AddHours(-48)
  $fichiers = @(Get-ChildItem -Path $DossierHistoriques -File -Recurse -Depth 3 -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt $limite -and $_.Length -lt 50MB })
  foreach ($f in $fichiers) {
    $precedent = $script:historiques.fichiers[$f.FullName]
    $etat = @{ mtime = $f.LastWriteTimeUtc.Ticks; taille = $f.Length }
    $change = (-not $precedent) -or ($precedent.mtime -ne $etat.mtime) -or ($precedent.taille -ne $etat.taille)
    $script:historiques.fichiers[$f.FullName] = $etat
    if (-not $change) { continue }
    $texte = ""
    try { $texte = [System.IO.File]::ReadAllText($f.FullName) } catch { continue }
    foreach ($id in (Ids-Parties-Du-Texte $texte)) {
      if ($script:historiques.connus.ContainsKey($id)) { continue }
      $script:historiques.connus[$id] = $true
      if ($script:historiques.initialise) { $nouvelles.Add($id) }
    }
  }
  if (-not $script:historiques.initialise) {
    $script:historiques.initialise = $true
    Journal ("Historiques : " + $fichiers.Count + " fichier(s) récent(s) dans " + $DossierHistoriques + ", " + $script:historiques.connus.Count + " partie(s) déjà présentes.")
  }
  return $nouvelles
}

function Diagnostic([switch]$Silencieux, [int]$TailleArbre = 2500) {
  $procs = Processus-Betclic
  $pids = Pids-Betclic $procs
  $noms = @{}
  foreach ($p in Get-Process) { $noms[[int]$p.Id] = $p.ProcessName }
  $l = New-Object System.Collections.Generic.List[string]
  $l.Add("Diagnostic HUD Expresso Trainer — " + (Get-Date))
  $l.Add("Réglages : -Processus '$Processus'  -FiltreTable '$FiltreTable'  -TailleMinTable $TailleMinTable  -DelaiDemarrage $DelaiDemarrage")
  $l.Add("")
  $l.Add("1. Processus reconnus comme Betclic : " + $procs.Count)
  foreach ($p in $procs) {
    $debut = "?"
    try { $debut = $p.StartTime.ToString("HH:mm:ss") } catch {}
    $exe = ""
    try { $exe = $p.Path } catch {}
    $l.Add("   " + $p.ProcessName + "  (pid " + $p.Id + ", démarré à " + $debut + ", fenêtre principale : " + $p.MainWindowTitle + ")")
    if ($exe) { $l.Add("      exécutable : " + $exe) }
  }
  $l.Add("   + processus fils suivis : " + (($pids.Keys | Where-Object { $noms.ContainsKey($_) } | ForEach-Object { $noms[$_] + " (" + $_ + ")" }) -join ", "))
  $l.Add("")
  $l.Add("2. Fenêtres visibles de ces processus (ce que le HUD compare pour compter les tables) :")
  $fenetresBetclic = @(Lister-Fenetres | Where-Object { $pids.ContainsKey($_.ProcId) })
  if ($fenetresBetclic.Count -eq 0) { $l.Add("   (aucune)") }
  foreach ($f in $fenetresBetclic) {
    $table = if (Est-Table $f) { "TABLE ?" } else { "ignorée" }
    $l.Add("   " + $table + "  " + (Libelle-Fenetre $f) + "  hwnd " + $f.Hwnd)
    foreach ($e in [FenetresWin]::ListerEnfants([int64]$f.Hwnd)) {
      $q = $e -split "`t", 5
      $l.Add("        enfant : " + (if ($q[4]) { $q[4] } else { "(sans titre)" }) + " [" + $q[3] + ", " + $q[1] + "x" + $q[2] + "]")
    }
  }
  $l.Add("")
  $l.Add("2b. Éléments d'interface à l'intérieur de ces fenêtres (UI Automation) ; motifs de table : " + ($MotifsTable -join " | ") + " ; motifs de début de partie : " + ($MotifsDepart -join " | "))
  if (Initialiser-Uia) {
    foreach ($f in $fenetresBetclic) {
      if ($f.Largeur -lt $TailleMinTable -or $f.Hauteur -lt $TailleMinTable) { continue }
      $chrono = [System.Diagnostics.Stopwatch]::StartNew()
      $tables = @(Elements-Tables $f.Hwnd)
      $l.Add("   Fenêtre " + (Libelle-Fenetre $f) + " : " + $script:uiaElementsVus + " éléments lus en " + $chrono.ElapsedMilliseconds + " ms, " + $tables.Count + " correspondant à un motif de table :")
      foreach ($t in $tables) { $l.Add("      " + $t.Genre.ToUpper() + " : " + $t.Nom + " [" + $t.Type + ", " + $t.Classe + ", id " + $t.Cle + "]") }
      $l.Add("   Arbre (type | classe | id | nom) :")
      Dump-Uia $f.Hwnd $l $TailleArbre
    }
  } else { $l.Add("   (UI Automation indisponible)") }
  $l.Add("")
  $l.Add("3. Processus dont le nom ou la fenêtre évoque le poker (si le 1. est vide, c'est là qu'on trouve le bon -Processus) :")
  foreach ($p in Get-Process) {
    $titre = ""
    try { $titre = $p.MainWindowTitle } catch {}
    if ($p.ProcessName -like "*poker*" -or $p.ProcessName -like "*betclic*" -or $p.ProcessName -like "*expresso*" -or $titre -like "*poker*" -or $titre -like "*betclic*" -or $titre -like "*expresso*") {
      $l.Add("   " + $p.ProcessName + "  (pid " + $p.Id + ")  fenêtre principale : " + $titre)
    }
  }
  $l.Add("")
  $l.Add("4. Toutes les fenêtres visibles (processus | classe | taille | titre) :")
  foreach ($f in Lister-Fenetres) {
    $nom = if ($noms.ContainsKey($f.ProcId)) { $noms[$f.ProcId] } else { "pid " + $f.ProcId }
    $l.Add("   " + $nom + " | " + $f.Classe + " | " + $f.Largeur + "x" + $f.Hauteur + " | " + $f.Titre)
  }
  $l.Add("")
  $l.Add("5. Dossiers Betclic / poker et leurs fichiers récents (historiques de mains sur le disque ?) :")
  $racines = @($env:APPDATA, $env:LOCALAPPDATA, $env:PROGRAMDATA, (Join-Path $env:USERPROFILE "Documents")) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($r in $racines) {
    $dossiers = @(Get-ChildItem -Path $r -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "*betclic*" -or $_.Name -like "*poker*" -or $_.Name -like "*playground*" })
    foreach ($d in $dossiers) {
      $l.Add("   " + $d.FullName)
      $recents = @(Get-ChildItem -Path $d.FullName -File -Recurse -Depth 4 -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-3) } | Sort-Object LastWriteTime -Descending | Select-Object -First 30)
      foreach ($fi in $recents) {
        $indice = ""
        if ($fi.Length -lt 20MB -and (@(".txt", ".log", ".json", ".xml", ".hh", ".csv", "") -contains $fi.Extension.ToLower())) {
          try {
            $tete = (Get-Content -Path $fi.FullName -TotalCount 80 -ErrorAction Stop) -join "`n"
            if ($tete -match "Hand ID|\*\*\* HEADER|Game ID|Tournament|Spin & Rush|Expresso") { $indice = "   <-- ressemble à un historique de mains" }
          } catch {}
        }
        $l.Add("      " + $fi.LastWriteTime.ToString("dd/MM HH:mm") + "  " + [Math]::Round($fi.Length / 1KB) + " Ko  " + $fi.FullName.Substring($d.FullName.Length) + $indice)
      }
    }
  }
  $fichier = Join-Path $Dossier "diagnostic.txt"
  $l | Set-Content -Path $fichier -Encoding UTF8
  Journal "Diagnostic écrit dans $fichier"
  if (-not $Silencieux) { Start-Process notepad.exe $fichier }
  return ($l -join "`r`n")
}

# Journal (dernières lignes) + diagnostic dans le presse-papiers : il n'y a plus qu'à coller.
function Copier-Pour-Claude {
  $journal = ""
  $cheminJournal = Join-Path $Dossier "journal.log"
  if (Test-Path $cheminJournal) { $journal = (Get-Content -Path $cheminJournal -Encoding UTF8 | Select-Object -Last 150) -join "`r`n" }
  $texte = "=== journal.log (dernières lignes) ===`r`n" + $journal + "`r`n`r`n=== diagnostic.txt ===`r`n" + (Diagnostic -Silencieux -TailleArbre 1500)
  try {
    Set-Clipboard -Value $texte
    Journal ("Journal et diagnostic copiés dans le presse-papiers (" + $texte.Length + " caractères) : colle-les dans la conversation.")
    return $true
  } catch {
    Journal ("Copie impossible : " + $_.Exception.Message)
    return $false
  }
}

# Télécharge la dernière version du script et réinstalle (la veille redémarre).
function Mettre-A-Jour {
  $cible = Join-Path $Dossier "hud-betclic.ps1"
  $r = Invoke-WebRequest -UseBasicParsing -Uri $UrlScript
  $t = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()).TrimStart([char]0xFEFF)
  if ($t -notlike "*hud-betclic.ps1*") { throw "téléchargement incomplet" }
  [System.IO.File]::WriteAllText($cible, $t, (New-Object System.Text.UTF8Encoding $true))
  Journal "Script mis à jour : $cible"
  $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ('"' + $cible + '"'), "-Installer")
  Start-Process -FilePath "powershell.exe" -ArgumentList ($args -join " ") -WindowStyle Hidden
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
  tablesUia = @{}            # clé d'élément → nom des tables lues dans la fenêtre (UI Automation)
  uiaBaseline = 0            # passages UIA de référence effectués (les tables déjà ouvertes ne comptent pas)
  uiaClesPrecedentes = ""
  uiaProuve = $false         # UIA a déjà trouvé des tables : on ne compte plus les fenêtres à part
  uiaNombre = 0              # nombre d'éléments « table » de référence (règle nombre)
  uiaCandidat = $null        # nombre vu à la lecture précédente, en attente de confirmation
  passage = 0
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

function Remettre-A-Zero {
  $script:etat.debut = $null
  $script:etat.parties = 0
  $script:etat.derniereActivite = $null
  Sauver-Session
  Journal "Session remise à zéro."
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
        <Button x:Name="Reset" DockPanel.Dock="Right" Content="↺" Width="30" Height="22" Background="Transparent"
                Foreground="#FF9A9A9A" BorderThickness="0" FontSize="15" Padding="0" Margin="0,0,2,0" Cursor="Hand" Focusable="False"
                ToolTip="Remettre à zéro le chrono et les parties (deux clics)"/>
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
foreach ($nom in @("Fermer", "Reset", "Cadence", "Point", "Chrono", "Moins", "Plus", "Nombre", "Libelle")) { $ctl[$nom] = $window.FindName($nom) }
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

# Remise à zéro en deux clics : le premier arme le bouton (↺ ?) pendant 4 s, le second confirme.
$script:resetArme = $false
$timerReset = New-Object System.Windows.Threading.DispatcherTimer
$timerReset.Interval = [TimeSpan]::FromSeconds(4)
$timerReset.Add_Tick({ Desarmer-Reset })
function Desarmer-Reset {
  $timerReset.Stop()
  $script:resetArme = $false
  $ctl.Reset.Content = "↺"
  $ctl.Reset.Foreground = $CouleurGris
}
function Reset-Clic {
  if ($script:resetArme) {
    Desarmer-Reset
    Remettre-A-Zero
  } else {
    $script:resetArme = $true
    $ctl.Reset.Content = "↺ ?"
    $ctl.Reset.Foreground = $CouleurOrange
    $timerReset.Start()
  }
}
$ctl.Reset.Add_Click({ Reset-Clic })
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
  @{ texte = "Remettre à zéro (sans archiver)"; action = { Remettre-A-Zero } },
  @{ texte = "Copier journal + diagnostic (à coller à Claude)"; action = {
      $window.Cursor = [System.Windows.Input.Cursors]::Wait
      try { [void](Copier-Pour-Claude) } finally { $window.Cursor = $null }
    } },
  @{ texte = "Mettre à jour le HUD (dernière version)"; action = {
      try { Mettre-A-Jour; $script:etat.quitter = $true } catch { Journal ("Mise à jour impossible : " + $_.Exception.Message) }
    } },
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
        $script:etat.tablesUia = @{}
        $script:etat.uiaBaseline = 0
        $script:etat.uiaClesPrecedentes = ""
        $script:etat.uiaNombre = 0
        $script:etat.uiaCandidat = $null
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
      Journal ("Betclic détecté : " + (($procs | ForEach-Object { $_.ProcessName + " (pid " + $_.Id + ")" }) -join ", ") + ".")
      Archiver-Si-Perimee
      $script:etat.derniereActivite = Maintenant-Ms
      Sauver-Session
      Afficher-Hud
    }
    # Fenêtres de démarrage (connexion, lobby) : pendant DelaiDemarrage secondes après le
    # lancement du processus Betclic lui-même, pas après celui du HUD.
    $debutBetclic = $null
    foreach ($p in $procs) { try { if (-not $debutBetclic -or $p.StartTime -lt $debutBetclic) { $debutBetclic = $p.StartTime } } catch {} }
    if (-not $debutBetclic) { $debutBetclic = $script:etat.momentDetection }
    $demarrage = ((Get-Date) - $debutBetclic).TotalSeconds -lt $DelaiDemarrage
    $pids = Pids-Betclic $procs
    $fenetres = @(Lister-Fenetres | Where-Object { $pids.ContainsKey($_.ProcId) })
    $presentes = @{}
    foreach ($f in $fenetres) {
      $presentes[$f.Hwnd] = $true
      if ($script:etat.connues.ContainsKey($f.Hwnd)) {
        if ($CompterTitres -and $script:etat.connues[$f.Hwnd] -ne $f.Titre -and -not $demarrage -and (Est-Table $f)) {
          $script:etat.tablesVues += 1
          Journal ("Table (nouveau titre) : " + (Libelle-Fenetre $f))
          Ajouter-Partie 1 "table"
        }
        $script:etat.connues[$f.Hwnd] = $f.Titre
        continue
      }
      $script:etat.connues[$f.Hwnd] = $f.Titre
      if ($premierPassage) {
        Journal ("Fenêtre déjà ouverte, non comptée : " + (Libelle-Fenetre $f))
      } elseif ($demarrage) {
        Journal ("Fenêtre de démarrage de Betclic, non comptée : " + (Libelle-Fenetre $f))
      } elseif (Est-Table $f) {
        if ($ModeTables -eq "uia" -or ($ModeTables -eq "auto" -and $script:etat.uiaProuve)) {
          Journal ("Nouvelle fenêtre (les tables sont lues à l'intérieur, non comptée ici) : " + (Libelle-Fenetre $f))
        } else {
          $script:etat.tablesVues += 1
          Journal ("Table détectée (fenêtre) : " + (Libelle-Fenetre $f))
          Ajouter-Partie 1 "table"
        }
      } else {
        Journal ("Nouvelle fenêtre ignorée (trop petite ou hors filtre) : " + (Libelle-Fenetre $f))
      }
    }
    foreach ($cle in @($script:etat.connues.Keys)) { if (-not $presentes.ContainsKey($cle)) { $script:etat.connues.Remove($cle) } }

    # ---- tables à l'intérieur de la fenêtre (UI Automation), un passage sur deux (≈ 6 s)
    $script:etat.passage += 1
    if ($ModeTables -ne "fenetres" -and ($script:etat.passage % 2 -eq 0) -and (Initialiser-Uia)) {
      $chrono = [System.Diagnostics.Stopwatch]::StartNew()
      $elements = New-Object System.Collections.Generic.List[object]
      foreach ($f in $fenetres) {
        if ($f.Largeur -lt $TailleMinTable -or $f.Hauteur -lt $TailleMinTable) { continue }
        try { foreach ($e in (Elements-Tables $f.Hwnd)) { $elements.Add($e) } } catch { Journal ("UIA : " + $_.Exception.Message) }
      }
      if ($RegleUia -eq "depart") { $elements = @($elements | Where-Object { $_.Genre -eq "depart" }) }
      else { $elements = @($elements | Where-Object { $_.Genre -eq "table" }) }
      $cles = ($elements | ForEach-Object { $_.Cle } | Sort-Object) -join ","
      # Référence : deux lectures identiques de suite (l'arbre d'accessibilité se construit à la première lecture).
      if ($script:etat.uiaBaseline -lt 2) {
        if ($cles -eq $script:etat.uiaClesPrecedentes) { $script:etat.uiaBaseline += 1 } else { $script:etat.uiaBaseline = 0 }
        $script:etat.uiaClesPrecedentes = $cles
        if ($script:etat.uiaBaseline -eq 0 -or $script:etat.uiaBaseline -eq 2) {
          Journal ("UIA (règle $RegleUia) : " + $script:uiaElementsVus + " éléments lus en " + $chrono.ElapsedMilliseconds + " ms, " + $elements.Count + " élément(s) déjà présent(s), non compté(s)" + ($(if ($elements.Count) { " : " + (($elements | ForEach-Object { $_.Nom + " [" + $_.Type + "]" }) -join ", ") } else { "" })))
        }
        $script:etat.tablesUia = @{}
        foreach ($e in $elements) { $script:etat.tablesUia[$e.Cle] = $e.Nom }
        $script:etat.uiaNombre = $elements.Count
        $script:etat.uiaCandidat = $null
        if ($elements.Count -gt 0) { $script:etat.uiaProuve = $true }
      } elseif ($RegleUia -eq "nombre" -or $RegleUia -eq "depart") {
        # Une partie quand le nombre d'éléments (« table », ou « début de partie » = niveau de blinds 1)
        # dépasse la référence à deux lectures de suite ; un rafraîchissement de l'interface qui recrée
        # les mêmes éléments ne change pas le nombre.
        $n = $elements.Count
        if ($n -lt $script:etat.uiaNombre) {
          Journal ("UIA : " + $script:etat.uiaNombre + " → " + $n + " élément(s) (" + $(if ($RegleUia -eq "depart") { "fin du niveau 1 ou table fermée" } else { "table fermée" }) + ").")
          $script:etat.uiaNombre = $n
          $script:etat.uiaCandidat = $null
        } elseif ($n -gt $script:etat.uiaNombre) {
          if ($script:etat.uiaCandidat -eq $n) {
            $delta = $n - $script:etat.uiaNombre
            $script:etat.uiaNombre = $n
            $script:etat.uiaCandidat = $null
            $script:etat.uiaProuve = $true
            $noms = ($elements | ForEach-Object { $_.Nom + " [" + $_.Type + ", " + $_.Classe + "]" }) -join ", "
            if ($demarrage) {
              Journal ("Tables (UIA) pendant le démarrage de Betclic, non comptées : " + $noms)
            } else {
              $script:etat.tablesVues += $delta
              Journal ("UIA : " + ($n - $delta) + " → " + $n + " élément(s), +" + $delta + " partie(s) : " + $noms)
              Ajouter-Partie $delta "table"
            }
          } else {
            $script:etat.uiaCandidat = $n
            Journal ("UIA : " + $script:etat.uiaNombre + " → " + $n + " élément(s) vu une fois, confirmation à la prochaine lecture.")
          }
        } else {
          $script:etat.uiaCandidat = $null
        }
        $script:etat.tablesUia = @{}
        foreach ($e in $elements) { $script:etat.tablesUia[$e.Cle] = $e.Nom }
      } else {
        $presentesUia = @{}
        foreach ($e in $elements) {
          $presentesUia[$e.Cle] = $true
          if ($script:etat.tablesUia.ContainsKey($e.Cle)) { continue }
          $script:etat.tablesUia[$e.Cle] = $e.Nom
          $script:etat.uiaProuve = $true
          if ($demarrage) {
            Journal ("Table (UIA) pendant le démarrage de Betclic, non comptée : " + $e.Nom)
          } else {
            $script:etat.tablesVues += 1
            Journal ("Table détectée (UIA) : " + $e.Nom + " [" + $e.Type + ", " + $e.Classe + "]")
            Ajouter-Partie 1 "table"
          }
        }
        foreach ($cle in @($script:etat.tablesUia.Keys)) { if (-not $presentesUia.ContainsKey($cle)) { Journal ("Table fermée (UIA) : " + $script:etat.tablesUia[$cle]); $script:etat.tablesUia.Remove($cle) } }
      }
    }

    # ---- historiques de mains sur le disque
    if ($DossierHistoriques) {
      foreach ($id in (Scanner-Historiques)) {
        Journal ("Partie détectée (historique) : " + $id)
        Ajouter-Partie 1 "historique"
      }
    }
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
  Journal ("Veille démarrée : processus '$Processus', règle $RegleUia, début de partie '" + ($MotifsDepart -join " | ") + "', table '" + ($MotifsTable -join " | ") + "', mode $ModeTables" + ($(if ($DossierHistoriques) { ", historiques $DossierHistoriques" } else { "" })) + ", dossier $Dossier")
  Passage-Veille
} else {
  Journal "HUD ouvert."
  Afficher-Hud
}
[System.Windows.Threading.Dispatcher]::Run()
