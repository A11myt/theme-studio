import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// fester Port + clearScreen aus: so kann später „tauri dev“ dieselbe Adresse nutzen.
// wallhaven erlaubt keine Browser-Anfragen von fremden Seiten (CORS) → der lokale Server leitet weiter.
const wallhaven = {
  "/wallhaven/api": { target: "https://wallhaven.cc", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/wallhaven\/api/, "/api/v1") },
  "/wallhaven/full": { target: "https://w.wallhaven.cc", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/wallhaven\/full/, "/full") },
};

export default defineConfig({
  // GitHub Pages liegt unter /theme-studio/ – sonst (App, lokal) an der Wurzel
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true, proxy: wallhaven },
  preview: { port: 4173, proxy: wallhaven },
});
