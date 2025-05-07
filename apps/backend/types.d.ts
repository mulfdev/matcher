import '@fastify/session';
import type { authSchema } from './src/routeSchema.js';

declare module 'fastify' {
    interface Session {
        userId: string;
        email: string;
        name: string;
    }
}


type InferSchemaType<T> = T extends { properties: infer P }
    ? {
        [K in keyof P]: P[K] extends { type: 'string' }
        ? string
        : P[K] extends { type: 'number' }
        ? number
        : P[K] extends { type: 'boolean' }
        ? boolean
        : P[K] extends { type: 'object' }
        ? InferSchemaType<P[K]>
        : P[K] extends { type: 'array' }
        ? unknown[]
        : unknown;
    }
    : never;

export type AuthBody = InferSchemaType<typeof authSchema>;


export interface JobPostingsDetails {
    id: string;
    created_at: string;
    summary_embedding?: number[];
    skill_embedding?: number[];
    job_posting_id?: number;
    text?: string;
    title?: string;
    location?: string;
    compensation?: string;
    summary?: string;
    job_postings_scraping_id?: string;
    last_modified: string;
    embeddings?: number[];
}

export interface Experience {
    title: string;
    company: string;
    start_date: string; // YYYY-MM
    end_date: string; // YYYY-MM or 'Present'
    duration_months: number;
    responsibilities: string[];
}

export interface User {
    id: string;
    oauth_user_id: string
    oauth_provider: string;
    email: string;
    name: string;
}

export interface UserProfile {
    user_id: string;
    career_level: 'entry' | 'mid' | 'senior' | 'staff';
    total_experience_years: number; // NUMERIC(4,1)
    experience: Experience[];
    skills: string[];
    category: string;
    summary: string;
}

declare module 'knex/types/tables.js' {
    interface Tables {
        job_postings_details: JobPostingsDetails;
        user: User;
        user_profile: UserProfile;
    }
}
