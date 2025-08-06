import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { NextRequest } from 'next/server';
import { appRouter } from '../../../../server/trpc/router';
import { createContext } from '../../../../server/trpc/context';

// Handle tRPC requests
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError: ({ error, path }) => {
      console.error(`❌ tRPC failed on ${path}:`, error);
    },
  });

// Export handlers for different HTTP methods
export { handler as GET, handler as POST };
