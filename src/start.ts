import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// O TanStack Start ativa CSRF automaticamente quando src/start.ts não existe; ao criar
// este arquivo precisamos redeclarar o middleware para manter a proteção contra requisições cross-site.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// requestMiddleware roda em toda requisição HTTP; functionMiddleware apenas em server functions,
// onde o sendContext enviado pelo cliente não é confiável. Sempre acrescente aos arrays em vez de substituí-los.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
