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
let llmJobMatchInFlight: Promise<unknown> | null = null;

/**
 * Use LLM to match a user profile to a list of jobs.
 * Returns jobs ranked by LLM's assessment of fit.
 */
export async function llmJobMatch({
    userProfile,
    jobs,
    maxResults = 7,
}: {
    userProfile: UserProfile;
    jobs: {
        id: string;
        title: string;
        location?: string;
        compensation?: string;
        summary?: string;
    }[];
    maxResults?: number;
}) {
    const prompt = `
You are a world-class AI career coach and job-matching expert. Your mission is to act as a hyper-analytical, unbiased, and insightful recommender system for job seekers. Given a user's detailed profile and a set of job postings, you must identify and rank ONLY the jobs that are a strong, clear match for this user.

STRICT GUIDELINES:
- Recommend ONLY jobs that are highly relevant to the user's skills, experience, and career goals.
- If a job does NOT clearly match the user's background, skills, or stated experience, DO NOT recommend it.
- If none of the jobs are a good fit, return an empty list.
- Do NOT recommend jobs just to fill the list. Quality is paramount.
- Avoid generic, unrelated, or weak matches. It is better to return fewer jobs than to include irrelevant ones.
- Be objective and avoid bias; do not invent or assume information not present in the data.

Your approach:
- Deeply analyze the user's profile: pay special attention to their 'career_level', 'total_experience_years', primary 'skills', 'category', and 'summary'. The user's 'summary' often reflects their aspirations and self-assessment – give it significant weight.
- Critically evaluate 'career_level' and 'total_experience_years':
    - A job requiring substantially different experience (e.g., entry-level for a senior candidate, or vice-versa) is generally a poor fit unless the user's profile explicitly indicates a desire for such a change (e.g., career pivot, step-back for work-life balance). Justify such recommendations thoroughly if made.
- Scrutinize 'skills' alignment: Prioritize jobs where the user's core skills (most prominent in their experience and skills list) are heavily utilized. A job missing several of the user's key skills is likely a poor match. Do not recommend a job if the user only possesses 1-2 minor skills listed among many required, unless those are niche and highly valuable.
- Consider 'category' alignment: The user's 'category' (e.g., 'engineer/developer') is a strong indicator of their field. Deviations should be rare and strongly justified by highly transferable skills or clear indications in the user's summary/experience.
- Carefully compare these attributes to each job's requirements, responsibilities, and context.
- Consider both direct and transferable skills, relevant experience, and potential for growth.
- Weigh not just explicit keyword matches, but also nuanced fit, such as career trajectory, alignment with the user's background, and the logical progression of their career.
- If a job is a genuine stretch or a strategic growth opportunity (and aligns with the user's plausible career path), note this clearly in your reasoning.
- If a job is a poor fit according to these criteria, DO NOT include it.

Instructions:
1. Rank the jobs from best to worst fit for the user, based on your expert analysis.
2. For each recommended job, provide:
   - "id": the job's id (must be one of the provided job IDs).
   - "score": a number from 0 to 100 (higher = better fit; use the full range, e.g., a truly exceptional match could be 95+, a decent match 70-80, a borderline but justifiable one 50-60. Do not cluster scores at the high end unless truly warranted).
   - "reason": a concise, specific explanation (1-3 sentences) of why this job is a good fit. Your reason MUST explicitly connect specific aspects of the user's profile (e.g., 'their 5 years of experience in X technology as seen in their role at Y company', or 'their stated interest in Z from their summary') to specific requirements or desirable attributes of the job (e.g., 'matches the job's need for an expert in X and leadership potential'). Avoid generic reasons.
3. Only use the information provided in the User Profile and Job Postings. Do not hallucinate or add extra details.
4. Output a JSON array of at most ${maxResults} objects, sorted by descending score. If no jobs meet your strict criteria, output an empty array.

User Profile:
${JSON.stringify(userProfile, null, 2)}

Job Postings:
${JSON.stringify(jobs, null, 2)}
`;
    const model = 'google/gemini-2.5-flash-preview-05-20';

    llmJobMatchInFlight = got.post('https://openrouter.ai/api/v1/chat/completions', {
        headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
        },
        json: {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'job_match',
                    strict: true,
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                score: { type: 'number' },
                                reason: { type: 'string' },
                            },
                            required: ['id', 'score', 'reason'],
                            additionalProperties: false,
                        },
                    },
                },
            },
        },
        responseType: 'json',
    });

    let response: unknown;
    try {
        response = await llmJobMatchInFlight;
    } finally {
        llmJobMatchInFlight = null;
    }

    if (
        typeof response === 'object' &&
        response !== null &&
        'body' in response &&
        typeof (response as { body: unknown }).body === 'object'
    ) {
        const body = (response as { body: unknown }).body as {
            choices?: {
                message?: {
                    content?: string | null;
                };
            }[];
        };

        const content = body?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content) {
            throw new Error('No response from LLM');
        }

        let results: { id: string; score: number; reason?: string }[] = [];
        try {
            results = JSON.parse(content) as { id: string; score: number; reason?: string }[];
        } catch {
            console.error('Failed to parse LLM job match response. Raw content:', content);
            throw new Error('Failed to parse LLM job match response');
        }

        const jobIds = new Set(jobs.map((j) => j.id));
        return results.filter((r) => jobIds.has(r.id)).slice(0, maxResults);
    }
    throw new Error('Unexpected response format from LLM');
}
