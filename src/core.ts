import { ok } from 'assert';
import Knex from 'knex';
import got from 'got';
import { toolMap, tools } from './tools.js';
import { systemPrompt } from './prompts.js';
import { resumeSchema } from './schema.js';

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

    console.log(initialData);

    const assistantMessage = initialData.choices[0].message;
    console.log(assistantMessage);
    messages.push(assistantMessage);

    // Step 2: Handle tool calls if present
    if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
            const { id, function: func } = toolCall;
            const args = JSON.parse(func.arguments);
            const toolFn = toolMap[func.name as keyof typeof toolMap];
            if (!toolFn) {
                throw new Error(`Unknown tool: ${func.name}`);
            }
            const result = await toolFn(args);
            messages.push({
                role: 'tool',
                tool_call_id: id,
                name: func.name,
                content: JSON.stringify(result),
            });
        }

        // Step 3: Send the tool result back to the model
        const finalResponse = await got.post('https://openrouter.ai/api/v1/chat/completions', {
            headers: {
                Authorization: `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
            },
            json: {
                model,
                messages,
            },
            responseType: 'json',
        });

        const finalData = finalResponse.body as any;
        const finalMessage = finalData.choices[0].message;
        console.log(finalMessage.content);
    } else {
        // No tool call; output assistant's message
        console.log(assistantMessage.content);
    }
}

export const db = Knex(config);
