import 'dotenv/config';
import OpenAI from 'openai';
import Knex from 'knex';
import pgvector from 'pgvector/knex';
import type { JobPostingsDetails } from '../types.js';
import assert from 'assert';
import pLimit from 'p-limit';

const config = {
    client: 'pg',
    connection: {
        host: 'ballast.proxy.rlwy.net',
        port: 14533,
        database: 'jobs_rag',
        user: 'mulf0',
    },
};

const db = Knex(config);
const openai = new OpenAI();

async function processJobs() {
    try {
        const jobs = await db<JobPostingsDetails>('job_postings_details')
            .select('*')
            .whereNull('embedding');

        console.log(`Total entries to be updated: ${jobs.length}`);

        if (jobs.length < 1) {
            console.log('All rows up to date!');
            return;
        }

        const batchSize = 10;
        const limit = pLimit(5);

        const batches = [];
        for (let i = 0; i < jobs.length; i += batchSize) {
            batches.push(jobs.slice(i, i + batchSize));
        }

        const tasks = batches.map((batch) =>
            limit(async () => {
                const inputs = batch.map(
                    (job) =>
                        `id: ${job.id}, description: ${job.description}, title: ${job.title}, compensation: ${job.compensation}`
                );

                const embeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: inputs,
                    encoding_format: 'float',
                });

                assert(embeddingResponse.data, 'Expected embedding.data to be defined');
                assert(
                    Array.isArray(embeddingResponse.data),
                    'Expected embedding.data to be an array'
                );
                assert(
                    embeddingResponse.data.length === batch.length,
                    'Expected one embedding per input in the batch'
                );

                const updatePromises = batch.map(async (job, index) => {
                    const embeddingData = embeddingResponse.data[index];
                    assert(embeddingData?.embedding, `Expected embedding for job id ${job.id}`);
                    const formattedEmbedding = pgvector.toSql(embeddingData.embedding);
                    const updatedId = await db<JobPostingsDetails>('job_postings_details')
                        .where({ id: job.id })
                        .update({ embedding: formattedEmbedding }, ['id']);
                    console.log({ updatedId });
                });

                await Promise.all(updatePromises);
            })
        );

        await Promise.all(tasks);
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

await processJobs();
