import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "../node_modules/vite-plugin-pwa/dist/vite-build-BGK4YAIU.js");

try {
  const src = readFileSync(target, "utf-8");
  if (src.includes("inlineDynamicImports: true")) {
    const patched = src.replace("inlineDynamicImports: true", "codeSplitting: false");
    writeFileSync(target, patched, "utf-8");
    console.log("[postinstall] patched vite-plugin-pwa: inlineDynamicImports → codeSplitting");
  }
} catch {
  // plugin not installed yet (e.g. initial install after clone)
}
