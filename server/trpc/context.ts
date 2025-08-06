import { NextRequest } from 'next/server';
import { supabase } from '../../lib/supabaseClient';

// Define the context that will be available in all tRPC procedures
export interface Context {
  // User information from Auth0
  user?: {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  // Supabase client instance
  supabase: typeof supabase;
  // Request object for accessing headers, etc.
  req: NextRequest;
}

// Create context function that will be called for each request
export async function createContext({ req }: { req: NextRequest }): Promise<Context> {
  try {
    // For now, we'll use a simplified approach for authentication
    // In a real implementation, you'd extract the user from Auth0 session cookies

    // Check for user ID in headers (passed from client)
    const userId = req.headers.get('x-user-id');
    const userName = req.headers.get('x-user-name');
    const userEmail = req.headers.get('x-user-email');

    let user = undefined;
    if (userId) {
      user = {
        sub: userId,
        name: userName || undefined,
        email: userEmail || undefined,
      };
    }

    return {
      user,
      supabase,
      req,
    };
  } catch (error) {
    // If there's an error getting the session, return context without user
    console.warn('Failed to get session in tRPC context:', error);
    return {
      user: undefined,
      supabase,
      req,
    };
  }
}

// Helper type to infer the context type
export type CreateContextOptions = {
  req: NextRequest;
};