import { initTRPC } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';

/**
 * Criar contexto para cada requisição
 */
export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  return {
    req,
    res,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * Inicializar tRPC
 */
const t = initTRPC.context<Context>().create();

/**
 * Exportar helpers reutilizáveis
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
