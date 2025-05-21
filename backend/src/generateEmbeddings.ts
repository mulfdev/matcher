import 'dotenv/config';
import got from 'got';
import pLimit from 'p-limit';
import { db, embedder } from '../src/core.js';
import type { JobPostingsDetails } from '../types.js';
import assert from 'assert';

const { OPENROUTER_KEY } = process.env;
const BATCH_SIZE = 8;
const MAX_CONCURRENT_BATCHES = 5;
const BATCH_DELAY_MS = 250;

type StructuredJobData = {
    skills: string[];
    summary: string;
};

type JobRequest = Partial<StructuredJobData>;

function normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map((x) => x / norm);
}

async function fetchStructuredData(job: JobPostingsDetails) {
    const messages = [
        {
            role: 'user',
            content: `Analyze the job listing and format it in a manner that is compliant with the schema. Do not change anything, do not interpret it whatsoever, just format to the provided schema.\n\nTitle: ${job.title}\nDescription: ${job.text}`,
        },
    ];

    try {
        const { body } = await got.post('https://openrouter.ai/api/v1/chat/completions', {
            headers: {
                Authorization: `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
            },
            json: {
                model: 'google/gemini-2.5-flash-preview',
                messages,
                temperature: 0.2,
                top_p: 0.9,
                frequency_penalty: 0.5,
                presence_penalty: 0,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'analyze_job',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                skills: { type: 'array', items: { type: 'string' } },
                                summary: { type: 'string' },
                            },
                            required: ['skills', 'summary'],
                            additionalProperties: false,
                        },
                    },
                },
            },
            responseType: 'json',
        });
        const typedBody = body as {
            choices: { message: { content: string } }[];
        };

        const content = typedBody.choices[0]?.message?.content;
        assert(typeof content === 'string', 'Invalid response format');

        const parsed = JSON.parse(content) as JobRequest;
        assert(parsed.skills && Array.isArray(parsed.skills), 'Missing or invalid skills');
        assert(typeof parsed.summary === 'string', 'Missing or invalid summary');

        return parsed as StructuredJobData;
    } catch {
        throw new Error('Could not parse job data');
    }
}

async function processJob(job: JobPostingsDetails) {
    const structured = await fetchStructuredData(job);
    const [sumRes, skillRes] = await Promise.all([
        embedder.embeddings.create({
            model: 'text-embedding-3-small',
            input: structured.summary,
            encoding_format: 'float',
        }),
        embedder.embeddings.create({
            model: 'text-embedding-3-small',
            input: structured.skills.join(', '),
            encoding_format: 'float',
        }),
    ]);

    assert(sumRes.data[0], 'missing summary embedding');
    assert(skillRes.data[0], 'missing skill embedding');

    return {
        id: job.id,
        summaryEmbedding: normalize(sumRes.data[0].embedding),
        skillEmbedding: normalize(skillRes.data[0].embedding),
    };
}

function chunk<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size));
    }
    return res;
}

async function processBatch(batch: JobPostingsDetails[]) {
    const results = await Promise.all(batch.map(processJob));

    const rowSql = results.map(() => '(?::int, ?::vector, ?::vector)').join(', ');
    const bindings = results.flatMap((r) => [
        r.id,
        `[${r.summaryEmbedding.join(',')}]`,
        `[${r.skillEmbedding.join(',')}]`,
    ]);
    await db.transaction(async (trx) => {
        await trx.raw(
            `
      UPDATE job_postings_details AS j
      SET
        summary_embedding = v.summary_embedding,
        skill_embedding  = v.skill_embedding
      FROM (VALUES ${rowSql})
        AS v(id, summary_embedding, skill_embedding)
      WHERE v.id = j.id
      `,
            bindings
        );
    });

    console.log(`Updated batch IDs: [${results.map((r) => r.id).join(', ')}]`);
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
}

async function processJobs() {
    const jobs = await db('job_postings_details')
        .select('*')
        .whereNull('summary_embedding')
        .orWhereNull('skill_embedding');

    console.log(`Total entries to process: ${jobs.length}`);
    if (!jobs.length) return;

    const batchLimiter = pLimit(MAX_CONCURRENT_BATCHES);
    const batches = chunk(jobs, BATCH_SIZE);

    await Promise.all(batches.map((batch) => batchLimiter(() => processBatch(batch))));
}

try {
    await processJobs();
} catch (e) {
    console.error(e);
    await new Promise((r) => setTimeout(r, 2_500));
    await processJobs();

    await new Promise((r) => setTimeout(r, 10_000));
    await processJobs();

    await new Promise((r) => setTimeout(r, 20_000));
    await processJobs();
} finally {
    await db.destroy();
}
