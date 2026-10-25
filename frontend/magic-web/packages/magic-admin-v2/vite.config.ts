import fs from "node:fs";
import type { ServerOptions as HttpsServerOptions } from "node:https";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function resolveProjectPath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, filePath);
}

function getDevHttpsConfig(env: Record<string, string | undefined>): HttpsServerOptions | undefined {
  const keyPath = env.DEV_HTTPS_KEY;
  const certPath = env.DEV_HTTPS_CERT;

  if (!keyPath && !certPath) {
    return undefined;
  }

  if (!keyPath || !certPath) {
    throw new Error("DEV_HTTPS_KEY and DEV_HTTPS_CERT must be set together.");
  }

  const resolvedKeyPath = resolveProjectPath(keyPath);
  const resolvedCertPath = resolveProjectPath(certPath);

  if (!fs.existsSync(resolvedKeyPath) || !fs.existsSync(resolvedCertPath)) {
    throw new Error(
      [
        "HTTPS dev certificate files were not found.",
        `DEV_HTTPS_KEY=${resolvedKeyPath}`,
        `DEV_HTTPS_CERT=${resolvedCertPath}`,
      ].join("\n"),
    );
  }

  return {
    key: fs.readFileSync(resolvedKeyPath),
    cert: fs.readFileSync(resolvedCertPath),
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, __dirname, ""), ...process.env };

  return {
    define: {
      __BUILD_EDITION__: JSON.stringify("opensource"),
      global: "globalThis",
    },
    plugins: [react()],
    optimizeDeps: {
      rolldownOptions: {
        transform: {
          define: {
            global: "globalThis",
          },
        },
      },
    },
    resolve: {
      dedupe: ["react", "react-dom", "react-router", "react-router-dom", "i18next", "react-i18next"],
      alias: {
        // Dialogs and filter panels reuse the host ScrollArea.
        "@": path.resolve(__dirname, "../../src"),
        "@magic-admin-v2": path.resolve(__dirname, "src"),
      },
    },
    server: {
      https: getDevHttpsConfig(env),
    },
  };
});
