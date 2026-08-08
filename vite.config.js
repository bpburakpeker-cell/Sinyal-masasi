import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Yerelde çalışırken /api isteklerini Vercel dev sunucusuna değil,
    // `vercel dev` kullanıyorsan otomatik olarak /api altındaki fonksiyonlara yönlendirir.
    port: 5173,
  },
});
