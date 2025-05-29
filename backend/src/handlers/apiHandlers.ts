import { type FastifyInstance, type FastifyRequest } from 'fastify';
import got from 'got';
import assert from 'assert';
import { db, embedder, llm, type MessageContent } from '../core.js';
import { OAuth2Client } from 'google-auth-library';
import { createId } from '@paralleldrive/cuid2';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { readdir, readFile, rm } from 'fs/promises';
import type { JobFeedbackBody } from '../../types.js';
import { jobFeedbackSchema } from '../routeSchema.js';
import { Poppler } from 'node-poppler';

interface GoogleCallbackQuery {
    code: string;
}

export function apiRoutes(api: FastifyInstance) {
    const { GOOGLE_CLIENT_ID, BASE_URL, GOOGLE_CLIENT_SECRET } = process.env;

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

                    if (insertedUser) {
                        user = {
                            id: insertedUser.id,
                            oauth_user_id: payload.sub,
                            oauth_provider: 'google',
                            email: payload.email,
                            name: payload.name,
                        };
                    }
                }

                if (user === undefined) {
                    throw new Error('Could not find or create user');
                }

                req.session.userId = user.id;
                req.session.email = user.email;
                req.session.name = user.name;
                await req.session.save();

                res.redirect(`${BASE_URL}/dashboard`);
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
            if (!data) {
                return res.status(400).send({ error: 'No file uploaded' });
            }

            if (data.mimetype !== 'application/pdf') {
                return res.status(400).send({ error: 'Only PDF files are allowed' });
            }

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

            if (!existsSync(pdfPath)) {
                return res.status(500).send({ error: 'Failed to save uploaded file' });
            }

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
                    const data = await readFile(fullPath);
                    return {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${data.toString('base64')}`,
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
                const skillsEmbedding = await embedder.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: skillsText,
                    encoding_format: 'float',
                });

                const summaryEmbedding = await embedder.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: summary,
                    encoding_format: 'float',
                });

                if (!skillsEmbedding?.data?.[0]?.embedding) {
                    throw new Error('Could not generate embeddings for skills');
                }

                if (!summaryEmbedding?.data?.[0]?.embedding) {
                    throw new Error('Could not generate embeddings for skills');
                }

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
                            `[${summaryEmbedding.data[0].embedding.join(',')}]`,
                        ]),
                        skill_embedding: db.raw('?::vector(1536)', [
                            `[${skillsEmbedding.data[0].embedding.join(',')}]`,
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

    // LLM-only job matching endpoint
    api.get('/match-job', async (req, res) => {
        if (!req.session.userId) {
            return res.status(400).send({ error: 'must be signed in' });
        }

        // Fetch user profile
        const userProfile = await db('user_profile')
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

        if (!userProfile) {
            return res.status(400).send({ error: 'User profile not found' });
        }

        // Exclude jobs the user has already given feedback on
        const feedbacks = await db('user_job_feedback')
            .select('job_id', 'liked')
            .where('user_id', req.session.userId);

        const excludedJobIds = feedbacks.map((f) => f.job_id);

        // Fetch a batch of jobs to consider (limit to 30 for LLM context)
        const jobsRaw = await db('job_postings_details')
            .select('id', 'title', 'location', 'compensation', 'summary')
            .whereNotIn('id', excludedJobIds)
            .limit(30);

        // Ensure there are jobs to send to the LLM
        if (jobsRaw.length === 0) {
            return res.status(404).send({ error: 'No jobs available for matching.' });
        }

        // Fix: Ensure all required fields are present and types are correct
        const jobs = jobsRaw
            .filter(
                (
                    j
                ): j is {
                    id: string;
                    title: string;
                    location?: string;
                    compensation?: string;
                    summary?: string;
                } => typeof j.id === 'string' && typeof j.title === 'string'
            )
            .map((j) => ({
                id: j.id,
                title: j.title,
                location: j.location ?? undefined,
                compensation: j.compensation ?? undefined,
                summary: j.summary ?? undefined,
            }));

        try {
            const { llmJobMatch } = await import('../core.js');
            const ranked = await llmJobMatch({
                userProfile,
                jobs,
                maxResults: 7,
            });

            // Attach job details and reasons
            const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));
            const results = ranked.map((r: { id: string; score: number; reason?: string }) => ({
                ...jobMap[r.id],
                score: r.score,
                reason: r.reason,
            }));

            return { results };
        } catch (e) {
            console.error('LLM job match error:', e);
            return res.status(500).send({ error: 'Failed to match jobs' });
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
            await db('user_job_feedback')
                .insert({ user_id: req.session.userId, job_id: jobId, liked })
                .onConflict(['user_id', 'job_id'])
                .merge();
            return res.send({ status: 'ok' });
        }
    );

    api.get('/match-job/liked', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).send({ error: 'Not authenticated' });
        }
        const likedJobs = await db('job_postings_details')
            .select('id', 'title', 'location', 'compensation', 'summary')
            .join('user_job_feedback', 'job_postings_details.id', 'user_job_feedback.job_id')
            .where('user_job_feedback.user_id', req.session.userId)
            .andWhere('user_job_feedback.liked', true);

        return { results: likedJobs };
    });

    api.get('/profile', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).send({ error: 'Not authenticated' });
        }
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
        if (!profile) {
            return res.status(404).send({ error: 'Profile not found' });
        }
        profile.total_experience_years = Number(profile.total_experience_years);
        if (!Array.isArray(profile.experience)) {
            profile.experience = Object.values(profile.experience);
        }
        return { data: profile };
    });

    api.get('/auth/me', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).send({ error: 'Not authenticated' });
        }

        return {
            userId: req.session.userId,
            email: req.session.email,
            name: req.session.name,
        };
    });

    api.get('/logout', async (req, res) => {
        await req.session.destroy();
        return res.status(200).send({});
    });
}
