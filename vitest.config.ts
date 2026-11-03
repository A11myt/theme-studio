import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // material-color-utilities importiert intern ohne Dateiendung – Node lehnt das ab, Vite gleicht es aus
    server: { deps: { inline: ["@material/material-color-utilities"] } },
  },
});
