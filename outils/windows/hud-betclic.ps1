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

  Options (à ajouter après la commande, ex. : installer-hud-betclic.cmd -MotifTable "Spin & Rush*") :
    -Processus "*betclic*"   nom du processus du client Betclic (joker * accepté)
    -MotifTable "Spin & Rush*|Expresso*|Spin & Go*"
                             titres des fenêtres de table (option Betclic « Afficher les tables dans des
                             fenêtres indépendantes », indispensable). Une fenêtre qui apparaît avec un tel
                             titre, ou dont le titre le devient, = une partie.
    -MotifDepart "10 - 20|10-20|10 / 20"
                             texte du niveau de blinds 1, lu à l'intérieur des fenêtres de table (en
                             arrière-plan) : s'il réapparaît dans une fenêtre réutilisée = nouvelle partie
    -MotifRejouer "Rejouer*|Relancer*|Nouvelle partie*|Jouer encore*|Play again*"
                             texte du bouton de fin de partie : quand il disparaît d'une fenêtre qui reste
                             ouverte, une nouvelle partie a été relancée dans cette fenêtre
    -SansLectureInterieure   ne compter que par les titres de fenêtres
    -DelaiMemePartie 90      secondes après une partie comptée pendant lesquelles le niveau 1 de la
                             même fenêtre ne recompte pas
    -TailleMinTable 300      taille minimale (px) d'une fenêtre de table
    -PauseMax 120            minutes sans activité au-delà desquelles une nouvelle session commence
    -DossierHistoriques "<chemin>"
                             si le client écrit ses historiques de mains sur le disque : chaque nouveau
                             « Game ID » compte une partie
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
  [switch]$SansLectureInterieure,
  [string]$Processus = "*betclic*",
  [string]$MotifTable = "Spin & Rush*|Expresso*|Spin & Go*",
  [string]$MotifDepart = "10 - 20|10-20|10 / 20",
  [string]$MotifRejouer = "Rejouer*|Relancer*|Nouvelle partie*|Jouer encore*|Play again*",
  [string]$DossierHistoriques = "",
  [int]$DelaiMemePartie = 90,
  [int]$PauseMax = 120,
  [int]$TailleMinTable = 300,
  [string]$Dossier = (Join-Path $env:LOCALAPPDATA "Expresso Trainer")
)

$Version = "2026-10-20.1"
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
  if ($MotifTable -ne "Spin & Rush*|Expresso*|Spin & Go*") { $a += @("-MotifTable", ('"' + $MotifTable + '"')) }
  if ($MotifDepart -ne "10 - 20|10-20|10 / 20") { $a += @("-MotifDepart", ('"' + $MotifDepart + '"')) }
  if ($MotifRejouer -ne "Rejouer*|Relancer*|Nouvelle partie*|Jouer encore*|Play again*") { $a += @("-MotifRejouer", ('"' + $MotifRejouer + '"')) }
  if ($DossierHistoriques) { $a += @("-DossierHistoriques", ('"' + $DossierHistoriques + '"')) }
  if ($DelaiMemePartie -ne 90) { $a += @("-DelaiMemePartie", $DelaiMemePartie) }
  if ($PauseMax -ne 120) { $a += @("-PauseMax", $PauseMax) }
  if ($TailleMinTable -ne 300) { $a += @("-TailleMinTable", $TailleMinTable) }
  if ($Dossier -ne $DossierParDefaut) { $a += @("-Dossier", ('"' + $Dossier + '"')) }
  if ($SansLectureInterieure) { $a += "-SansLectureInterieure" }
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
if ($Copier) { Write-Host (Copier-Pour-Claude); return }
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
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);
  static int Masquee(IntPtr h) {
    int v = 0;
    try { DwmGetWindowAttribute(h, 14, out v, 4); } catch { v = 0; }
    return v;
  }
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
  // "hwnd TAB pid TAB largeur TAB hauteur TAB classe TAB propriétaire TAB masquée TAB titre" pour chaque fenêtre visible
  public static List<string> Lister() {
    var liste = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT r; GetWindowRect(h, out r);
      IntPtr proprietaire = GetWindow(h, 4);
      liste.Add(h.ToInt64() + "\t" + pid + "\t" + (r.R - r.L) + "\t" + (r.B - r.T) + "\t" + Classe(h) + "\t" + proprietaire.ToInt64() + "\t" + Masquee(h) + "\t" + Titre(h));
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
    $p = $_ -split "`t", 8
    [pscustomobject]@{ Hwnd = $p[0]; ProcId = [int]$p[1]; Largeur = [int]$p[2]; Hauteur = [int]$p[3]; Classe = $p[4]; Proprietaire = $p[5]; Masquee = ([int]$p[6] -ne 0); Titre = $p[7] }
  }
}

function Est-TitrePartie([string]$titre) {
  if (-not $titre) { return $false }
  $t = ($titre -replace "\s+", " ").Trim()
  foreach ($m in $MotifsTable) { if ($t -like $m) { return $true } }
  return $false
}

function Est-FenetreDePartie($f) {
  if ($f.Largeur -lt $TailleMinTable -or $f.Hauteur -lt $TailleMinTable) { return $false }
  if ($f.Classe -eq "#32768" -or $f.Classe -like "*Tooltip*") { return $false }
  if ($f.Masquee) { return $false }
  return (Est-TitrePartie $f.Titre)
}

# Betclic ouvre parfois deux fenêtres pour une table (même titre, même seconde, taille à quelques
# pixels près, ou l'une appartenant à l'autre) : on ne garde qu'une fenêtre « principale » par table.
function Regrouper-Jumelles($candidates, $tablesConnues) {
  # candidates : fenêtres de partie apparues à ce passage ; renvoie @{ principales = [...]; jumelles = @{ hwnd → principale } }
  $principales = New-Object System.Collections.Generic.List[object]
  $jumelles = @{}
  $hwnds = @{}
  foreach ($c in $candidates) { $hwnds[$c.Hwnd] = $true }
  foreach ($c in ($candidates | Sort-Object { if ($_.Proprietaire -and $_.Proprietaire -ne "0") { 1 } else { 0 } }, Hwnd)) {
    if ($c.Proprietaire -and $c.Proprietaire -ne "0" -and ($hwnds.ContainsKey($c.Proprietaire) -or $tablesConnues.ContainsKey($c.Proprietaire))) {
      $jumelles[$c.Hwnd] = $c.Proprietaire
      continue
    }
    $doublon = $null
    foreach ($p in $principales) {
      if ($p.Titre -eq $c.Titre -and [Math]::Abs($p.Largeur - $c.Largeur) -le 12 -and [Math]::Abs($p.Hauteur - $c.Hauteur) -le 12) { $doublon = $p; break }
    }
    if ($doublon) { $jumelles[$c.Hwnd] = $doublon.Hwnd } else { $principales.Add($c) }
  }
  return @{ principales = $principales; jumelles = $jumelles }
}

function Libelle-Fenetre($f) {
  $titre = if ($f.Titre) { $f.Titre } else { "(sans titre)" }
  $extra = ""
  if ($f.Proprietaire -and $f.Proprietaire -ne "0") { $extra += ", propriétaire " + $f.Proprietaire }
  if ($f.Masquee) { $extra += ", masquée" }
  return ($titre + " [" + $f.Classe + ", " + $f.Largeur + "x" + $f.Hauteur + ", hwnd " + $f.Hwnd + $extra + "]")
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
$ProcessusSansTable = @("msedgewebview2", "chrome", "msedge")
$MotifsDepart = @($MotifDepart -split "\|" | Where-Object { $_ })
$MotifsRejouer = @($MotifRejouer -split "\|" | Where-Object { $_ })
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

# ---- MSAA (IAccessible) : le canal d'accessibilité que le client Flutter de Betclic expose vraiment.
$script:msaaDisponible = $null
function Initialiser-Msaa {
  if ($script:msaaDisponible -ne $null) { return $script:msaaDisponible }
  try {
    $acc = [System.Reflection.Assembly]::Load("Accessibility, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a")
    Add-Type -ReferencedAssemblies @($acc.Location) -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using Accessibility;
public static class MsaaWin {
  [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object ppvObject);
  [DllImport("oleacc.dll")] static extern uint AccessibleChildren(IAccessible paccContainer, int iChildStart, int cChildren, [Out] object[] rgvarChildren, out int pcObtained);
  [DllImport("oleacc.dll", CharSet = CharSet.Unicode)] static extern uint GetRoleText(uint role, StringBuilder lpszRole, uint cchRoleMax);
  static Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
  const uint OBJID_CLIENT = 0xFFFFFFFC;
  public static IAccessible Racine(long hwnd) {
    object o;
    int hr = AccessibleObjectFromWindow(new IntPtr(hwnd), OBJID_CLIENT, ref IID_IAccessible, out o);
    if (hr != 0) return null;
    return o as IAccessible;
  }
  static string Propre(string s) { return (s ?? "").Replace("\t", " ").Replace("\r", " ").Replace("\n", " ").Trim(); }
  // "profondeur TAB chemin TAB rôle TAB nom TAB valeur" pour chaque nœud (parcours borné)
  public static List<string> Lister(long hwnd, int max, int budgetMs) {
    var liste = new List<string>();
    var racine = Racine(hwnd);
    if (racine == null) return liste;
    var sw = System.Diagnostics.Stopwatch.StartNew();
    Marcher(racine, 0, "0", liste, max, budgetMs, sw);
    return liste;
  }
  static void Marcher(IAccessible acc, int prof, string chemin, List<string> liste, int max, int budgetMs, System.Diagnostics.Stopwatch sw) {
    if (liste.Count >= max || sw.ElapsedMilliseconds > budgetMs || prof > 40) return;
    string nom = "", valeur = "", role = "";
    try { nom = Propre(acc.get_accName(0) as string); } catch {}
    try { valeur = Propre(acc.get_accValue(0) as string); } catch {}
    try {
      object r = acc.get_accRole(0);
      if (r is int) { var sb = new StringBuilder(64); GetRoleText((uint)(int)r, sb, 64); role = sb.ToString(); }
      else role = Convert.ToString(r);
    } catch {}
    liste.Add(prof + "\t" + chemin + "\t" + role + "\t" + nom + "\t" + valeur);
    int n = 0;
    try { n = acc.accChildCount; } catch { return; }
    if (n <= 0 || n > 5000) return;
    var enfants = new object[n];
    int obtenus;
    if (AccessibleChildren(acc, 0, n, enfants, out obtenus) != 0) return;
    for (int i = 0; i < obtenus; i++) {
      var e = enfants[i] as IAccessible;
      if (e != null) { Marcher(e, prof + 1, chemin + "." + i, liste, max, budgetMs, sw); }
      else {
        try {
          string nomSimple = Propre(acc.get_accName(enfants[i]) as string);
          if (nomSimple.Length > 0) liste.Add((prof + 1) + "\t" + chemin + "." + i + "\t(simple)\t" + nomSimple + "\t");
        } catch {}
      }
      if (liste.Count >= max || sw.ElapsedMilliseconds > budgetMs) return;
    }
  }
}
"@
    $script:msaaDisponible = $true
  } catch {
    $script:msaaDisponible = $false
    Journal ("MSAA indisponible : " + $_.Exception.Message)
  }
  return $script:msaaDisponible
}

function Msaa-Lister([string]$hwnd, [int]$max = 3000, [int]$budgetMs = 2000) {
  # [{ Profondeur, Chemin, Role, Nom, Valeur }] pour la fenêtre hwnd (objet client MSAA)
  $liste = New-Object System.Collections.Generic.List[object]
  if (-not (Initialiser-Msaa)) { return $liste }
  foreach ($ligne in [MsaaWin]::Lister([int64]$hwnd, $max, $budgetMs)) {
    $p = $ligne -split "`t", 5
    $liste.Add([pscustomobject]@{ Profondeur = [int]$p[0]; Chemin = $p[1]; Role = $p[2]; Nom = $p[3]; Valeur = $p[4] })
  }
  return $liste
}

function Genre-Du-Nom([string]$nom) {
  foreach ($motif in $MotifsDepart) { if ($nom -like $motif) { return "depart" } }
  foreach ($motif in $MotifsTable) { if ($nom -like $motif) { return "table" } }
  return $null
}

function Elements-Tables([string]$hwnd) {
  # Éléments d'interface de la fenêtre hwnd (et de ses fenêtres enfants) dont le nom correspond à un
  # motif de table (Genre « table ») ou de début de partie (Genre « depart »), lus par UI Automation
  # et par MSAA : [{ Cle, Nom, Type, Classe, Genre, Source }]. Source = canal:hwnd, pour que le même
  # texte vu par deux canaux ne compte pas deux fois (voir Compter-Elements).
  $resultat = New-Object System.Collections.Generic.List[object]
  $script:uiaElementsVus = 0
  $script:msaaElementsVus = 0
  if (Initialiser-Uia) {
    try {
      $racine = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][int64]$hwnd)
      if ($racine) {
        $tous = $racine.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        $script:uiaElementsVus = $tous.Count
        foreach ($e in $tous) {
          $nom = $null
          try { $nom = $e.Current.Name } catch { continue }
          if (-not $nom) { continue }
          $nom = ($nom -replace "\s+", " ").Trim()
          $genre = Genre-Du-Nom $nom
          if (-not $genre) { continue }
          $type = ""
          $classe = ""
          try { $type = $e.Current.ControlType.ProgrammaticName.Replace("ControlType.", ""); $classe = $e.Current.ClassName } catch {}
          $resultat.Add([pscustomobject]@{ Cle = ("uia." + (($e.GetRuntimeId()) -join ".")); Nom = $nom; Type = $type; Classe = $classe; Genre = $genre; Source = "uia:" + $hwnd })
        }
      }
    } catch { Journal ("UIA : " + $_.Exception.Message) }
  }
  # MSAA : la fenêtre elle-même puis ses fenêtres enfants (la vue Flutter est une fenêtre enfant)
  $cibles = New-Object System.Collections.Generic.List[string]
  $cibles.Add($hwnd)
  foreach ($e in [FenetresWin]::ListerEnfants([int64]$hwnd)) { $cibles.Add(($e -split "`t", 5)[0]) }
  foreach ($cible in $cibles) {
    $noeuds = Msaa-Lister $cible 3000 1500
    $script:msaaElementsVus += $noeuds.Count
    foreach ($nd in $noeuds) {
      foreach ($texte in @($nd.Nom, $nd.Valeur)) {
        if (-not $texte) { continue }
        $nom = ($texte -replace "\s+", " ").Trim()
        $genre = Genre-Du-Nom $nom
        if (-not $genre) { continue }
        $resultat.Add([pscustomobject]@{ Cle = ("msaa." + $cible + "." + $nd.Chemin); Nom = $nom; Type = $nd.Role; Classe = "msaa"; Genre = $genre; Source = "msaa:" + $cible })
        break
      }
    }
  }
  return $resultat
}

# Nombre d'éléments d'un genre : le maximum par canal, pas la somme (un même texte peut être vu par
# UI Automation et par MSAA, ou dans la fenêtre hôte et dans sa vue enfant).
function Compter-Elements($elements, [string]$genre) {
  $parSource = @{}
  foreach ($e in $elements) {
    if ($e.Genre -ne $genre) { continue }
    if (-not $parSource.ContainsKey($e.Source)) { $parSource[$e.Source] = 0 }
    $parSource[$e.Source] += 1
  }
  $max = 0
  foreach ($v in $parSource.Values) { if ($v -gt $max) { $max = $v } }
  return $max
}

function Dump-Uia([string]$hwnd, $l, [int]$max = 2500, [int]$BudgetMs = 20000) {
  # Arbre d'accessibilité (vue contrôle) : type | classe | automationId | nom, indenté par profondeur.
  $racine = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][int64]$hwnd)
  $marcheur = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $pile = New-Object System.Collections.Generic.Stack[object]
  $pile.Push(@($racine, 0))
  $compte = 0
  $chrono = [System.Diagnostics.Stopwatch]::StartNew()
  while ($pile.Count -gt 0 -and $compte -lt $max) {
    if ($chrono.ElapsedMilliseconds -gt $BudgetMs) { $l.Add("   … (arrêt après $BudgetMs ms, $compte éléments)"); return }
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

function Diagnostic([switch]$Silencieux, [int]$TailleArbre = 2500, [switch]$Rapide) {
  $procs = Processus-Betclic
  $pids = Pids-Betclic $procs
  $noms = @{}
  foreach ($p in Get-Process) { $noms[[int]$p.Id] = $p.ProcessName }
  $l = New-Object System.Collections.Generic.List[string]
  $l.Add("Diagnostic HUD Expresso Trainer version $Version — " + (Get-Date))
  $l.Add("Réglages : -Processus '$Processus'  -MotifTable '$MotifTable'  -MotifDepart '$MotifDepart'  -TailleMinTable $TailleMinTable")
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
    $table = if (Est-FenetreDePartie $f) { "PARTIE" } else { "ignorée" }
    $l.Add("   " + $table + "  " + (Libelle-Fenetre $f) + "  hwnd " + $f.Hwnd)
    foreach ($e in [FenetresWin]::ListerEnfants([int64]$f.Hwnd)) {
      $q = $e -split "`t", 5
      $nomEnfant = if ($q[4]) { $q[4] } else { "(sans titre)" }
      $l.Add("        enfant : " + $nomEnfant + " [" + $q[3] + ", " + $q[1] + "x" + $q[2] + "]")
    }
  }
  $l.Add("")
  $l.Add("2b. Éléments d'interface à l'intérieur de ces fenêtres (UI Automation) ; motifs de table : " + ($MotifsTable -join " | ") + " ; motifs de début de partie : " + ($MotifsDepart -join " | "))
  if (Initialiser-Uia) {
    foreach ($f in $fenetresBetclic) {
      if ($f.Largeur -lt $TailleMinTable -or $f.Hauteur -lt $TailleMinTable) { continue }
      $chrono = [System.Diagnostics.Stopwatch]::StartNew()
      $tables = @(Elements-Tables $f.Hwnd)
      $l.Add("   Fenêtre " + (Libelle-Fenetre $f) + " : UIA " + $script:uiaElementsVus + " éléments, MSAA " + $script:msaaElementsVus + " nœuds, lus en " + $chrono.ElapsedMilliseconds + " ms ; " + $tables.Count + " correspondant à un motif :")
      foreach ($t in $tables) { $l.Add("      " + $t.Genre.ToUpper() + " : " + $t.Nom + " [" + $t.Type + ", " + $t.Classe + ", id " + $t.Cle + "]") }
      $l.Add("   Arbre UIA (type | classe | id | nom) :")
      Dump-Uia $f.Hwnd $l $TailleArbre $(if ($Rapide) { 5000 } else { 20000 })
      $l.Add("   Arbre MSAA (ce que l'application Flutter expose) — fenêtre et fenêtres enfants (profondeur | rôle | nom | valeur) :")
      $cibles = New-Object System.Collections.Generic.List[string]
      $cibles.Add($f.Hwnd)
      foreach ($e in [FenetresWin]::ListerEnfants([int64]$f.Hwnd)) { $cibles.Add(($e -split "`t", 5)[0]) }
      foreach ($cible in $cibles) {
        $noeuds = Msaa-Lister $cible $TailleArbre $(if ($Rapide) { 4000 } else { 15000 })
        $l.Add("     hwnd " + $cible + " : " + $noeuds.Count + " nœud(s)")
        $affiches = 0
        foreach ($nd in $noeuds) {
          if ($affiches -ge $TailleArbre) { $l.Add("     … (arrêt à $TailleArbre nœuds)"); break }
          if (-not $nd.Nom -and -not $nd.Valeur) { continue }
          $nomCourt = $nd.Nom
          if ($nomCourt.Length -gt 90) { $nomCourt = $nomCourt.Substring(0, 90) + "…" }
          $l.Add("     " + ("  " * [Math]::Min($nd.Profondeur, 20)) + $nd.Role + " | " + $nomCourt + $(if ($nd.Valeur) { " | " + $nd.Valeur } else { "" }))
          $affiches += 1
        }
      }
    }
  } else { $l.Add("   (UI Automation indisponible)") }
  $l.Add("   MSAA disponible : " + (Initialiser-Msaa))
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
  if ($Rapide) { $l.Add("   (passé en mode rapide ; -Diagnostic complet pour l'avoir)") }
  $racines = @()
  if (-not $Rapide) { $racines = @($env:APPDATA, $env:LOCALAPPDATA, $env:PROGRAMDATA, (Join-Path $env:USERPROFILE "Documents")) | Where-Object { $_ -and (Test-Path $_) } }
  $chronoDossiers = [System.Diagnostics.Stopwatch]::StartNew()
  foreach ($r in $racines) {
    if ($chronoDossiers.ElapsedMilliseconds -gt 25000) { $l.Add("   … (recherche arrêtée après 25 s)"); break }
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
  # Journal + diagnostic rapide → presse-papiers, et pour-claude.txt en secours (ouvert si la copie échoue).
  $fichier = Join-Path $Dossier "pour-claude.txt"
  $journal = ""
  $cheminJournal = Join-Path $Dossier "journal.log"
  if (Test-Path $cheminJournal) { $journal = (Get-Content -Path $cheminJournal -Encoding UTF8 | Select-Object -Last 150) -join "`r`n" }
  $diag = ""
  try { $diag = Diagnostic -Silencieux -TailleArbre 800 -Rapide } catch { $diag = "diagnostic impossible : " + $_.Exception.Message }
  $texte = "=== journal.log (dernières lignes) ===`r`n" + $journal + "`r`n`r`n=== diagnostic (rapide) ===`r`n" + $diag
  try { [System.IO.File]::WriteAllText($fichier, $texte, (New-Object System.Text.UTF8Encoding $true)) } catch {}
  $lignes = ($texte -split "`n").Count
  try {
    Set-Clipboard -Value $texte
    Journal ("Journal et diagnostic copiés dans le presse-papiers ($lignes lignes) ; aussi dans $fichier")
    return "Copié : $lignes lignes dans le presse-papiers.`n`nColle-les dans la conversation avec Ctrl+V.`nLe même texte est dans le fichier :`n$fichier"
  } catch {
    Journal ("Copie impossible (" + $_.Exception.Message + ") : texte dans $fichier")
    try { Start-Process notepad.exe $fichier } catch {}
    return "La copie dans le presse-papiers a échoué.`n`nLe texte est ouvert dans le Bloc-notes : Ctrl+A puis Ctrl+C, et colle-le dans la conversation.`n$fichier"
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
  comptees = @{}             # hwnd → moment où la fenêtre a été comptée comme partie
  tables = @{}               # hwnd → $true : fenêtres de table principales (lues à l'intérieur)
  jumelles = @{}             # hwnd → hwnd de la fenêtre principale (fenêtre doublon, ignorée)
  niveau1 = @{}              # hwnd → état de la lecture intérieure (niveau 1 affiché ?)
  passage = 0
  tablesVues = 0
  quitter = $false
  rangeParUtilisateur = $false   # HUD rangé par × ou Échap : on ne le réaffiche qu'à la demande
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

# ======================================================= détection des parties
# Une partie = une fenêtre de table qui apparaît avec un titre de partie (-MotifTable), ou une
# fenêtre existante dont le titre devient un titre de partie. En complément, lecture intérieure
# (MSAA, en arrière-plan) des fenêtres de partie : le niveau de blinds 1 (-MotifDepart) qui
# apparaît signale un nouveau départ dans une fenêtre réutilisée.
function Compter-Partie-Fenetre([string]$hwnd, [string]$origine) {
  $script:etat.tablesVues += 1
  $script:etat.comptees[$hwnd] = Get-Date
  Ajouter-Partie 1 $origine
  Remettre-Au-Dessus
}

# Une fenêtre de table peut recouvrir le HUD (les deux sont « toujours au-dessus ») : on le remonte,
# et on le réaffiche s'il a été caché par le programme (pas par l'utilisateur).
function Remettre-Au-Dessus {
  if (-not $window) { return }
  if ($window.IsVisible) {
    $window.Topmost = $false
    $window.Topmost = $true
  } elseif (-not $script:etat.rangeParUtilisateur) {
    Afficher-Hud
  }
}

$script:runspaceLecture = $null
$script:lectureEnCours = $null
$script:derniereLecture = [datetime]::MinValue

function Textes-Des-Lignes($lignes) {
  # Noms et valeurs non vides des nœuds MSAA, normalisés, sans doublon, dans l'ordre d'apparition.
  $vus = @{}
  $textes = New-Object System.Collections.Generic.List[string]
  foreach ($ligne in $lignes) {
    $p = $ligne -split "`t", 5
    foreach ($t in @($p[3], $p[4])) {
      if (-not $t) { continue }
      $n = ($t -replace "\s+", " ").Trim()
      if (-not $n -or $vus.ContainsKey($n)) { continue }
      $vus[$n] = $true
      $textes.Add($n)
    }
  }
  return $textes
}

function Texte-Present($textes, $motifs) {
  foreach ($n in $textes) { foreach ($m in $motifs) { if ($n -like $m) { return $true } } }
  return $false
}

function Traiter-Lecture($resultat) {
  # resultat : hwnd → lignes MSAA. Par fenêtre de table, deux lectures de référence (l'arbre
  # d'accessibilité se construit à la première), puis deux signaux de nouvelle partie dans une
  # fenêtre réutilisée :
  #   - le niveau de blinds 1 (-MotifDepart) apparaît, confirmé par la lecture suivante ;
  #   - le bouton de fin de partie (-MotifRejouer) était affiché et disparaît, la fenêtre restant ouverte.
  # Une fenêtre comptée par son titre il y a moins de -DelaiMemePartie secondes n'est pas recomptée.
  foreach ($h in @($resultat.Keys)) {
    $lignes = @($resultat[$h])
    $textes = Textes-Des-Lignes $lignes
    $niveau1 = Texte-Present $textes $MotifsDepart
    $rejouer = Texte-Present $textes $MotifsRejouer
    $titre = if ($script:etat.connues.ContainsKey($h)) { $script:etat.connues[$h] } else { "hwnd " + $h }
    if (-not $script:etat.niveau1.ContainsKey($h)) {
      $script:etat.niveau1[$h] = @{ present = $niveau1; candidat = $false; rejouer = $rejouer; lectures = 1; nbTextes = $textes.Count }
      $apercu = ($textes | Select-Object -First 80) -join " | "
      Journal ("Lecture intérieure de « " + $titre + " » (hwnd $h) : " + $lignes.Count + " nœud(s), " + $textes.Count + " texte(s), niveau 1 " + $(if ($niveau1) { "affiché" } else { "absent" }) + ", bouton rejouer " + $(if ($rejouer) { "affiché" } else { "absent" }) + " (référence). Textes : " + $apercu)
      continue
    }
    $e = $script:etat.niveau1[$h]
    $e.lectures += 1
    # les textes changent beaucoup : on note les nouveaux une fois par lecture, pour comprendre l'interface
    if ($textes.Count -ne $e.nbTextes -and $e.lectures -le 6) {
      Journal ("Textes de « " + $titre + " » : " + $textes.Count + " (" + (($textes | Select-Object -First 80) -join " | ") + ")")
      $e.nbTextes = $textes.Count
    }
    if ($e.lectures -le 2) { $e.present = $niveau1; $e.candidat = $false; $e.rejouer = $rejouer; continue }
    $recent = $script:etat.comptees[$h]
    $dejaComptee = $recent -and ((Get-Date) - $recent).TotalSeconds -lt $DelaiMemePartie
    # signal 1 : niveau 1 qui apparaît
    if ($niveau1 -and -not $e.present) {
      if ($e.candidat) {
        $e.present = $true
        $e.candidat = $false
        if ($dejaComptee) { Journal ("Niveau 1 affiché dans « " + $titre + " » : partie déjà comptée.") }
        else { Journal ("Nouvelle partie (niveau 1 affiché) dans « " + $titre + " »."); Compter-Partie-Fenetre $h "niveau 1"; $dejaComptee = $true }
      } else {
        $e.candidat = $true
      }
    } elseif (-not $niveau1) {
      $e.present = $false
      $e.candidat = $false
    }
    # signal 2 : bouton de fin de partie qui disparaît (la fenêtre est toujours là)
    if ($e.rejouer -and -not $rejouer) {
      if ($dejaComptee) { Journal ("Bouton rejouer disparu de « " + $titre + " » : partie déjà comptée.") }
      else { Journal ("Nouvelle partie (relance) dans « " + $titre + " »."); Compter-Partie-Fenetre $h "relance" }
    } elseif ($rejouer -and -not $e.rejouer) {
      Journal ("Fin de partie affichée dans « " + $titre + " ».")
    }
    $e.rejouer = $rejouer
  }
}

function Lecture-Interieure($fenetres) {
  # Lance (toutes les 12 s) une lecture MSAA des fenêtres de partie dans un espace d'exécution
  # séparé, et traite le résultat de la lecture précédente : le HUD ne gèle jamais.
  if (-not (Initialiser-Msaa)) { return }
  if ($script:lectureEnCours) {
    if (-not $script:lectureEnCours.handle.IsCompleted) { return }
    $resultat = $null
    try { $resultat = $script:lectureEnCours.ps.EndInvoke($script:lectureEnCours.handle) } catch { Journal ("Lecture intérieure : " + $_.Exception.Message) }
    try { $script:lectureEnCours.ps.Dispose() } catch {}
    $script:lectureEnCours = $null
    if ($resultat -and $resultat.Count -gt 0 -and $resultat[0]) { Traiter-Lecture $resultat[0] }
  }
  if (((Get-Date) - $script:derniereLecture).TotalSeconds -lt 12) { return }
  $cibles = @($fenetres | Where-Object { (Est-FenetreDePartie $_) -and -not $script:etat.jumelles.ContainsKey($_.Hwnd) } | ForEach-Object { $_.Hwnd })
  if ($cibles.Count -eq 0) { return }
  if (-not $script:runspaceLecture) {
    $script:runspaceLecture = [runspacefactory]::CreateRunspace()
    $script:runspaceLecture.ApartmentState = "MTA"
    $script:runspaceLecture.ThreadOptions = "ReuseThread"
    $script:runspaceLecture.Open()
  }
  $ps = [powershell]::Create()
  $ps.Runspace = $script:runspaceLecture
  [void]$ps.AddScript({
    param($hwnds, $max, $budget)
    $r = @{}
    foreach ($h in $hwnds) {
      $lignes = New-Object System.Collections.Generic.List[string]
      foreach ($l in [MsaaWin]::Lister([int64]$h, $max, $budget)) { $lignes.Add($l) }
      foreach ($e in [FenetresWin]::ListerEnfants([int64]$h)) {
        $he = ($e -split "`t", 5)[0]
        foreach ($l in [MsaaWin]::Lister([int64]$he, $max, $budget)) { $lignes.Add($l) }
      }
      $r[$h] = $lignes
    }
    return $r
  }).AddArgument($cibles).AddArgument(3000).AddArgument(700)
  $script:lectureEnCours = @{ ps = $ps; handle = $ps.BeginInvoke() }
  $script:derniereLecture = Get-Date
}

# ======================================================= fenêtre WPF
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

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
          <TextBlock x:Name="Marque" Text="EXPRESSO" Foreground="#FFD9FF5A" FontSize="11" FontWeight="Bold" VerticalAlignment="Center"/>
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
foreach ($nom in @("Fermer", "Reset", "Cadence", "Point", "Chrono", "Moins", "Plus", "Nombre", "Libelle", "Marque")) { $ctl[$nom] = $window.FindName($nom) }
$ctl.Marque.ToolTip = "HUD Expresso Trainer, version $Version (clic droit pour le menu)"
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

function Afficher-Hud([switch]$ParUtilisateur) {
  if ($ParUtilisateur) { $script:etat.rangeParUtilisateur = $false }
  if (-not $window.IsVisible) {
    $window.Show()
    Journal "HUD affiché."
  }
  $window.Topmost = $false
  $window.Topmost = $true
  Rafraichir
}

function Ranger-Hud {
  if ($Veille) {
    $script:etat.rangeParUtilisateur = $true
    $window.Hide()
    Journal "HUD rangé (× ou Échap) : double-clic sur l'icône de la zone de notification pour le rappeler."
  } else {
    Quitter
  }
}

function Quitter {
  $script:etat.quitter = $true
  Sauver-Session
  try { if ($tray) { $tray.Visible = $false; $tray.Dispose() } } catch {}
  try { if ($script:lectureEnCours) { $script:lectureEnCours.ps.Stop() } } catch {}
  try { if ($script:runspaceLecture) { $script:runspaceLecture.Close() } } catch {}
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
      $ctl.Cadence.Text = "copie…"
      $window.Dispatcher.Invoke([Action] {}, [System.Windows.Threading.DispatcherPriority]::Render)
      $resultat = ""
      try { $resultat = Copier-Pour-Claude } catch { $resultat = "Erreur : " + $_.Exception.Message } finally { $window.Cursor = $null; Rafraichir }
      [void][System.Windows.MessageBox]::Show($window, $resultat, "HUD Expresso Trainer")
    } },
  @{ texte = "Mettre à jour le HUD (dernière version)"; action = {
      try { Mettre-A-Jour; Journal "Mise à jour lancée : le HUD redémarre dans quelques secondes."; Quitter } catch { Journal ("Mise à jour impossible : " + $_.Exception.Message) }
    } },
  @{ texte = "Ouvrir le dossier (journal, sessions)"; action = { Start-Process $Dossier } },
  @{ texte = "Ouvrir Expresso Trainer (site)"; action = { Start-Process $UrlSite } },
  @{ texte = "Version $Version"; action = { [void][System.Windows.MessageBox]::Show($window, "HUD Expresso Trainer`nversion $Version`n`nDossier : $Dossier", "HUD Expresso Trainer") } },
  @{ texte = "Quitter le HUD"; action = { Quitter } }
)) {
  $item = New-Object System.Windows.Controls.MenuItem
  $item.Header = $entree.texte
  $item.Add_Click($entree.action)
  [void]$menu.Items.Add($item)
}
$window.ContextMenu = $menu

# ---- icône dans la zone de notification : le HUD se rappelle d'un double-clic, même rangé
function Creer-IconeLime {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 217, 255, 90))), 1, 1, 30, 30)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 0, 0))), 10, 10, 12, 12)
  $g.Dispose()
  return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$tray = $null
try {
  $tray = New-Object System.Windows.Forms.NotifyIcon
  $tray.Icon = Creer-IconeLime
  $tray.Text = "HUD Expresso Trainer : clic pour afficher"
  $menuTray = New-Object System.Windows.Forms.ContextMenuStrip
  [void]$menuTray.Items.Add("Afficher le HUD", $null, { Afficher-Hud -ParUtilisateur })
  [void]$menuTray.Items.Add("Terminer la session", $null, { Terminer-Session })
  [void]$menuTray.Items.Add("Remettre à zéro", $null, { Remettre-A-Zero })
  [void]$menuTray.Items.Add("Ouvrir le dossier (journal, sessions)", $null, { Start-Process $Dossier })
  [void]$menuTray.Items.Add("Version $Version", $null, { [void][System.Windows.MessageBox]::Show("HUD Expresso Trainer`nversion $Version`n`nDossier : $Dossier", "HUD Expresso Trainer") })
  [void]$menuTray.Items.Add("Quitter le HUD", $null, { Quitter })
  $tray.ContextMenuStrip = $menuTray
  $tray.add_MouseClick({ param($s, $e) if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Afficher-Hud -ParUtilisateur } })
  $tray.Visible = $true
} catch {
  Journal ("Icône de notification indisponible : " + $_.Exception.Message)
}
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
      Afficher-Hud -ParUtilisateur
    }
    $procs = Processus-Betclic
    if ($procs.Count -eq 0) {
      if ($script:etat.betclicVu) {
        $script:etat.betclicVu = $false
        $script:etat.connues = @{}
        $script:etat.niveau1 = @{}
        $script:etat.comptees = @{}
        $script:etat.tables = @{}
        $script:etat.jumelles = @{}
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
    $pids = Pids-Betclic $procs
    $nomsProc = @{}
    foreach ($p in $procs) { $nomsProc[[int]$p.Id] = $p.ProcessName.ToLower() }
    $fenetres = @(Lister-Fenetres | Where-Object { $pids.ContainsKey($_.ProcId) })
    # Les navigateurs intégrés (captcha, pages web) n'ouvrent jamais de table.
    $fenetres = @($fenetres | Where-Object { -not ($nomsProc.ContainsKey($_.ProcId) -and ($ProcessusSansTable -contains $nomsProc[$_.ProcId])) })
    $presentes = @{}
    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($f in $fenetres) {
      $presentes[$f.Hwnd] = $true
      if ($script:etat.connues.ContainsKey($f.Hwnd)) {
        $ancien = $script:etat.connues[$f.Hwnd]
        if ($ancien -ne $f.Titre) {
          $script:etat.connues[$f.Hwnd] = $f.Titre
          if ($script:etat.jumelles.ContainsKey($f.Hwnd)) {
            Journal ("Titre changé (fenêtre jumelle, ignorée) : « " + $ancien + " » → « " + $f.Titre + " »")
          } elseif (Est-TitrePartie $f.Titre) {
            Journal ("Nouvelle partie dans une fenêtre existante : « " + $ancien + " » → « " + $f.Titre + " »")
            $script:etat.tables[$f.Hwnd] = $true
            Compter-Partie-Fenetre $f.Hwnd "fenêtre renommée"
          } elseif ((Est-TitrePartie $ancien) -or $f.Largeur -ge $TailleMinTable) {
            Journal ("Titre changé : « " + $ancien + " » → « " + $f.Titre + " »")
          }
        }
        continue
      }
      $script:etat.connues[$f.Hwnd] = $f.Titre
      if (Est-FenetreDePartie $f) {
        $candidates.Add($f)
      } elseif (-not $premierPassage -and $f.Largeur -ge $TailleMinTable -and $f.Hauteur -ge $TailleMinTable) {
        Journal ("Nouvelle fenêtre, non comptée (titre hors -MotifTable) : " + (Libelle-Fenetre $f))
      } elseif ($premierPassage -and $f.Largeur -ge $TailleMinTable -and $f.Hauteur -ge $TailleMinTable) {
        Journal ("Fenêtre déjà ouverte, non comptée : " + (Libelle-Fenetre $f))
      }
    }
    if ($candidates.Count -gt 0) {
      $groupes = Regrouper-Jumelles $candidates $script:etat.tables
      foreach ($h in $groupes.jumelles.Keys) {
        $script:etat.jumelles[$h] = $groupes.jumelles[$h]
        $fj = $candidates | Where-Object { $_.Hwnd -eq $h } | Select-Object -First 1
        Journal ("Fenêtre jumelle d'une table, ignorée : " + (Libelle-Fenetre $fj) + " → principale " + $groupes.jumelles[$h])
      }
      foreach ($pfen in $groupes.principales) {
        $script:etat.tables[$pfen.Hwnd] = $true
        if ($premierPassage) {
          Journal ("Table déjà ouverte, non comptée : " + (Libelle-Fenetre $pfen))
        } else {
          Journal ("Table détectée : " + (Libelle-Fenetre $pfen))
          Compter-Partie-Fenetre $pfen.Hwnd "fenêtre"
        }
      }
    }
    foreach ($cle in @($script:etat.connues.Keys)) {
      if (-not $presentes.ContainsKey($cle)) {
        if ((Est-TitrePartie $script:etat.connues[$cle]) -and -not $script:etat.jumelles.ContainsKey($cle)) { Journal ("Fenêtre de table fermée : « " + $script:etat.connues[$cle] + " » (hwnd $cle)") }
        $script:etat.connues.Remove($cle)
        $script:etat.niveau1.Remove($cle)
        $script:etat.comptees.Remove($cle)
        $script:etat.tables.Remove($cle)
        $script:etat.jumelles.Remove($cle)
      }
    }
    if (-not $SansLectureInterieure) { Lecture-Interieure $fenetres }
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
$script:tic = 0
$timerHorloge.Add_Tick({
  if ($window.IsVisible) { Rafraichir }
  $script:tic += 1
  # toutes les 10 s : repasser au-dessus des fenêtres de table (elles aussi « toujours au-dessus »)
  if (($script:tic % 10 -eq 0) -and $script:etat.betclicVu -and $window.IsVisible) {
    $window.Topmost = $false
    $window.Topmost = $true
  }
})
$timerHorloge.Start()

$timerVeille = New-Object System.Windows.Threading.DispatcherTimer
$timerVeille.Interval = [TimeSpan]::FromSeconds(3)
$timerVeille.Add_Tick({ Passage-Veille })
$timerVeille.Start()

if ($Veille) {
  Journal ("Veille démarrée (version $Version) : processus '$Processus', titres de partie '" + ($MotifsTable -join " | ") + "', niveau 1 '" + ($MotifsDepart -join " | ") + "', rejouer '" + ($MotifsRejouer -join " | ") + "'" + $(if ($SansLectureInterieure) { ", sans lecture intérieure" } else { "" }) + $(if ($DossierHistoriques) { ", historiques $DossierHistoriques" } else { "" }) + ", dossier $Dossier")
  Passage-Veille
} else {
  Journal "HUD ouvert (version $Version)."
  Afficher-Hud
}
[System.Windows.Threading.Dispatcher]::Run()
