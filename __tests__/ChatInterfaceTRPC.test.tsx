/**
 * ChatInterfaceTRPC Component Tests
 * Simplified test suite covering component rendering and basic interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Create mock functions that will be available globally
const mockSendMessage = jest.fn();
const mockGenerateImage = jest.fn();
const mockClearHistory = jest.fn();
const mockUseQuery = jest.fn();

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
    default: jest.fn(),
}));

// Mock the trpc client
jest.mock('../app/_trpc/client', () => ({
    trpc: {
        chatOperations: {
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
            getChatHistory: {
                useQuery: jest.fn(),
            },
        },
    },
}));

// Mock next/dynamic
jest.mock('next/dynamic', () => {
    return (fn: any) => {
        const Component = fn();
        return Component;
    };
});

// Mock react-markdown and syntax highlighter
jest.mock('react-markdown', () => {
    return function MockReactMarkdown({ children }: { children: string }) {
        return <div data-testid="markdown-content">{children}</div>;
    };
});

jest.mock('react-syntax-highlighter/dist/esm/prism', () => {
    return {
        Prism: function MockPrism({ children }: { children: string }) {
            return <pre data-testid="code-block">{children}</pre>;
        },
    };
});

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
    vscDarkPlus: {},
}));

// Import the component after mocks are set up
import ChatInterfaceTRPC from '../app/components/ChatInterfaceTRPC';

describe('ChatInterfaceTRPC Component', () => {
    let queryClient: QueryClient;
    const mockUserId = 'test-user-123';

    // Sample chat messages for testing
    const mockMessages = [
        {
            id: 1,
            content: 'Hello, how can I help you?',
            role: 'user' as const,
            content_type: 'text' as const,
            created_at: '2024-01-01T10:00:00Z',
            user_id: mockUserId,
        },
        {
            id: 2,
            content: 'I can help you with various tasks!',
            role: 'model' as const,
            content_type: 'text' as const,
            created_at: '2024-01-01T10:01:00Z',
            user_id: mockUserId,
        },
    ];

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
                mutations: {
                    retry: false,
                },
            },
        });

        // Reset all mocks
        jest.clearAllMocks();

        // Default mock for chat history query
        mockUseQuery.mockReturnValue({
            data: { messages: mockMessages },
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        });

        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn().mockImplementation(() => Promise.resolve()),
            },
        });

        // Mock window.confirm
        Object.assign(window, {
            confirm: jest.fn(),
        });
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <ChatInterfaceTRPC userId={mockUserId} userName="Test User" />
            </QueryClientProvider>
        );
    };

    describe('Component Rendering', () => {
        it('should render the chat interface with initial elements', () => {
            renderComponent();

            // Check for main chat container
            expect(screen.getByRole('main')).toBeInTheDocument();
            
            // Check for input textarea
            expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
            
            // Check for send button
            expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
        });

        it('should display loading state when chat history is loading', () => {
            mockUseQuery.mockReturnValue({
                data: null,
                isLoading: true,
                error: null,
                refetch: jest.fn(),
            });

            renderComponent();

            expect(screen.getByText(/loading chat history/i)).toBeInTheDocument();
        });

        it('should display error state when chat history fails to load', () => {
            mockUseQuery.mockReturnValue({
                data: null,
                isLoading: false,
                error: new Error('Failed to load'),
                refetch: jest.fn(),
            });

            renderComponent();

            expect(screen.getByText(/error loading chat history/i)).toBeInTheDocument();
        });

        it('should display empty state when no messages exist', () => {
            mockUseQuery.mockReturnValue({
                data: { messages: [] },
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            });

            renderComponent();

            expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
        });
    });

    describe('Chat History Rendering', () => {
        it('should render text messages correctly', () => {
            renderComponent();

            // Check for user message
            expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
            
            // Check for AI response
            expect(screen.getByText('I can help you with various tasks!')).toBeInTheDocument();
        });

        it('should display message timestamps', () => {
            renderComponent();

            // Check for formatted timestamps
            expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
        });

        it('should show copy button for AI text messages', () => {
            renderComponent();

            const copyButtons = screen.getAllByTitle('Copy message');
            expect(copyButtons.length).toBeGreaterThan(0);
        });
    });

    describe('User Input and Form Submission', () => {
        it('should update input value when user types', async () => {
            const user = userEvent.setup();
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);
            
            await user.type(textarea, 'Test message');
            
            expect(textarea).toHaveValue('Test message');
        });

        it('should send regular text message when form is submitted', async () => {
            const user = userEvent.setup();
            mockSendMessage.mockResolvedValue({ success: true });
            
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);
            const sendButton = screen.getByRole('button', { name: /send/i });

            await user.type(textarea, 'Hello AI!');
            await user.click(sendButton);

            expect(mockSendMessage).toHaveBeenCalledWith({
                message: 'Hello AI!',
                userId: mockUserId,
            });
        });

        it('should send message when Enter key is pressed', async () => {
            const user = userEvent.setup();
            mockSendMessage.mockResolvedValue({ success: true });
            
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);

            await user.type(textarea, 'Test message{enter}');

            expect(mockSendMessage).toHaveBeenCalledWith({
                message: 'Test message',
                userId: mockUserId,
            });
        });

        it('should not send empty messages', async () => {
            const user = userEvent.setup();
            renderComponent();

            const sendButton = screen.getByRole('button', { name: /send/i });

            await user.click(sendButton);

            expect(mockSendMessage).not.toHaveBeenCalled();
        });
    });

    describe('Image Generation', () => {
        it('should detect image command and show indicator', async () => {
            const user = userEvent.setup();
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);

            await user.type(textarea, '/image ');

            expect(screen.getByText(/image generation mode/i)).toBeInTheDocument();
        });

        it('should generate image when image command is submitted', async () => {
            const user = userEvent.setup();
            mockGenerateImage.mockResolvedValue({ success: true });
            
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);
            const sendButton = screen.getByRole('button', { name: /send/i });

            await user.type(textarea, '/image a beautiful sunset');
            await user.click(sendButton);

            expect(mockGenerateImage).toHaveBeenCalledWith({
                prompt: 'a beautiful sunset',
                userId: mockUserId,
            });
        });
    });

    describe('Chat History Management', () => {
        it('should show clear history button when messages exist', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /clear chat history/i })).toBeInTheDocument();
        });

        it('should clear chat history when confirmed', async () => {
            const user = userEvent.setup();
            (window.confirm as jest.Mock).mockReturnValue(true);
            
            renderComponent();

            const clearButton = screen.getByRole('button', { name: /clear chat history/i });
            await user.click(clearButton);

            expect(window.confirm).toHaveBeenCalledWith(
                'Are you sure you want to clear all chat history? This action cannot be undone.'
            );
            expect(mockClearHistory).toHaveBeenCalledWith({ userId: mockUserId });
        });

        it('should not clear chat history when cancelled', async () => {
            const user = userEvent.setup();
            (window.confirm as jest.Mock).mockReturnValue(false);
            
            renderComponent();

            const clearButton = screen.getByRole('button', { name: /clear chat history/i });
            await user.click(clearButton);

            expect(window.confirm).toHaveBeenCalled();
            expect(mockClearHistory).not.toHaveBeenCalled();
        });
    });

    describe('Copy Functionality', () => {
        it('should copy AI message to clipboard when copy button is clicked', async () => {
            const user = userEvent.setup();
            renderComponent();

            const copyButtons = screen.getAllByTitle('Copy message');
            await user.click(copyButtons[0]);

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'I can help you with various tasks!'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle message send errors gracefully', async () => {
            const user = userEvent.setup();
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            mockSendMessage.mockRejectedValue(new Error('Network error'));
            
            renderComponent();

            const textarea = screen.getByPlaceholderText(/type your message/i);
            const sendButton = screen.getByRole('button', { name: /send/i });

            await user.type(textarea, 'Test message');
            await user.click(sendButton);

            await waitFor(() => {
                expect(consoleError).toHaveBeenCalledWith(
                    'Error submitting message:',
                    expect.any(Error)
                );
            });

            consoleError.mockRestore();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels and roles', () => {
            renderComponent();

            // Check for main content area
            expect(screen.getByRole('main')).toBeInTheDocument();
            
            // Check for form elements
            expect(screen.getByRole('textbox')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
        });

        it('should have proper heading structure', () => {
            renderComponent();

            expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        });
    });
});
