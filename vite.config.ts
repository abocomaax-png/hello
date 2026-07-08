import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Plain Vite config — no Lovable-specific wrapper. Builds a standard
// TanStack Start SSR app. Nitro is set to the "vercel" preset so
// `vercel deploy` / a Vercel Git import picks it up automatically.
// To deploy elsewhere (Cloudflare, Netlify, Node, static), just change
// the `preset` value below — see https://nitro.build/deploy for the list.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    nitro({
      preset: "vercel",
    }),
  ],
});
