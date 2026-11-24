// @lovable.dev/vite-tanstack-config já inclui os plugins abaixo — NÃO os adicione
// manualmente para evitar conflitos por duplicação:
//   - TanStack devtools (apenas dev), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (por padrão com alvo Cloudflare no build), injeção de VITE_*, alias @,
//     deduplicação React/TanStack, plugins de log de erro e detecção de sandbox.
// Nunca defina ssr.external ou resolve.external (o Worker não resolve módulos em runtime)
// nem adicione compressão manual, pois a borda de hospedagem já comprime as respostas.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Direciona a entrada de servidor do TanStack Start para src/server.ts (nosso wrapper SSR de erros).
    server: { entry: "server" },
  },
});
