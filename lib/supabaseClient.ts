import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our chat_history table
export interface ChatMessage {
    id: string;
    user_id: string;
    created_at: string;
    role: 'user' | 'model';
    content: string;
    content_type: 'text' | 'image';
}

// Database helper functions
export const chatHistoryService = {
    // Get all messages for a specific user
    async getMessagesForUser(userId: string): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('chat_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            throw error;
        }

        return data || [];
    },

    // Add a new message
    async addMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
        const { data, error } = await supabase
            .from('chat_history')
            .insert([message])
            .select()
            .single();

        if (error) {
            console.error('Error adding message:', error);
            throw error;
        }

        return data;
    },

    // Delete all messages for a user (clear chat history)
    async clearUserHistory(userId: string): Promise<void> {
        const { error } = await supabase
            .from('chat_history')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Error clearing chat history:', error);
            throw error;
        }
    }
};
