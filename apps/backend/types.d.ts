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
    id: string; // CUID
    skills: string[];
    telegram_id: string;
    experience: Experience[];
    total_experience_years: number; // NUMERIC(4,1)
    career_level: 'entry' | 'mid' | 'senior' | 'staff';
    category: string;
    summary: string;
}

declare module 'knex/types/tables.js' {
    interface Tables {
        job_postings_details: JobPostingsDetails;
        user: User;
    }
}
