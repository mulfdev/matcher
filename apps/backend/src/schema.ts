export const jobEmbedSchema = {
    type: 'object',
    properties: {
        skills: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of explicitly mentioned skills.',
        },
        summary: {
            type: 'string',
            description: 'Concise summary of the job description',
        },
    },
    required: ['skills', 'summary'],
    additionalProperties: false,
};

export const resumeSchema = {
    type: 'object',
    properties: {
        skills: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of explicitly mentioned skills.',
        },
        experience: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Job title' },
                    company: { type: 'string', description: 'Company name' },
                    start_date: { type: 'string', description: 'Start date (YYYY-MM)' },
                    end_date: { type: 'string', description: "End date (YYYY-MM or 'Present')" },
                    duration_months: { type: 'integer', description: 'Duration in months' },
                    responsibilities: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Detailed descriptions of roles and achievements.',
                    },
                },
                required: [
                    'title',
                    'company',
                    'start_date',
                    'end_date',
                    'duration_months',
                    'responsibilities',
                ],
            },
            description: 'Detailed breakdown of job history.',
        },
        total_experience_years: {
            type: 'number',
            description: 'Total years of experience, rounded to one decimal place.',
        },
        career_level: {
            type: 'string',
            enum: ['entry', 'mid', 'senior', 'staff'],
            description: 'Estimated career level based on experience.',
        },
        category: {
            type: 'string',
            enum: [
                'engineer/developer',
                'designer',
                'business development',
                'human resources and people operations',
                'developer relations',
            ],
            description: 'Best-fit job category.',
        },
        summary: {
            type: 'string',
            description: "Concise summary of the candidate's profile.",
        },
    },
    required: [
        'skills',
        'experience',
        'total_experience_years',
        'career_level',
        'category',
        'summary',
    ],
    additionalProperties: false,
};
