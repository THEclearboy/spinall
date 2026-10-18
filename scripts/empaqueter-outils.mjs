// Empaquette outils/windows en public/hud-betclic.zip (servi par GitHub Pages),
// lancé avant `vite build`. Le zip n'est pas versionné.
import { zipSync } from "fflate";
import fs from "node:fs";
import path from "node:path";

const source = "outils/windows";
const fichiers = {};
for (const nom of fs.readdirSync(source).sort()) fichiers[`hud-betclic/${nom}`] = new Uint8Array(fs.readFileSync(path.join(source, nom)));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/hud-betclic.zip", zipSync(fichiers, { level: 6 }));
console.log(`public/hud-betclic.zip : ${Object.keys(fichiers).length} fichiers`);
