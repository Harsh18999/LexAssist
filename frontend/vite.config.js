import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Switch to "http://127.0.0.1:8000" when running the local backend
        target: "https://lex-assist-4cenvys6t-harshs-projects-9878f077.vercel.app",
        // target: "http://127.0.0.1:8000",
        changeOrigin: true,
        // Required for SSE streaming — disable proxy buffering
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // If the backend signals SSE / event-stream, ensure no buffering
            const ct = proxyRes.headers["content-type"] || "";
            if (ct.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  },
});
