import assert from 'assert';
import Knex from 'knex';
import got from 'got';
import { systemPrompt } from './prompts.js';
import { resumeSchema } from './schema.js';
import type { UserProfile } from '../types.js';
import OpenAI from 'openai';

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

export const embedder = new OpenAI();

export function weightedVectorCombine(a: number[], b: number[], wA: number, wB: number): number[] {
    //@ts-expect-error weighed combine
    const out = a.map((val, i) => val * wA + b[i] * wB);
    const norm = Math.sqrt(out.reduce((sum, x) => sum + x * x, 0));
    return out.map((x) => x / norm);
}

export function ensureNumericVector(v: unknown): number[] {
    if (Array.isArray(v)) return v.map(Number);
    if (typeof v === 'string') {
        if (v.startsWith('[') && v.endsWith(']')) {
            const parts = v.slice(1, -1).split(',');
            return parts.map((s) => Number(s.trim()));
        }
    }
    throw new Error('Invalid vector format');
}

export async function llm({ base64Images }: LlmParams) {
    if (!base64Images) {
        throw new Error('Must have resume images with request');
    }

    const model = 'google/gemini-2.5-flash-preview-05-20';
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

/**
 * Use LLM to match a user profile to a list of jobs.
 * Returns jobs ranked by LLM's assessment of fit.
 */
let llmJobMatchAbortController: AbortController | null = null;
let llmJobMatchInFlight: Promise<any> | null = null;

/**
 * Use LLM to match a user profile to a list of jobs.
 * Ensures only one request is in flight at a time; aborts any previous request.
 * Returns jobs ranked by LLM's assessment of fit.
 */
export async function llmJobMatch({
    userProfile,
    jobs,
    maxResults = 7,
    signal,
}: {
    userProfile: UserProfile,
    jobs: Array<{
        id: string;
        title: string;
        location?: string;
        compensation?: string;
        summary?: string;
    }>,
    maxResults?: number,
    signal?: AbortSignal,
}) {
    // Abort any previous in-flight request
    if (llmJobMatchAbortController) {
        llmJobMatchAbortController.abort();
    }
    llmJobMatchAbortController = new AbortController();
    const effectiveSignal = signal ?? llmJobMatchAbortController.signal;

    // Compose a prompt for the LLM
    const prompt = `
You are an expert career advisor and job matching assistant. Your task is to recommend the best job opportunities for a user based on their profile and the provided job postings. Carefully analyze the user's skills, experience, career level, and summary, and compare them to the requirements and descriptions of each job. Consider both explicit and implicit matches (e.g., transferable skills, relevant experience, and career goals).

Instructions:
- Rank the jobs from best to worst fit for the user.
- For each job, provide a "score" (higher is better) and a short explanation ("reason") for your ranking.
- Only use the information provided in the user profile and job postings.
- Do not invent or assume any information not present in the data.
- Respond in the specified JSON format, with at most ${maxResults} results.

User Profile:
${JSON.stringify(userProfile, null, 2)}

Job Postings:
${JSON.stringify(jobs, null, 2)}

Respond in the following JSON format:
[
  { "id": "<job_id>", "score": <number>, "reason": "<short explanation>" }
]
Return at most ${maxResults} results.
`;

    const model = 'google/gemini-2.5-flash-preview-05-20';

    // Store the in-flight promise so only the latest is awaited
    llmJobMatchInFlight = got.post('https://openrouter.ai/api/v1/chat/completions', {
        headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
        },
        json: {
            model,
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0,
        },
        responseType: 'json',
        signal: effectiveSignal,
    });

    let response;
    try {
        response = await llmJobMatchInFlight;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error('Previous LLM job match request aborted');
        }
        throw err;
    } finally {
        llmJobMatchInFlight = null;
        llmJobMatchAbortController = null;
    }

    const body = response.body as {
        choices?: {
            message?: {
                content?: string;
            };
        }[];
    };

    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from LLM');

    let results: Array<{ id: string, score: number, reason?: string }> = [];
    try {
        results = JSON.parse(content);
    } catch (e) {
        console.error('Failed to parse LLM job match response. Raw content:', content);
        throw new Error('Failed to parse LLM job match response');
    }

    // Only return jobs that exist in the input list, in order
    const jobIds = new Set(jobs.map(j => j.id));
    return results
        .filter(r => jobIds.has(r.id))
        .slice(0, maxResults);
}
