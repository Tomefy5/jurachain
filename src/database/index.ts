/**
 * Database configuration and utilities for JusticeAutomation platform
 * Provides Supabase client setup and database helpers
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with TypeScript support
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Database helper functions
export class DatabaseError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export const handleDatabaseError = (error: any): never => {
    console.error('Database error:', error);
    throw new DatabaseError(
        error.message || 'An unexpected database error occurred',
        error.code
    );
};

// Transaction helper
export const withTransaction = async <T>(
    callback: (client: typeof supabase) => Promise<T>
): Promise<T> => {
    try {
        return await callback(supabase);
    } catch (error) {
        return handleDatabaseError(error);
    }
};

export default supabase;