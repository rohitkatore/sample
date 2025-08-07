'use client';

import { useState, useEffect, useRef } from 'react';
import { trpc } from '../_trpc/client';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import Image from 'next/image';

// Add interface for message type
interface Message {
    id: string;
    content: string;
    role: 'user' | 'model';
    created_at: string;
    user_id: string;
    content_type: 'text' | 'image';
}

interface ChatInterfaceProps {
    userId: string;
    userName: string;
}

export default function ChatInterfaceTRPC({ userId, userName }: ChatInterfaceProps) {
    const [newMessage, setNewMessage] = useState('');
    const [isImageCommand, setIsImageCommand] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // tRPC queries and mutations using new enhanced procedures
    const {
        data: chatData,
        isLoading,
        error,
        refetch: refetchMessages
    } = trpc.chatOperations.getChatHistory.useQuery({ userId });

    const sendMessageMutation = trpc.chatOperations.sendMessage.useMutation({
        onSuccess: (data: any) => {
            // Refetch messages after sending
            refetchMessages();
            setNewMessage('');
            setIsImageCommand(false);
            setIsTyping(false);
            toast.success('Message sent successfully!');
            console.log('AI Response:', data.aiResponse);
        },
        onError: (error: any) => {
            console.error('Failed to send message:', error);
            setIsTyping(false);
            toast.error(`Failed to send message: ${error.message}`);
        }
    });

    const generateImageMutation = trpc.chatOperations.generateImage.useMutation({
        onSuccess: (data) => {
            console.log('Image generated successfully:', data);
            refetchMessages();
            setNewMessage('');
            setIsImageCommand(false);
            setIsTyping(false);
            toast.success('Image generated successfully!');
        },
        onError: (error) => {
            console.error('Failed to generate image:', error);
            setIsTyping(false);
            toast.error(`Failed to generate image: ${error.message}`);
        }
    });

    const clearHistoryMutation = trpc.chatOperations.clearHistory.useMutation({
        onSuccess: () => {
            // Refetch messages after clearing
            refetchMessages();
            toast.success('Chat history cleared successfully!');
        },
        onError: (error: any) => {
            console.error('Failed to clear history:', error);
            toast.error(`Failed to clear chat history: ${error.message}`);
        }
    });

    const messages = chatData?.messages || [];

    // Auto-scroll to latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    // Check if message starts with /image command
    useEffect(() => {
        const isImageCmd = newMessage.trim().toLowerCase().startsWith('/image');
        setIsImageCommand(isImageCmd);
    }, [newMessage]);

    // Check if user is trying to create images without /image command
    const isLikelyImageRequest = !isImageCommand && newMessage.trim().toLowerCase().match(/(create|generate|make|draw).*image|picture|photo|drawing/);

    // Enhanced logout function with client-side cleanup
    const handleLogout = () => {
        // Show loading toast
        toast.loading('Signing out...', { id: 'logout' });

        // Clear any local state if needed
        setNewMessage('');
        setIsTyping(false);
        setIsStreaming(false);
        setStreamingMessage('');

        // Redirect to logout endpoint
        window.location.href = '/api/auth/logout';
    };

    // Copy to clipboard function
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success('Copied to clipboard!');
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        // If user seems to want an image but didn't use /image command, suggest it
        if (isLikelyImageRequest) {
            const shouldUseImageCommand = window.confirm(
                `It looks like you want to generate an image! 🎨\n\nTo create images, please start your message with "/image".\n\nWould you like me to convert this to an image generation command?`
            );

            if (shouldUseImageCommand) {
                setNewMessage(`/image ${newMessage.trim()}`);
                return;
            }
        }

        setIsTyping(true);

        try {
            if (isImageCommand) {
                // Extract prompt after /image command
                const prompt = newMessage.trim().slice(6).trim(); // Remove '/image' prefix

                if (!prompt) {
                    toast.error('Please provide a prompt after /image command. Example: /image a cat on the moon');
                    setIsTyping(false);
                    return;
                }

                await generateImageMutation.mutateAsync({
                    prompt,
                    userId
                });
            } else {
                // Send regular text message with streaming (fallback to regular if streaming not available)
                await sendMessageMutation.mutateAsync({
                    message: newMessage.trim(),
                    userId
                });
            }
        } catch (error) {
            console.error('Error submitting message:', error);
            setIsTyping(false);
        }
    };

    const clearHistory = () => {
        if (window.confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
            clearHistoryMutation.mutate({ userId });
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Markdown components with syntax highlighting
    const markdownComponents = {
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
    };

    // Typing indicator component
    const TypingIndicator = () => (
        <div className="message-bubble ai-bubble mb-3 d-flex align-items-center" data-testid="typing-indicator">
            <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span className="ms-2 text-muted">AI is thinking...</span>
        </div>
    );

    if (error) {
        return (
            <div className="container-fluid h-100 d-flex align-items-center justify-content-center">
                <div className="alert alert-danger" role="alert">
                    <h4 className="alert-heading">Error Loading Chat</h4>
                    <p>{error.message}</p>
                    <button
                        className="btn btn-outline-danger"
                        onClick={() => refetchMessages()}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="vh-100 d-flex flex-column bg-dark text-light">
            {/* Mobile-First Header with Logout */}
            <div className="bg-dark border-bottom border-secondary p-3">
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                        <div className="bg-primary rounded-circle p-2 me-3">
                            <i className="bi bi-chat-dots text-white"></i>
                        </div>
                        <div>
                            <h5 className="mb-0 text-light">sample</h5>
                            <small className="text-muted">Welcome, {userName}!</small>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="btn btn-outline-light btn-sm"
                        type="button"
                    >
                        <i className="bi bi-box-arrow-right me-1"></i>
                        Logout
                    </button>
                </div>
            </div>

            {/* Messages Area - Mobile Optimized */}
            <div className="flex-grow-1 overflow-auto p-3" style={{ minHeight: 0 }}>
                {isLoading ? (
                    <div className="h-100 d-flex align-items-center justify-content-center">
                        <div className="text-center">
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="text-muted">Loading your chat history...</p>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-100 d-flex align-items-center justify-content-center">
                        <div className="text-center">
                            <div className="bg-primary rounded-circle p-4 mx-auto mb-3" style={{ width: '80px', height: '80px' }}>
                                <i className="bi bi-chat-heart text-white" style={{ fontSize: '2rem' }}></i>
                            </div>
                            <h4 className="text-light mb-2">Welcome to AI Chat!</h4>
                            <p className="text-muted mb-4">Start a conversation by typing a message below.</p>
                            <div className="text-start bg-dark-subtle p-3 rounded mb-3">
                                <h6 className="text-primary mb-2">💡 Pro Tips:</h6>
                                <ul className="list-unstyled text-muted small">
                                    <li className="mb-1">• Type <code>/image</code> to generate images</li>
                                    <li className="mb-1">• Ask questions, get explanations, or have casual conversations</li>
                                    <li className="mb-1">• Use markdown formatting for better messages</li>
                                    <li>• Click copy buttons to save AI responses</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="messages-container">
                        {messages.map((message: Message) => (
                            <div
                                key={message.id}
                                className={`message-bubble ${message.role === 'user' ? 'user-bubble' : 'ai-bubble'} mb-3`}
                            >
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1">
                                        {message.content_type === 'image' ? (
                                            <div>
                                                <div className="position-relative">
                                                    <img
                                                        src={message.content}
                                                        alt="Generated Image"
                                                        className="img-fluid rounded mb-2"
                                                        style={{ 
                                                            maxWidth: '100%', 
                                                            maxHeight: '400px', 
                                                            objectFit: 'contain',
                                                            backgroundColor: '#f8f9fa'
                                                        }}
                                                        onError={(e) => {
                                                            console.error('Image failed to load:', message.content);
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = 'none';
                                                            const errorDiv = target.nextElementSibling as HTMLDivElement;
                                                            if (errorDiv) errorDiv.style.display = 'block';
                                                        }}
                                                        onLoad={() => {
                                                            console.log('Image loaded successfully:', message.content);
                                                        }}
                                                        crossOrigin="anonymous"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    {/* Error fallback */}
                                                    <div 
                                                        className="alert alert-warning mb-2" 
                                                        style={{ display: 'none' }}
                                                    >
                                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                                        Image failed to load. 
                                                        <a 
                                                            href={message.content} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="alert-link"
                                                        >
                                                            Click here to view
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button
                                                        className="btn btn-outline-secondary btn-sm"
                                                        onClick={() => copyToClipboard(message.content)}
                                                        title="Copy image URL"
                                                    >
                                                        <i className="bi bi-link-45deg"></i>
                                                    </button>
                                                    <a
                                                        href={message.content}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline-primary btn-sm"
                                                        title="Open in new tab"
                                                    >
                                                        <i className="bi bi-arrow-up-right-square"></i>
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {message.role === 'model' ? (
                                                    <ReactMarkdown
                                                        components={markdownComponents}
                                                    >
                                                        {message.content}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <p className="mb-0">{message.content}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Copy button for AI messages */}
                                    {message.role === 'model' && message.content_type === 'text' && (
                                        <button
                                            className="btn btn-outline-secondary btn-sm ms-2 flex-shrink-0"
                                            onClick={() => copyToClipboard(message.content)}
                                            title="Copy message"
                                        >
                                            <i className="bi bi-clipboard"></i>
                                        </button>
                                    )}
                                </div>

                                <div className="message-time text-muted small mt-1">
                                    {new Date(message.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))}

                        {/* Show typing indicator when AI is responding */}
                        {isTyping && <TypingIndicator />}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area - Mobile Optimized */}
            <div className="bg-dark border-top border-secondary p-3">
                {/* Image Command Indicator */}
                {isImageCommand && (
                    <div className="alert alert-info py-2 mb-2" role="alert">
                        <i className="bi bi-image me-2"></i>
                        <strong>Image Generation Mode</strong> - Describe the image you want to create
                    </div>
                )}

                {/* Clear History Button */}
                {messages.length > 0 && (
                    <div className="d-flex justify-content-center mb-3">
                        <button
                            className="btn btn-outline-warning btn-sm"
                            onClick={clearHistory}
                            disabled={clearHistoryMutation.isPending}
                        >
                            {clearHistoryMutation.isPending ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Clearing...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-trash me-1"></i>
                                    Clear Chat History
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Message Input */}
                <div className="d-flex gap-2">
                    <div className="flex-grow-1">
                        <textarea
                            className="form-control bg-dark text-light border-secondary"
                            placeholder={isImageCommand ? "Describe the image you want to create..." : "Type your message here..."}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            rows={2}
                            disabled={sendMessageMutation.isPending || generateImageMutation.isPending || isTyping}
                            style={{
                                resize: 'none',
                                borderColor: isImageCommand ? '#0d6efd' : '#6c757d'
                            }}
                        />
                    </div>
                    <button
                        className={`btn ${isImageCommand ? 'btn-primary' : 'btn-outline-primary'} d-flex align-items-center justify-content-center`}
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending || generateImageMutation.isPending || isTyping}
                        style={{ height: '60px', minWidth: '60px' }}
                    >
                        {sendMessageMutation.isPending || generateImageMutation.isPending || isTyping ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        ) : isImageCommand ? (
                            <i className="bi bi-image"></i>
                        ) : (
                            <i className="bi bi-send"></i>
                        )}
                    </button>
                </div>

                {/* Helper Text */}
                <div className="text-muted small mt-2 text-center">
                    {isImageCommand ? (
                        "🎨 Type your image description and press Send to generate an image"
                    ) : isLikelyImageRequest ? (
                        "💡 Tip: Use '/image' prefix to generate images instead of text"
                    ) : (
                        "Press Enter to send, Shift+Enter for new line"
                    )}
                </div>
            </div>

            <style jsx>{`
                .message-bubble {
                    padding: 12px 16px;
                    border-radius: 18px;
                    max-width: 85%;
                    word-wrap: break-word;
                }

                .user-bubble {
                    background: linear-gradient(135deg, #007bff, #0056b3);
                    color: white;
                    margin-left: auto;
                    margin-right: 0;
                }

                .ai-bubble {
                    background: #343a40;
                    color: #f8f9fa;
                    border: 1px solid #495057;
                    margin-left: 0;
                    margin-right: auto;
                }

                .markdown-content {
                    line-height: 1.6;
                }

                .markdown-content p:last-child {
                    margin-bottom: 0;
                }

                .markdown-content code {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }

                .typing-indicator {
                    display: flex;
                    gap: 4px;
                }

                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #6c757d;
                    animation: typing 1.4s infinite ease-in-out;
                }

                .typing-indicator span:nth-child(1) {
                    animation-delay: -0.32s;
                }

                .typing-indicator span:nth-child(2) {
                    animation-delay: -0.16s;
                }

                @keyframes typing {
                    0%, 80%, 100% {
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @media (max-width: 576px) {
                    .message-bubble {
                        max-width: 95%;
                        padding: 10px 12px;
                    }
                }
            `}</style>
        </div>
    );
}
