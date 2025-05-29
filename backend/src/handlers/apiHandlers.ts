import { type FastifyInstance, type FastifyRequest } from 'fastify';
import got from 'got';
import assert from 'assert';
// Ensure weightedVectorCombine and ensureNumericVector are exported from core.ts
import {
    db,
    embedder, // Not directly used in this route's new logic but often part of core
    llm,
    type MessageContent,
    weightedVectorCombine,
    ensureNumericVector,
} from '../core.js';
import { OAuth2Client } from 'google-auth-library';
import { createId } from '@paralleldrive/cuid2';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { readdir, readFile, rm } from 'fs/promises';
import type { JobFeedbackBody, UserProfile, Experience, JobPostingsDetails } from '../../types.js';
import { jobFeedbackSchema } from '../routeSchema.js';
import { Poppler } from 'node-poppler';

interface GoogleCallbackQuery {
    code: string;
}

function averageEmbeddings(embeddings: number[][]): number[] | null {
    if (!embeddings || embeddings.length === 0) {
        return null;
    }
    const vectorLength = embeddings[0]?.length;
    const sum = new Array(vectorLength).fill(0);
    let validEmbeddingsCount = 0;

    for (const embedding of embeddings) {
        // Guard against embeddings of different lengths
        if (embedding.length === vectorLength) {
            for (let i = 0; i < vectorLength; i++) {
                sum[i] += embedding[i];
            }
            validEmbeddingsCount++;
        } else {
            console.warn(
                `Skipping embedding with mismatched length. Expected ${vectorLength}, got ${embedding.length}`
            );
        }
    }

    if (validEmbeddingsCount === 0) {
        return null; // No valid embeddings to average
    }

    const avgEmbedding = sum.map((val) => val / validEmbeddingsCount);

    // Normalize the averaged embedding
    const norm = Math.sqrt(avgEmbedding.reduce((acc, val) => acc + val * val, 0));
    if (norm === 0) return new Array(vectorLength).fill(0); // Avoid division by zero if sum is zero vector
    return avgEmbedding.map((val) => val / norm);
}

export function apiRoutes(api: FastifyInstance) {
    const { GOOGLE_CLIENT_ID, BASE_URL, GOOGLE_CLIENT_SECRET, NODE_ENV } = process.env;

    assert(typeof GOOGLE_CLIENT_ID === 'string', 'GOOGLE_CLIENT_ID must be defined');
    assert(typeof BASE_URL === 'string', 'BASE_URL must be set');
    assert(typeof GOOGLE_CLIENT_SECRET === 'string', 'GOOGLE_CLIENT_SECRET must be set');

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const poppler = new Poppler();

    api.get('/auth/google', async (_, res) => {
        const redirectUri = `${BASE_URL}/api/auth/google/callback`;
        const scope = ['openid', 'email', 'profile'].join(' ');
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', scope);
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
        res.redirect(url.toString());
    });

    api.get(
        '/auth/google/callback',
        async (req: FastifyRequest<{ Querystring: GoogleCallbackQuery }>, res) => {
            try {
                const { code } = req.query;
                const redirectUri = `${BASE_URL}/api/auth/google/callback`;
                const tokenRes = await got.post('https://oauth2.googleapis.com/token', {
                    form: {
                        code,
                        client_id: GOOGLE_CLIENT_ID,
                        client_secret: GOOGLE_CLIENT_SECRET,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    },
                    responseType: 'json',
                });
                const body = tokenRes.body as { id_token: string };
                const idToken = body.id_token;
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience: GOOGLE_CLIENT_ID,
                });
                const payload = ticket.getPayload();
                if (
                    !payload ||
                    typeof payload.email !== 'string' ||
                    typeof payload.name !== 'string'
                ) {
                    return await res.status(400).send('Invalid user data');
                }
                let user = await db('user').where('oauth_user_id', payload.sub).first();
                if (!user) {
                    const [insertedUser] = await db('user').insert(
                        {
                            id: createId(),
                            oauth_user_id: payload.sub,
                            oauth_provider: 'google',
                            email: payload.email,
                            name: payload.name,
                        },
                        ['id']
                    );
                    if (insertedUser)
                        user = {
                            id: insertedUser.id,
                            oauth_user_id: payload.sub,
                            oauth_provider: 'google',
                            email: payload.email,
                            name: payload.name,
                        };
                }
                if (user === undefined) throw new Error('Could not find or create user');
                req.session.userId = user.id;
                req.session.email = user.email;
                req.session.name = user.name;
                await req.session.save();

                if (NODE_ENV === 'production') {
                    res.redirect(`${BASE_URL}/dashboard`);
                } else {
                    res.redirect('http://localhost:5173/dashboard');
                }
            } catch (e) {
                console.log(e);
                res.status(500).send('OAuth callback error');
            }
        }
    );

    api.post(
        '/upload',
        {
            preHandler: (req, res, done) => {
                if (!req.session.userId) {
                    res.status(401).send({ error: 'Must be logged in' });
                    return done(new Error('Not authenticated'));
                }
                done();
            },
        },
        async (req, res) => {
            const data = await req.file();
            if (!data) return res.status(400).send({ error: 'No file uploaded' });
            if (data.mimetype !== 'application/pdf')
                return res.status(400).send({ error: 'Only PDF files are allowed' });

            const fileBuffer = await data.toBuffer();
            const tempDir = createId();
            const baseTempDir = join(process.cwd(), 'tmp', tempDir);
            mkdirSync(baseTempDir, { recursive: true });
            const pdfPath = join(baseTempDir, `${createId()}.pdf`);
            await pipeline(
                (async function* () {
                    yield fileBuffer;
                    await Promise.resolve();
                })(),
                createWriteStream(pdfPath)
            );
            if (!existsSync(pdfPath))
                return res.status(500).send({ error: 'Failed to save uploaded file' });

            const imgPath = join(baseTempDir, createId());
            await poppler.pdfToCairo(pdfPath, imgPath, {
                jpegFile: true,
                resolutionXAxis: 72,
                resolutionYAxis: 72,
            });
            const files = await readdir(baseTempDir);
            const jpgFiles = files.filter(
                (f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')
            );
            const base64Images: MessageContent[] = await Promise.all(
                jpgFiles.map(async (file) => {
                    const fullPath = join(baseTempDir, file);
                    const fileData = await readFile(fullPath);
                    return {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${fileData.toString('base64')}`,
                            detail: 'auto',
                        },
                    };
                })
            );

            try {
                const {
                    skills,
                    experience,
                    total_experience_years,
                    career_level,
                    category,
                    summary,
                } = await llm({ base64Images });
                const skillsText = skills.join(', ');
                const skillsEmbeddingRes = await embedder.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: skillsText,
                    encoding_format: 'float',
                });
                const summaryEmbeddingRes = await embedder.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: summary,
                    encoding_format: 'float',
                });
                if (!skillsEmbeddingRes?.data?.[0]?.embedding)
                    throw new Error('Could not generate embeddings for skills');
                if (!summaryEmbeddingRes?.data?.[0]?.embedding)
                    throw new Error('Could not generate embeddings for summary');

                const skillsEmbedding = skillsEmbeddingRes.data[0].embedding;
                const summaryEmbedding = summaryEmbeddingRes.data[0].embedding;

                await db('user_profile')
                    .insert({
                        skills: db.raw('?::text[]', [skills]),
                        experience: db.raw('?::jsonb', [JSON.stringify(experience)]),
                        total_experience_years,
                        career_level,
                        category,
                        summary,
                        user_id: req.session.userId,
                        summary_embedding: db.raw('?::vector(1536)', [
                            `[${summaryEmbedding.join(',')}]`,
                        ]),
                        skill_embedding: db.raw('?::vector(1536)', [
                            `[${skillsEmbedding.join(',')}]`,
                        ]),
                    })
                    .onConflict('user_id')
                    .merge();
                await rm(baseTempDir, { recursive: true, force: true });
                return await res.send({
                    data: {
                        skills,
                        experience,
                        total_experience_years,
                        career_level,
                        category,
                        summary,
                    },
                });
            } catch (error) {
                console.error(error);
                await rm(baseTempDir, { recursive: true, force: true });
                return res.status(500).send({ error: 'Failed to process PDF' });
            }
        }
    );

    // LLM-powered job matching endpoint with vector search pre-filtering and liked job influence
    api.get('/match-job', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).send({ error: 'Must be signed in' });
        }

        const userProfileFromDb = await db('user_profile')
            .select(
                'user_id',
                'skills',
                'experience',
                'total_experience_years',
                'career_level',
                'category',
                'summary',
                'skill_embedding',
                'summary_embedding'
            )
            .where('user_id', req.session.userId)
            .first();

        if (!userProfileFromDb) {
            return res
                .status(404)
                .send({ error: 'User profile not found. Please complete your profile.' });
        }

        if (!userProfileFromDb.summary_embedding || !userProfileFromDb.skill_embedding) {
            return res.status(400).send({
                error: 'User profile embeddings not found. Please re-upload your resume or wait for processing.',
            });
        }

        let baseUserSummaryEmbedding: number[];
        let baseUserSkillEmbedding: number[];
        try {
            baseUserSummaryEmbedding = ensureNumericVector(userProfileFromDb.summary_embedding);
            baseUserSkillEmbedding = ensureNumericVector(userProfileFromDb.skill_embedding);
        } catch (e) {
            const error = e as Error;
            console.error('Failed to parse user base embeddings:', error.message);
            return res.status(500).send({ error: 'Corrupted user profile embeddings.' });
        }

        // --- Incorporate Liked Jobs ---
        const likedJobsFeedback = await db('user_job_feedback')
            .select('job_id')
            .where('user_id', req.session.userId)
            .andWhere('liked', true);

        const likedJobIds = likedJobsFeedback.map((f) => f.job_id);
        let finalUserSummaryEmbedding = baseUserSummaryEmbedding;
        let finalUserSkillEmbedding = baseUserSkillEmbedding;

        // Weights for combining base profile with liked jobs
        const PROFILE_WEIGHT = 0.7;
        const LIKED_JOBS_WEIGHT = 0.3;

        if (likedJobIds.length > 0) {
            // Fetch liked jobs' details including their embeddings
            const likedJobDetails = (await db('job_postings_details')
                .select('id', 'summary_embedding', 'skill_embedding') // Added 'id' for potential logging
                .whereIn('id', likedJobIds.map(String)) // Job IDs in job_postings_details are strings
                .whereNotNull('summary_embedding')
                .whereNotNull('skill_embedding')) as Partial<
                Pick<JobPostingsDetails, 'id' | 'summary_embedding' | 'skill_embedding'>
            >[];

            const likedSummaryEmbeddings: number[][] = [];
            const likedSkillEmbeddings: number[][] = [];

            for (const job of likedJobDetails) {
                try {
                    if (job.summary_embedding)
                        likedSummaryEmbeddings.push(ensureNumericVector(job.summary_embedding));
                    if (job.skill_embedding)
                        likedSkillEmbeddings.push(ensureNumericVector(job.skill_embedding));
                } catch (e) {
                    const error = e as Error;
                    console.warn(
                        `Could not parse embedding for liked job ID ${job.id ?? 'unknown'}: ${error.message}`
                    );
                }
            }

            const avgLikedSummaryEmbedding = averageEmbeddings(likedSummaryEmbeddings);
            const avgLikedSkillEmbedding = averageEmbeddings(likedSkillEmbeddings);

            if (avgLikedSummaryEmbedding) {
                finalUserSummaryEmbedding = weightedVectorCombine(
                    baseUserSummaryEmbedding,
                    avgLikedSummaryEmbedding,
                    PROFILE_WEIGHT,
                    LIKED_JOBS_WEIGHT
                );
            }
            if (avgLikedSkillEmbedding) {
                finalUserSkillEmbedding = weightedVectorCombine(
                    baseUserSkillEmbedding,
                    avgLikedSkillEmbedding,
                    PROFILE_WEIGHT,
                    LIKED_JOBS_WEIGHT
                );
            }
        }
        // --- END Incorporate Liked Jobs ---

        // Prepare UserProfile for LLM (uses base textual data)
        const userProfileForLlm: UserProfile = {
            user_id: userProfileFromDb.user_id,
            career_level: userProfileFromDb.career_level,
            total_experience_years: Number(userProfileFromDb.total_experience_years),
            experience: (Array.isArray(userProfileFromDb.experience)
                ? userProfileFromDb.experience
                : Object.values(userProfileFromDb.experience || {})) as Experience[],
            skills: userProfileFromDb.skills,
            category: userProfileFromDb.category,
            summary: userProfileFromDb.summary,
            // These embeddings are the user's original ones. The `finalUser...Embedding` are for the vector search query.
            skill_embedding: baseUserSkillEmbedding,
            summary_embedding: baseUserSummaryEmbedding,
        };

        const finalUserSummaryEmbeddingSql = `ARRAY[${finalUserSummaryEmbedding.join(',')}]::vector`;
        const finalUserSkillEmbeddingSql = `ARRAY[${finalUserSkillEmbedding.join(',')}]::vector`;

        // Fetch all feedback (liked and disliked) to exclude from recommendations
        const feedbacks = await db('user_job_feedback')
            .select('job_id')
            .where('user_id', req.session.userId);
        const excludedJobIds = feedbacks.map((f) => String(f.job_id)); // Job IDs are BIGINT in feedback, string in postings

        const K_NEAREST_CANDIDATES = 50;
        const LLM_INPUT_LIMIT = 30;
        const SUMMARY_QUERY_WEIGHT = 0.6; // Weight for summary in the job vector search distance calc
        const SKILL_QUERY_WEIGHT = 0.4; // Weight for skill in the job vector search distance calc

        const jobsRaw = await db
            .select(
                'j.id',
                'j.title',
                'j.location',
                'j.compensation',
                'j.summary AS job_summary',
                'job_postings.posting_url',
                // Use the final (potentially preference-adjusted) user embeddings for distance calculation
                db.raw(
                    `(${SUMMARY_QUERY_WEIGHT} * (j.summary_embedding <-> ${finalUserSummaryEmbeddingSql})) + (${SKILL_QUERY_WEIGHT} * (j.skill_embedding <-> ${finalUserSkillEmbeddingSql})) AS distance`
                )
            )
            .from('job_postings_details AS j')
            .innerJoin('job_postings', 'j.id', 'job_postings.id')
            .whereNotIn('j.id', excludedJobIds)
            .whereNotNull('j.summary_embedding')
            .whereNotNull('j.skill_embedding')
            .orderBy('distance', 'asc') // Lower distance means more similar
            .limit(K_NEAREST_CANDIDATES);

        if (!jobsRaw || jobsRaw.length === 0) {
            return res.status(404).send({
                error: 'No relevant jobs found. Try broadening your profile or liking some jobs to refine suggestions!',
            });
        }

        const jobsForLlm = jobsRaw.slice(0, LLM_INPUT_LIMIT).map((j: any) => ({
            id: String(j.id), // Ensure ID is string for LLM and subsequent mapping
            title: j.title,
            location: j.location ?? undefined,
            compensation: j.compensation ?? undefined,
            summary: j.job_summary ?? undefined, // Use the aliased summary
        }));

        if (jobsForLlm.length === 0) {
            // This case should be rare if jobsRaw has items, but good for safety
            return res
                .status(404)
                .send({ error: 'No suitable jobs to send for final matching after filtering.' });
        }

        try {
            const { llmJobMatch } = await import('../core.js'); // Assuming dynamic import
            const rankedJobsFromLlm = await llmJobMatch({
                userProfile: userProfileForLlm,
                jobs: jobsForLlm,
                maxResults: 7, // Or your desired number of final recommendations
            });

            const jobMap = new Map(jobsForLlm.map((j) => [j.id, j]));
            const results = rankedJobsFromLlm
                .map((rankedJob: { id: string; score: number; reason?: string }) => {
                    const jobDetails = jobMap.get(rankedJob.id);
                    if (!jobDetails) {
                        console.warn(
                            `LLM returned job ID ${rankedJob.id} which was not in the set sent for ranking.`
                        );
                        return null;
                    }

                    // FIXME: the wrong link is being sent!

                    const lookup = jobsRaw.find((job) => job.id === rankedJob.id);
                    return {
                        ...jobDetails,
                        score: rankedJob.score,
                        reason: rankedJob.reason,
                        posting_url: lookup.posting_url,
                    };
                })
                .filter((job) => job !== null); // Remove any nulls if a job ID wasn't found

            console.log(results);
            return { results };
        } catch (e) {
            const error = e as Error;
            console.error('LLM job match processing error:', error.message, error.stack);
            return res
                .status(500)
                .send({ error: 'Failed to match jobs due to an internal processing error.' });
        }
    });

    api.post<{ Body: JobFeedbackBody }>(
        '/match-job/feedback',
        {
            schema: { body: jobFeedbackSchema },
            preHandler: (req, res, done) => {
                if (!req.session.userId) {
                    res.status(401).send({ error: 'Not authenticated' });
                    return done(new Error('Not authenticated'));
                }
                done();
            },
        },
        async (req, res) => {
            const { id, liked } = req.body;
            const jobId = parseInt(id, 10);
            if (isNaN(jobId)) return res.status(400).send({ error: 'Invalid job ID format.' });
            await db('user_job_feedback')
                .insert({ user_id: req.session.userId, job_id: jobId, liked })
                .onConflict(['user_id', 'job_id'])
                .merge();
            return res.send({ status: 'ok' });
        }
    );

    api.get('/match-job/liked', async (req, res) => {
        if (!req.session.userId) return res.status(401).send({ error: 'Not authenticated' });
        try {
            const likedFeedback = await db('user_job_feedback')
                .select('job_id')
                .where('user_id', req.session.userId)
                .andWhere('liked', true);

            if (!likedFeedback || likedFeedback.length === 0) {
                return { results: [] }; // No liked jobs
            }

            const likedJobIds = likedFeedback.map((f) => f.job_id);

            const likedJobIdsAsStrings = likedJobIds.map((id) => String(id));

            const likedJobs = await db('job_postings_details')
                .select('id', 'title', 'location', 'compensation', 'summary')
                .whereIn('id', likedJobIdsAsStrings); // Use WHERE IN with string IDs

            return { results: likedJobs };
        } catch (e) {
            console.log(e);
        }
    });

    api.get('/profile', async (req, res) => {
        if (!req.session.userId) return res.status(401).send({ error: 'Not authenticated' });
        const profile = await db('user_profile')
            .select(
                'skills',
                'experience',
                'total_experience_years',
                'career_level',
                'category',
                'summary'
            )
            .where('user_id', req.session.userId)
            .first();
        if (!profile) return res.status(404).send({ error: 'Profile not found' });
        profile.total_experience_years = Number(profile.total_experience_years);
        if (profile.experience && !Array.isArray(profile.experience)) {
            profile.experience = Object.values(profile.experience as any);
        } else if (!profile.experience) {
            profile.experience = [];
        }
        return { data: profile };
    });

    api.get('/auth/me', async (req, res) => {
        if (!req.session.userId) return res.status(401).send({ error: 'Not authenticated' });
        return { userId: req.session.userId, email: req.session.email, name: req.session.name };
    });

    api.get('/logout', async (req, res) => {
        await req.session.destroy();
        return res.status(200).send({});
    });
}
