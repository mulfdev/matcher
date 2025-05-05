import { ok } from 'assert';
import Knex from 'knex';
import got from 'got';
import { systemPrompt } from './prompts.js';
import { resumeSchema } from './schema.js';
import type { User } from '../types.js';

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

const { OPENROUTER_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER } = process.env;

ok(DB_HOST && DB_PORT && DB_NAME && DB_USER, 'DB env vars must be set');
ok(OPENROUTER_KEY, 'OPENROUTER_KEY MUST BE DEFINED');

const config = {
    client: 'pg',
    connection: {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
    },
};

export async function llm({ base64Images }: LlmParams) {
    if (!base64Images) {
        throw new Error('Must have resume images with request');
    }

    const model = 'google/gemini-2.5-flash-preview';
    const messages: any[] = [
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
    const initialData = initialResponse.body as any;

    const assistantMessage = initialData.choices[0].message;
    const content: Omit<User, 'id'> = JSON.parse(assistantMessage.content);

    return content;
}

export const db = Knex(config);
