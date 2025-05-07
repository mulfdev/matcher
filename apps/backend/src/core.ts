import assert from 'assert';
import Knex from 'knex';
import got from 'got';
import { systemPrompt } from './prompts.js';
import { resumeSchema } from './schema.js';
import type { UserProfile } from '../types.js';

export type MessageContent =
    | { type: 'text'; text: string }
    | {
          type: 'image_url';
          image_url: {
              url: string;
              detail: 'auto';
          };
      };

type LlmParams = {
    base64Images?: MessageContent[];
};

const { OPENROUTER_KEY, DATABASE_URL } = process.env;

assert(typeof DATABASE_URL === 'string', 'DATABASE_URL must be set');
assert(typeof OPENROUTER_KEY === 'string', 'OPENROUTER_KEY MUST BE DEFINED');

export const db = Knex({
    client: 'pg',
    connection: DATABASE_URL,
});

export async function llm({ base64Images }: LlmParams) {
    if (!base64Images) {
        throw new Error('Must have resume images with request');
    }

    const model = 'google/gemini-2.5-flash-preview';
    const messages = [
        { role: 'user', content: systemPrompt },
        { role: 'user', content: base64Images },
    ];

    const initialResponse = await got.post('https://openrouter.ai/api/v1/chat/completions', {
        headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
        },
        json: {
            model,
            messages,
            temperature: 0.3,
            top_p: 0.9,
            frequency_penalty: 0.5,
            presence_penalty: 0,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'analyze_resume',
                    strict: true,
                    schema: resumeSchema,
                },
            },
        },
        responseType: 'json',
    });

    const initialData = initialResponse.body as {
        choices?: {
            message?: {
                content?: string;
            };
        }[];
    };

    const assistantMessage = initialData?.choices?.[0]?.message;

    // Add null check for content
    if (typeof assistantMessage?.content !== 'string') {
        throw new Error('Invalid content format in OpenRouter response');
    }

    const content = JSON.parse(assistantMessage.content) as UserProfile;

    return content;
}
