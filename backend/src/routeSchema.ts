export const authSchema = {
    type: 'object',
    required: ['credential'],
    properties: {
        credential: { type: 'string' },
    },
} as const;

export const jobFeedbackSchema = {
    type: 'object',
    required: ['id', 'liked'],
    properties: {
        id: { type: 'string' },
        liked: { type: 'boolean' },
    },
} as const;
