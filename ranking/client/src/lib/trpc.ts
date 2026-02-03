import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/routers/index';

/**
 * Cliente tRPC tipado
 */
export const trpc = createTRPCReact<AppRouter>();
