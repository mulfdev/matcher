export interface JobPostingsDetails {
    id: string;
    created_at: string;
    job_posting_id?: number;
    description?: string;
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
