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

declare module 'knex/types/tables.js' {
    interface Tables {
        job_postings_details: JobPostingsDetails;
    }
}
