import { readdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "../node_modules/vite-plugin-pwa/dist");

try {
  for (const file of readdirSync(dist)) {
    if (!file.startsWith("vite-build-") || !file.endsWith(".js")) continue;
    const target = resolve(dist, file);
    const src = readFileSync(target, "utf-8");
    if (!src.includes("inlineDynamicImports: true")) continue;
    const patched = src.replace("inlineDynamicImports: true", "codeSplitting: false");
    writeFileSync(target, patched, "utf-8");
    console.log(`[postinstall] patched ${file}: inlineDynamicImports → codeSplitting`);
  }
} catch {
  // plugin not installed yet (e.g. initial install after clone)
}
