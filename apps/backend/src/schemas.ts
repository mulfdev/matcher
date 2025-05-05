export const authSchema = {
    type: 'object',
    required: ['credential'],
    properties: {
        credential: { type: 'string' },
    },
} as const;
