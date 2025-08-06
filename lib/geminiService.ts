import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Get the Gemini model
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface GeminiResponse {
    response: string;
    success: boolean;
    error?: string;
}

export interface GeminiStreamResponse {
    chunk: string;
    done: boolean;
    success: boolean;
    error?: string;
}

export interface GeminiImageResponse {
    imageUrl: string;
    success: boolean;
    error?: string;
}

/**
 * Generate AI response using Google Gemini API
 */
export async function generateGeminiResponse(userMessage: string): Promise<GeminiResponse> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                response: "I apologize, but the AI service is not configured. Please check the API key configuration.",
                success: false,
                error: "Gemini API key not configured"
            };
        }

        // Create a conversation context for better responses
        const prompt = `You are a helpful AI assistant. Please respond to the following message in a friendly and informative way:

User: ${userMessage}

Please provide a helpful and engaging response.`;

        // Generate response from Gemini
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            response: text,
            success: true
        };

    } catch (error) {
        console.error('Gemini API error:', error);

        // Handle specific error cases
        if (error instanceof Error) {
            if (error.message.includes('API_KEY')) {
                return {
                    response: "I apologize, but there's an issue with the AI service configuration.",
                    success: false,
                    error: "Invalid API key"
                };
            }

            if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('overloaded') || error.message.includes('503')) {
                return {
                    response: "🤖 I apologize, but the AI text service is temporarily overloaded due to high demand. Please try again in a few minutes.\n\n💡 **Good news:** Image generation is still working! Try typing `/image` followed by your image description to generate pictures instead.\n\nExample: `/image a beautiful sunset over mountains`",
                    success: false,
                    error: "Service temporarily overloaded"
                };
            }
        }

        // Generic error response
        return {
            response: "I apologize, but I'm experiencing technical difficulties right now. Please try again later.",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Generate streaming AI response using Google Gemini API
 */
export async function* generateGeminiStreamResponse(userMessage: string): AsyncGenerator<GeminiStreamResponse> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            yield {
                chunk: "I apologize, but the AI service is not configured. Please check the API key configuration.",
                done: true,
                success: false,
                error: "Gemini API key not configured"
            };
            return;
        }

        // Create a conversation context for better responses
        const prompt = `You are a helpful AI assistant. Please respond to the following message in a friendly and informative way:

User: ${userMessage}

Please provide a helpful and engaging response.`;

        // Generate streaming response from Gemini
        const result = await model.generateContentStream(prompt);

        let fullResponse = '';

        for await (const chunk of result.stream) {
            try {
                const chunkText = chunk.text();
                fullResponse += chunkText;

                yield {
                    chunk: chunkText,
                    done: false,
                    success: true
                };
            } catch (chunkError) {
                console.warn('Error processing chunk:', chunkError);
                // Continue processing other chunks
            }
        }

        // Final chunk to indicate completion
        yield {
            chunk: '',
            done: true,
            success: true
        };

    } catch (error) {
        console.error('Gemini streaming API error:', error);

        let errorMessage = "I apologize, but I'm experiencing technical difficulties right now. Please try again later.";

        if (error instanceof Error) {
            if (error.message.includes('API_KEY')) {
                errorMessage = "I apologize, but there's an issue with the AI service configuration.";
            } else if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('overloaded') || error.message.includes('503')) {
                errorMessage = "🤖 I apologize, but the AI text service is temporarily overloaded due to high demand. Please try again in a few minutes.\n\n💡 **Good news:** Image generation is still working! Try typing `/image` followed by your image description to generate pictures instead.\n\nExample: `/image a beautiful sunset over mountains`";
            }
        }

        yield {
            chunk: errorMessage,
            done: true,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Validate and sanitize user input for Gemini API
 */
export function sanitizeUserInput(input: string): string {
    // Remove potentially harmful content and limit length
    return input
        .trim()
        .slice(0, 2000) // Limit to 2000 characters
        .replace(/[<>]/g, ''); // Remove angle brackets to prevent injection
}

/**
 * Generate image using Google Gemini API with Imagen 3.0 model
 * Using the imagen-3.0-generate-002 model for actual image generation
 */
export async function generateGeminiImage(prompt: string): Promise<GeminiImageResponse> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                imageUrl: "",
                success: false,
                error: "Gemini API key not configured"
            };
        }

        // Sanitize the prompt
        const sanitizedPrompt = sanitizeUserInput(prompt);

        if (!sanitizedPrompt) {
            return {
                imageUrl: "",
                success: false,
                error: "Prompt cannot be empty"
            };
        }

        if (sanitizedPrompt.length > 2000) {
            return {
                imageUrl: "",
                success: false,
                error: "Prompt is too long (max 2000 characters)"
            };
        }

        console.log('Attempting to generate image with prompt:', sanitizedPrompt);

        // Try FREE Hugging Face API first (if available)
        if (process.env.HUGGINGFACE_API_KEY) {
            console.log('Using FREE Hugging Face Stable Diffusion...');

            try {
                const response = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: sanitizedPrompt,
                        parameters: {
                            negative_prompt: "blurry, bad quality, distorted",
                            num_inference_steps: 20,
                            guidance_scale: 7.5
                        }
                    })
                });

                if (response.ok) {
                    const imageBlob = await response.blob();
                    console.log('✅ FREE image generated successfully with Hugging Face!');

                    // Convert blob to base64 data URL using Node.js Buffer
                    const arrayBuffer = await imageBlob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const base64 = buffer.toString('base64');
                    const dataUrl = `data:image/png;base64,${base64}`;

                    return {
                        imageUrl: dataUrl,
                        success: true
                    };
                } else {
                    const errorText = await response.text();
                    console.log('Hugging Face API error:', errorText);

                    // Check for permission errors
                    if (errorText.includes('insufficient permissions') || errorText.includes('authentication')) {
                        console.log('Hugging Face token needs Inference permissions - trying alternative...');
                    }
                }
            } catch (hfError) {
                console.error('Error calling Hugging Face:', hfError);
            }
        }

        // Try completely FREE Pollinations.ai (no API key needed!)
        console.log('Trying alternative FREE image generation (Pollinations.ai)...');
        try {
            const encodedPrompt = encodeURIComponent(sanitizedPrompt);
            const seed = Math.floor(Math.random() * 1000000);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&model=flux&nologo=true`;

            // Test if the image loads successfully
            const testResponse = await fetch(imageUrl, { method: 'HEAD' });
            if (testResponse.ok && testResponse.headers.get('content-type')?.startsWith('image/')) {
                console.log('✅ FREE image generated successfully with Pollinations.ai!');
                return {
                    imageUrl: imageUrl,
                    success: true
                };
            }
        } catch (pollError) {
            console.error('Error calling Pollinations.ai:', pollError);
        }

        // Fallback to OpenAI DALL-E (PAID) if Hugging Face not available
        if (process.env.OPENAI_API_KEY) {
            console.log('Hugging Face not available, using PAID OpenAI DALL-E...');

            try {
                const response = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: "dall-e-3",
                        prompt: sanitizedPrompt,
                        n: 1,
                        size: "1024x1024",
                        quality: "standard"
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('💰 PAID image generated with OpenAI DALL-E (~$0.04 cost)');

                    if (result.data && result.data[0] && result.data[0].url) {
                        const imageUrl = result.data[0].url;

                        return {
                            imageUrl: imageUrl,
                            success: true,
                            error: "Note: This used OpenAI DALL-E (paid). Cost: ~$0.04. Add HUGGINGFACE_API_KEY for free images."
                        };
                    }
                } else {
                    const errorData = await response.json();
                    console.error('OpenAI API error:', errorData);
                }
            } catch (openaiError) {
                console.error('Error calling OpenAI:', openaiError);
            }
        }

        // No API keys available - show informative placeholder
        console.log('All free options failed - using informative placeholder');

        const placeholderUrl = `https://via.placeholder.com/1024x1024/3498db/ffffff?text=${encodeURIComponent(`Image generation temporarily unavailable. Trying multiple free services...`)}`;

        return {
            imageUrl: placeholderUrl,
            success: true,
            error: "Image generation services temporarily unavailable. We tried Hugging Face and Pollinations.ai free services."
        };
    } catch (error) {
        console.error('Gemini Imagen generation error:', error);

        // Handle specific API errors
        if (error instanceof Error) {
            if (error.message.includes('API_KEY_INVALID')) {
                return {
                    imageUrl: "",
                    success: false,
                    error: "Invalid Gemini API key"
                };
            }

            if (error.message.includes('QUOTA_EXCEEDED')) {
                return {
                    imageUrl: "",
                    success: false,
                    error: "API quota exceeded. Please check your billing."
                };
            }

            if (error.message.includes('SAFETY')) {
                return {
                    imageUrl: "",
                    success: false,
                    error: "Content filtered by safety settings. Try a different prompt."
                };
            }

            if (error.message.includes('MODEL_NOT_FOUND')) {
                return {
                    imageUrl: "",
                    success: false,
                    error: "Imagen 3.0 model not available. Please check model access."
                };
            }
        }

        return {
            imageUrl: "",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
