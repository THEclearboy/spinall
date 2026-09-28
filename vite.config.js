import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Le build produit UN SEUL fichier dist/index.html (JS, CSS et police
// intégrés) : c'est ce fichier qui est publié comme artifact Claude
// (https://claude.ai/artifact/F5uGStopTKN3Dy1yEKEx5b) et ouvert par le hub
// "Mes apps" en page directe.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
