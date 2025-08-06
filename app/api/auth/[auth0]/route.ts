import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ auth0: string }> }) {
    const { auth0: route } = await params;

    const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
    const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
    const APP_BASE_URL = process.env.APP_BASE_URL;

    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !APP_BASE_URL) {
        return NextResponse.json({ error: 'Missing Auth0 configuration' }, { status: 500 });
    }

    try {
        switch (route) {
            case 'login':
                // Redirect to Auth0 login
                return NextResponse.redirect(`https://${AUTH0_DOMAIN}/authorize?response_type=code&client_id=${AUTH0_CLIENT_ID}&redirect_uri=${encodeURIComponent(APP_BASE_URL + '/api/auth/callback')}&scope=openid%20profile%20email`);

            case 'logout':
                // Clear the session and redirect to Auth0 logout
                const response = NextResponse.redirect(`https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(APP_BASE_URL)}`);

                // Clear Auth0 session cookies
                response.cookies.delete('auth0.is.authenticated');
                response.cookies.delete('auth0.session');
                response.cookies.set('auth0.is.authenticated', '', {
                    expires: new Date(0),
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                });

                return response;

            case 'callback':
                // Handle Auth0 callback
                const url = new URL(request.url);
                const code = url.searchParams.get('code');

                if (!code) {
                    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
                }

                try {
                    // Exchange authorization code for tokens
                    const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            grant_type: 'authorization_code',
                            client_id: AUTH0_CLIENT_ID,
                            client_secret: process.env.AUTH0_CLIENT_SECRET,
                            code: code,
                            redirect_uri: `${APP_BASE_URL}/api/auth/callback`,
                        }),
                    });

                    if (!tokenResponse.ok) {
                        const errorText = await tokenResponse.text();
                        console.error('Token exchange failed:', errorText);
                        return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 });
                    }

                    const tokens = await tokenResponse.json();

                    // Get user info
                    const userResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                        },
                    });

                    if (!userResponse.ok) {
                        const errorText = await userResponse.text();
                        console.error('User info fetch failed:', errorText);
                        return NextResponse.json({ error: 'User info fetch failed' }, { status: 500 });
                    }

                    const user = await userResponse.json();

                    // Create session response
                    const response = NextResponse.redirect(APP_BASE_URL);

                    // Set session cookies
                    response.cookies.set('auth0.is.authenticated', 'true', {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 7, // 7 days
                        path: '/',
                    });

                    response.cookies.set('auth0.session', JSON.stringify({
                        user: user,
                        accessToken: tokens.access_token,
                        idToken: tokens.id_token,
                        expiresAt: Date.now() + (tokens.expires_in * 1000),
                    }), {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 7, // 7 days
                        path: '/',
                    });

                    return response;

                } catch (error) {
                    console.error('Callback processing error:', error);
                    return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 });
                }

            default:
                return NextResponse.json({ error: 'Invalid auth route' }, { status: 404 });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
    }
}
