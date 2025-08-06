import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { Context } from './context';
import { chatRouter } from './routers/chat';

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Create the main app router
export const appRouter = t.router({
  // Health check endpoint
  health: t.procedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Chat-related procedures (renamed to avoid conflicts)
  chatOperations: chatRouter,

  // User procedures (simplified for now)
  user: t.router({
    profile: t.procedure.query(({ ctx }) => {
      return {
        user: ctx.user || null,
        authenticated: !!ctx.user,
      };
    }),
  }),
});

// Export the router type for use in client
export type AppRouter = typeof appRouter;
