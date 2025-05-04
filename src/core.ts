// src/core.ts
import { ok } from 'assert';
import Knex from 'knex';
import got from 'got';
import { systemPrompt } from './prompts.js';
import { resumeSchema } from './schema.js';
import { createId } from '@paralleldrive/cuid2';
import type { MyContext } from '../types.js';
import { getUserFromId } from './utils.js';

const { OPENROUTER_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER } = process.env;

ok(DB_HOST && DB_PORT && DB_NAME && DB_USER, 'DB env vars must be set');
ok(OPENROUTER_KEY, 'OPENROUTER_KEY MUST BE DEFINED');

// Database configuration
const config = {
    client: 'pg',
    connection: {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
    },
};

export const db = Knex(config);

export async function analyzeResume(base64Images: MessageContent[]) {
    const model = 'google/gemini-2.5-flash-preview';
    const messages = [
        { role: 'user', content: systemPrompt },
        { role: 'user', content: base64Images },
    ];

    const response = await got.post('https://openrouter.ai/api/v1/chat/completions', {
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
            response_format: { type: 'json_schema', json_schema: resumeSchema },
        },
        responseType: 'json',
    });

    const data = response.body as any;
    const content = JSON.parse(data.choices[0].message.content);
    return content;
}

export async function saveUserData(ctx: MyContext, userData: any) {
    const newUserId = createId();

    await db('user').insert({
        id: newUserId,
        telegram_id: ctx.from?.id.toString(),
        ...userData,
    });

    return await getUserFromId(ctx.from?.id.toString());
}
