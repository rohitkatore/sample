/**
 * Simple ChatInterface Component Test
 * Basic rendering test to verify the component structure
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
    default: jest.fn(),
}));

// Mock the trpc module completely
jest.mock('../app/_trpc/client', () => {
    return {
        trpc: {
            chatOperations: {
                getChatHistory: {
                    useQuery: jest.fn(() => ({
                        data: { messages: [] },
                        isLoading: false,
                        error: null,
                        refetch: jest.fn(),
                    })),
                },
                sendMessage: {
                    useMutation: jest.fn(() => ({
                        mutateAsync: jest.fn(),
                        isPending: false,
                        error: null,
                    })),
                },
                generateImage: {
                    useMutation: jest.fn(() => ({
                        mutateAsync: jest.fn(),
                        isPending: false,
                        error: null,
                    })),
                },
                clearHistory: {
                    useMutation: jest.fn(() => ({
                        mutate: jest.fn(),
                        isPending: false,
                        error: null,
                    })),
                },
            },
        },
    };
});

// Mock react-markdown and syntax highlighter
jest.mock('react-markdown', () => {
    return function MockReactMarkdown({ children }: { children: string }) {
        return <div>{children}</div>;
    };
});

jest.mock('react-syntax-highlighter/dist/esm/prism', () => {
    return {
        Prism: function MockPrism({ children }: { children: string }) {
            return <pre>{children}</pre>;
        },
    };
});

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
    vscDarkPlus: {},
}));

// Import component after mocks
import ChatInterfaceTRPC from '../app/components/ChatInterfaceTRPC';

describe('ChatInterfaceTRPC Basic Tests', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        jest.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <ChatInterfaceTRPC userId="test-user" userName="Test User" />
            </QueryClientProvider>
        );
    };

    it('should render the chat interface', () => {
        renderComponent();

        // Check that the component renders without crashing - look for the main container
        expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });

    it('should render empty state message', () => {
        renderComponent();

        // Should show welcome message for empty state
        expect(screen.getByText('Welcome to AI Chat!')).toBeInTheDocument();
    });

    it('should render input form', () => {
        renderComponent();

        // Check for input elements
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
        // The send button doesn't have text, just an icon, so check by class or role
        expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
    });

    it('should render chat title', () => {
        renderComponent();

        // Check for any heading (h4, h5, h6 are all present)
        expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });
});
