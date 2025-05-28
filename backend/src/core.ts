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

/**
 * Hybrid Recommendation: combines embedding similarity and job popularity (likes).
 * @param db - Knex instance
 * @param userId - current user id
 * @param limit - number of recommendations to return
 * @returns Array of recommended jobs with hybrid score
 */
export async function getHybridRecommendations(db: any, userId: string, limit = 10) {
    // Get user embeddings
    const [userEmbeddings] = await db('user_profile')
        .select('skill_embedding', 'summary_embedding')
        .where('user_id', userId);

    if (!userEmbeddings) {
        throw new Error('User has not been onboarded yet');
    }

    // Weighted user vector
    const userVec = weightedVectorCombine(
        ensureNumericVector(userEmbeddings.skill_embedding),
        ensureNumericVector(userEmbeddings.summary_embedding),
        0.25,
        0.75
    );

    // Get feedbacks for this user
    const feedbacks = await db('user_job_feedback')
        .select('job_id', 'liked')
        .where('user_id', userId);

    // Exclude jobs already rated by user
    const ratedJobIds = feedbacks.map((f: any) => f.job_id);

    // Get job popularity (number of likes)
    const jobLikes = await db('user_job_feedback')
        .select('job_id')
        .where('liked', true);

    const likeCounts: Record<number, number> = {};
    for (const row of jobLikes) {
        likeCounts[row.job_id] = (likeCounts[row.job_id] || 0) + 1;
    }

    // Query jobs with similarity
    let jobs = await db('job_postings_details')
        .select(
            'id',
            'title',
            'location',
            'compensation',
            'summary',
            db.raw('(skill_embedding <-> ?::vector(1536)) AS similarity', [
                `[${userVec.join(',')}]`,
            ])
        )
        .whereNotIn('id', ratedJobIds)
        .limit(100); // get more to allow for hybrid ranking

    // Normalize similarity and likes, then combine
    const similarities = jobs.map((j: any) => Number(j.similarity));
    const minSim = Math.min(...similarities);
    const maxSim = Math.max(...similarities);

    const likeVals = jobs.map((j: any) => likeCounts[j.id] || 0);
    const minLike = Math.min(...likeVals);
    const maxLike = Math.max(...likeVals);

    jobs = jobs.map((job: any) => {
        // Lower similarity is better (distance), so invert and normalize
        const simNorm =
            maxSim > minSim ? 1 - (Number(job.similarity) - minSim) / (maxSim - minSim) : 1;
        // Likes normalized
        const likeNorm =
            maxLike > minLike ? ((likeCounts[job.id] || 0) - minLike) / (maxLike - minLike) : 0;
        // Hybrid score: weighted sum (tune weights as needed)
        const hybridScore = 0.7 * simNorm + 0.3 * likeNorm;
        return { ...job, hybridScore };
    });

    // Sort by hybrid score descending
    jobs.sort((a: any, b: any) => b.hybridScore - a.hybridScore);

    return jobs.slice(0, limit);
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
