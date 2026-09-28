"""Lit des tableaux de ranges 13x13 depuis une image : détecte les grilles (zones
colorées bordées de noir), échantillonne la couleur médiane de chaque case et la
classe en allin (rouge) / call (vert) / fold (bleu) / raise (orange, jaune)."""
import sys, json
from PIL import Image
import numpy as np

RANGS = "AKQJT98765432"

def nom_main(l, c):
    if l == c: return RANGS[l] * 2
    return RANGS[l] + RANGS[c] + "s" if l < c else RANGS[c] + RANGS[l] + "o"

def classer(rgb):
    r, g, b = [int(x) for x in rgb]
    mx = max(r, g, b)
    if mx < 60: return "noir"
    if r > 200 and g > 200 and b > 200: return "blanc"
    if r > g + 40 and r > b + 40 and g < 140: return "allin"      # rouge
    if g > r + 20 and g > b + 20: return "call"                    # vert
    if b > r + 30 and b > g + 10: return "fold"                    # bleu
    if r > 180 and g > 120 and b < 120: return "raise"             # orange / jaune
    return "?"

def grilles(im):
    """Trouve les rectangles colorés (rouge/vert/bleu/orange) séparés horizontalement."""
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    colore = ((abs(r - g) > 40) | (abs(g - b) > 40) | (abs(r - b) > 40)) & (a.max(axis=2) > 80)
    cols = colore.sum(axis=0) > 20
    zones = []
    x = 0
    while x < len(cols):
        if cols[x]:
            x0 = x
            while x < len(cols) and cols[x]: x += 1
            if x - x0 > 100: zones.append((x0, x - 1))
        else:
            x += 1
    boites = []
    for x0, x1 in zones:
        lignes = colore[:, x0:x1 + 1].sum(axis=1) > 20
        ys = np.where(lignes)[0]
        boites.append((x0, int(ys.min()), x1, int(ys.max())))
    return boites

def lire(im, boite):
    x0, y0, x1, y1 = boite
    lc = (x1 - x0 + 1) / 13
    lh = (y1 - y0 + 1) / 13
    a = np.asarray(im)
    mains = {}
    doutes = []
    for l in range(13):
        for c in range(13):
            cx0 = int(x0 + c * lc); cy0 = int(y0 + l * lh)
            # zone centrale de la case, en évitant le texte (en haut à gauche)
            zone = a[int(cy0 + lh * 0.45):int(cy0 + lh * 0.9), int(cx0 + lc * 0.35):int(cx0 + lc * 0.9)]
            pix = zone.reshape(-1, 3)
            med = np.median(pix, axis=0)
            cl = classer(med)
            # part des pixels de la classe majoritaire (détecte les cases mixtes)
            classes = [classer(p) for p in pix[::7]]
            part = classes.count(cl) / len(classes)
            m = nom_main(l, c)
            mains[m] = cl
            if cl in ("?", "noir", "blanc") or part < 0.8:
                doutes.append((m, cl, [int(v) for v in med], round(part, 2)))
    return mains, doutes

if __name__ == "__main__":
    im = Image.open(sys.argv[1]).convert("RGB")
    boites = grilles(im)
    print("grilles détectées :", boites)
    for i, boite in enumerate(boites):
        mains, doutes = lire(im, boite)
        compte = {}
        for v in mains.values(): compte[v] = compte.get(v, 0) + 1
        defaut = max(compte, key=compte.get)
        exceptions = {}
        for m, v in mains.items():
            if v != defaut: exceptions.setdefault(v, []).append(m)
        print(f"\n=== grille {i+1} — {boite} — défaut : {defaut} {compte}")
        print("exceptions :", json.dumps(exceptions, ensure_ascii=False))
        print("doutes :", doutes)
        # rendu texte de la grille
        sym = {"allin": "A", "call": "c", "fold": ".", "raise": "r", "?": "?", "noir": "#", "blanc": "_"}
        for l in range(13):
            print("  " + " ".join(sym[mains[nom_main(l, c)]] for c in range(13)) + "   " + RANGS[l])
        json.dump({"defaut": defaut, "exceptions": exceptions, "mains": mains}, open(f"grille{i+1}.json", "w"), ensure_ascii=False, indent=1)
