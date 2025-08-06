import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from '../context';
import { ChatMessage, chatHistoryService } from '../../../lib/supabaseClient';
import { generateGeminiResponse, generateGeminiStreamResponse, generateGeminiImage, sanitizeUserInput } from '../../../lib/geminiService';

// Initialize tRPC with the context
const t = initTRPC.context<Context>().create();

// Create reusable middleware for authentication
const isAuthenticated = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to access this resource',
        });
    }
    return next({
        ctx: {
            ...ctx,
            user: ctx.user, // user is now guaranteed to be defined
        },
    });
});

// Create protected procedure
const protectedProcedure = t.procedure.use(isAuthenticated);

// Define input schemas using Zod
const sendMessageInput = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

const generateImageInput = z.object({
    prompt: z.string().min(1, 'Prompt cannot be empty').max(1000, 'Prompt too long'),
    userId: z.string().min(1, 'User ID is required'),
});

// Chat router with enhanced functionality
export const chatRouter = t.router({
    /**
     * Get chat history for a user (temporarily public for testing)
     */
    getChatHistory: t.procedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ input }) => {
            try {
                const messages = await chatHistoryService.getMessagesForUser(input.userId);

                return {
                    success: true,
                    messages,
                    count: messages.length,
                };
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch chat history',
                });
            }
        }),

    /**
     * Send a message and get AI response (temporarily public for testing)
     */
    sendMessage: t.procedure
        .input(z.object({
            message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
            userId: z.string(),
        }))
        .mutation(async ({ input }) => {
            const userId = input.userId;
            const sanitizedMessage = sanitizeUserInput(input.message);

            try {
                // Step 1: Save user message to database
                const userMessage = await chatHistoryService.addMessage({
                    user_id: userId,
                    role: 'user',
                    content: sanitizedMessage,
                    content_type: 'text',
                });

                // Step 2: Get AI response from Gemini
                const geminiResponse = await generateGeminiResponse(sanitizedMessage);

                // Step 3: Save AI response to database
                const aiMessage = await chatHistoryService.addMessage({
                    user_id: userId,
                    role: 'model',
                    content: geminiResponse.response,
                    content_type: 'text',
                });

                // Step 4: Return both messages and AI response
                return {
                    success: true,
                    userMessage,
                    aiMessage,
                    aiResponse: geminiResponse.response,
                    geminiSuccess: geminiResponse.success,
                    geminiError: geminiResponse.error,
                };

            } catch (error) {
                console.error('Failed to process message:', error);

                // If we got this far, try to save an error message for the user
                try {
                    await chatHistoryService.addMessage({
                        user_id: userId,
                        role: 'model',
                        content: 'I apologize, but I encountered an error processing your message. Please try again.',
                        content_type: 'text',
                    });
                } catch (dbError) {
                    console.error('Failed to save error message:', dbError);
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to process your message',
                });
            }
        }),

    /**
     * Send a message and get streaming AI response
     */
    sendMessageStream: t.procedure
        .input(z.object({
            message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
            userId: z.string(),
        }))
        .subscription(async function* ({ input }) {
            const userId = input.userId;
            const sanitizedMessage = sanitizeUserInput(input.message);

            try {
                // Step 1: Save user message to database
                const userMessage = await chatHistoryService.addMessage({
                    user_id: userId,
                    role: 'user',
                    content: sanitizedMessage,
                    content_type: 'text',
                });

                // Yield user message saved confirmation
                yield {
                    type: 'userMessageSaved',
                    data: { userMessage, success: true }
                };

                // Step 2: Get streaming AI response from Gemini
                let fullResponse = '';

                for await (const chunk of generateGeminiStreamResponse(sanitizedMessage)) {
                    if (!chunk.done) {
                        fullResponse += chunk.chunk;
                        // Yield each chunk as it comes
                        yield {
                            type: 'chunk',
                            data: {
                                chunk: chunk.chunk,
                                fullResponse,
                                success: chunk.success
                            }
                        };
                    } else {
                        // Stream is complete
                        if (chunk.success) {
                            // Step 3: Save complete AI response to database
                            const aiMessage = await chatHistoryService.addMessage({
                                user_id: userId,
                                role: 'model',
                                content: fullResponse,
                                content_type: 'text',
                            });

                            // Yield completion
                            yield {
                                type: 'complete',
                                data: {
                                    aiMessage,
                                    fullResponse,
                                    success: true
                                }
                            };
                        } else {
                            // Handle error case
                            const errorMessage = chunk.chunk || 'I apologize, but I encountered an error processing your message. Please try again.';

                            try {
                                const aiMessage = await chatHistoryService.addMessage({
                                    user_id: userId,
                                    role: 'model',
                                    content: errorMessage,
                                    content_type: 'text',
                                });

                                yield {
                                    type: 'error',
                                    data: {
                                        aiMessage,
                                        error: chunk.error || 'Unknown error',
                                        success: false
                                    }
                                };
                            } catch (dbError) {
                                console.error('Failed to save error message:', dbError);
                                yield {
                                    type: 'error',
                                    data: {
                                        error: 'Failed to save error message',
                                        success: false
                                    }
                                };
                            }
                        }
                        break;
                    }
                }

            } catch (error) {
                console.error('Failed to process streaming message:', error);

                // Try to save an error message for the user
                try {
                    const aiMessage = await chatHistoryService.addMessage({
                        user_id: userId,
                        role: 'model',
                        content: 'I apologize, but I encountered an error processing your message. Please try again.',
                        content_type: 'text',
                    });

                    yield {
                        type: 'error',
                        data: {
                            aiMessage,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            success: false
                        }
                    };
                } catch (dbError) {
                    console.error('Failed to save error message:', dbError);
                    yield {
                        type: 'error',
                        data: {
                            error: 'Failed to save error message',
                            success: false
                        }
                    };
                }
            }
        }),

    /**
     * Clear all chat history for a user (temporarily public for testing)
     */
    clearHistory: t.procedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ input }) => {
            try {
                await chatHistoryService.clearUserHistory(input.userId);

                return {
                    success: true,
                    message: 'Chat history cleared successfully',
                };
            } catch (error) {
                console.error('Failed to clear chat history:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to clear chat history',
                });
            }
        }),

    /**
     * Generate image based on user prompt (temporarily public for testing)
     */
    generateImage: t.procedure
        .input(generateImageInput)
        .mutation(async ({ input }) => {
            try {
                const { prompt, userId } = input;

                // Sanitize the prompt
                const sanitizedPrompt = sanitizeUserInput(prompt);

                // 1. Save the user's prompt to chat history with content_type 'text'
                const userMessage: Omit<ChatMessage, 'id' | 'created_at'> = {
                    user_id: userId,
                    content: sanitizedPrompt,
                    role: 'user',
                    content_type: 'text'
                };

                const savedUserMessage = await chatHistoryService.addMessage(userMessage);

                // 2. Call Gemini API for image generation
                const imageResponse = await generateGeminiImage(sanitizedPrompt);

                if (!imageResponse.success) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: imageResponse.error || 'Failed to generate image',
                    });
                }

                // 3. Save the image URL response to chat history with content_type 'image'
                const aiMessage: Omit<ChatMessage, 'id' | 'created_at'> = {
                    user_id: userId,
                    content: imageResponse.imageUrl,
                    role: 'model',
                    content_type: 'image'
                };

                const savedAiMessage = await chatHistoryService.addMessage(aiMessage);

                // 4. Return the image URL to the client
                return {
                    success: true,
                    imageUrl: imageResponse.imageUrl,
                    userMessage: savedUserMessage,
                    aiMessage: savedAiMessage,
                    prompt: sanitizedPrompt
                };

            } catch (error) {
                console.error('Failed to generate image:', error);

                if (error instanceof TRPCError) {
                    throw error;
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to generate image',
                    cause: error,
                });
            }
        }),
});
