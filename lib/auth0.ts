import { cookies } from 'next/headers';

export const auth0 = {
    async getSession() {
        try {
            const cookieStore = await cookies();
            const isAuthenticated = cookieStore.get('auth0.is.authenticated');
            const sessionCookie = cookieStore.get('auth0.session');

            if (!isAuthenticated || !sessionCookie || isAuthenticated.value !== 'true') {
                return null;
            }

            const session = JSON.parse(sessionCookie.value);

            // Check if session is expired
            if (session.expiresAt && Date.now() > session.expiresAt) {
                return null;
            }

            return session;
        } catch (error) {
            console.error('Session retrieval error:', error);
            return null;
        }
    }
};
