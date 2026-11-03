import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Ausgangsfarben exakt wie das System: ist matugen installiert, rechnet es (POST /api/source-colors, Bild im Body).
// Ohne matugen antwortet der Endpunkt 501 und der Browser rechnet selbst.
function matugenSources(): Plugin {
  return {
    name: "matugen-sources",
    configureServer(server) {
      server.middlewares.use("/api/source-colors", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (c: Buffer) => { size += c.length; if (size <= 80 * 1024 * 1024) chunks.push(c); });
        req.on("end", async () => {
          if (size > 80 * 1024 * 1024) { res.statusCode = 413; res.end(); return; }
          const dir = await mkdtemp(join(tmpdir(), "theme-studio-"));
          const file = join(dir, "bild");
          try {
            await writeFile(file, Buffer.concat(chunks));
            execFile("matugen", ["image", file, "--show-source-colors"], { timeout: 30000 }, (err, stdout) => {
              void rm(dir, { recursive: true, force: true });
              const colors = (stdout.match(/#[0-9a-fA-F]{6}/g) ?? []).map((c) => c.toLowerCase());
              if (err || !colors.length) { res.statusCode = 501; res.end(); return; }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ engine: "matugen", colors: colors.slice(0, 4) }));
            });
          } catch {
            void rm(dir, { recursive: true, force: true });
            res.statusCode = 500; res.end();
          }
        });
      });
    },
  };
}

// fester Port + clearScreen aus: so kann später „tauri dev“ dieselbe Adresse nutzen.
// wallhaven erlaubt keine Browser-Anfragen von fremden Seiten (CORS) → der lokale Server leitet weiter.
const wallhaven = {
  "/wallhaven/api": { target: "https://wallhaven.cc", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/wallhaven\/api/, "/api/v1") },
  "/wallhaven/full": { target: "https://w.wallhaven.cc", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/wallhaven\/full/, "/full") },
};

export default defineConfig({
  plugins: [react(), matugenSources()],
  clearScreen: false,
  server: { port: 5173, strictPort: true, proxy: wallhaven },
  preview: { port: 4173, proxy: wallhaven },
});
