import { auth0 } from '../lib/auth0';
import ChatInterfaceTRPC from './components/ChatInterfaceTRPC';
import Link from 'next/link';

export default async function Home() {
  let session;

  try {
    session = await auth0.getSession();
  } catch (error) {
    console.error('Auth session error:', error);
    session = null;
  }

  if (!session) {
    // User not authenticated - show login screen
    return (
      <div className="vh-100 bg-dark text-light d-flex flex-column">
        {/* Header with Login Button */}
        <div className="bg-dark border-bottom border-secondary p-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <div className="bg-primary rounded-circle p-2 me-3">
                <i className="bi bi-chat-dots text-white"></i>
              </div>
              <div>
                <h5 className="mb-0 text-light">AI Chat Assistant</h5>
                <small className="text-muted">Please login to continue</small>
              </div>
            </div>
            <Link href="/api/auth/login" className="btn btn-primary btn-sm">
              <i className="bi bi-box-arrow-in-right me-1"></i>
              Login
            </Link>
          </div>
        </div>

        {/* Disabled Chat Preview */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div className="text-center opacity-50">
            <div className="mb-4">
              <i className="bi bi-lock text-muted" style={{ fontSize: '3rem' }}></i>
            </div>
            <h5 className="text-muted mb-3">Chat interface locked</h5>
            <p className="text-muted">
              Please login to start chatting with the AI assistant
            </p>
            <div className="mt-4 p-3 bg-secondary bg-opacity-25 rounded">
              <small className="text-muted">
                Features available after login:
                <br />• Text conversations with AI
                <br />• Image generation with /image command
                <br />• Chat history saved across sessions
              </small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated - show full chat interface
  const userId = session.user.sub || 'anonymous';
  const userName = session.user.name || session.user.email || 'User';

  return (
    <div className="vh-100 bg-dark text-light">
      <ChatInterfaceTRPC
        userId={userId}
        userName={userName}
      />
    </div>
  );
}