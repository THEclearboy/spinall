"""Lecture des tableaux 13x13 avec détection des cases mixtes (moitié gauche / moitié droite)."""
import sys, json
from PIL import Image
import numpy as np
from collections import Counter
from lire_tableaux import classer, nom_main, grilles, RANGS

def couleur_zone(a, x0, x1, y0, y1):
    pix = a[y0:y1, x0:x1].reshape(-1, 3)
    cnt = Counter(classer(p) for p in pix)
    for k in ("noir", "blanc", "?"): cnt.pop(k, None)
    if not cnt: return "?", 0
    cl, n = cnt.most_common(1)[0]
    return cl, n / max(1, sum(cnt.values()))

def lire(im, boite):
    x0, y0, x1, y1 = boite
    lc = (x1 - x0 + 1) / 13
    lh = (y1 - y0 + 1) / 13
    a = np.asarray(im)
    mains = {}
    doutes = []
    for l in range(13):
        for c in range(13):
            cx0 = x0 + c * lc; cy0 = y0 + l * lh
            yb0, yb1 = int(cy0 + lh * 0.55), int(cy0 + lh * 0.92)   # bas de la case (sans le texte)
            gauche, pg = couleur_zone(a, int(cx0 + lc * 0.08), int(cx0 + lc * 0.42), yb0, yb1)
            droite, pd = couleur_zone(a, int(cx0 + lc * 0.58), int(cx0 + lc * 0.92), yb0, yb1)
            m = nom_main(l, c)
            if gauche == droite:
                mains[m] = gauche
            else:
                mains[m] = f"{gauche}/{droite}"
            if pg < 0.9 or pd < 0.9 or gauche == "?" or droite == "?":
                doutes.append((m, mains[m], round(pg, 2), round(pd, 2)))
    return mains, doutes

def resume(mains):
    compte = Counter(mains.values())
    defaut = compte.most_common(1)[0][0]
    exceptions = {}
    for m, v in mains.items():
        if v != defaut: exceptions.setdefault(v, []).append(m)
    return defaut, exceptions, compte

SYM = {"allin": "A", "call": "c", "fold": ".", "raise": "r", "allin/call": "Ac", "allin/fold": "A.", "call/allin": "cA", "fold/allin": ".A", "?": "?"}

if __name__ == "__main__":
    for chemin in sys.argv[1:]:
        im = Image.open(chemin).convert("RGB")
        for i, boite in enumerate(grilles(im)):
            mains, doutes = lire(im, boite)
            defaut, exceptions, compte = resume(mains)
            print(f"\n=== {chemin} grille {i+1} {boite} — défaut {defaut} {dict(compte)}")
            print("exceptions :", json.dumps(exceptions, ensure_ascii=False))
            print("doutes :", doutes)
            for l in range(13):
                print("  " + " ".join(f"{SYM.get(mains[nom_main(l, c)], mains[nom_main(l, c)]):>2}" for c in range(13)) + "   " + RANGS[l])
