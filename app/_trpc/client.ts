'use client';

import { createTRPCReact } from '@trpc/react-query';
import { AppRouter } from '../../server/trpc/router';

// Export the tRPC React hooks for use in components
export const trpc = createTRPCReact<AppRouter>();
