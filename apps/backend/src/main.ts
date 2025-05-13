import assert from 'assert';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { OAuth2Client } from 'google-auth-library';
import type { AuthBody, SimilarityResult } from '../types.js';
import { createId } from '@paralleldrive/cuid2';
import { join } from 'path';
import { mkdirSync, existsSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { readdir, readFile, rm } from 'fs/promises';
import { Poppler } from 'node-poppler';
import {
    db,
    embedder,
    ensureNumericVector,
    llm,
    weightedVectorCombine,
    type MessageContent,
} from './core.js';

const { GOOGLE_CLIENT_ID, COOKIE_SECRET } = process.env;

assert(typeof GOOGLE_CLIENT_ID === 'string', 'GOOGLE_CLIENT_ID must be defined');
assert(typeof COOKIE_SECRET === 'string', 'COOKIE_SECRET must be set');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const poppler = new Poppler();

const app = Fastify({
    logger: false,
});

// PLUGINS

app.register(cookie);

app.register(fastifySession, {
    secret: COOKIE_SECRET,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // In milliseconds
    },
    saveUninitialized: false,
});
app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
});

app.register(fastifyMultipart, {
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1,
    },
});

// ROUTES

app.get('/', () => {
    return { hello: 'world' };
});

app.post<{ Body: AuthBody }>(
    '/auth/google',
    {
        schema: {
            body: {
                type: 'object',
                required: ['credential'],
                properties: {
                    credential: { type: 'string' },
                },
            },
        },
    },
    async (req, res) => {
        try {
            const ticket = await client.verifyIdToken({
                idToken: req.body.credential,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            if (!payload) {
                return await res.status(401).send({ error: 'Bad req' });
            }

            if (typeof payload.email !== 'string') {
                return await res.status(400).send({ error: 'Could not get email' });
            }

            if (typeof payload.name !== 'string') {
                return await res.status(400).send({ error: 'Could not get name' });
            }

            let user = await db('user').where('oauth_user_id', payload.sub).select('id').first();

            if (!user) {
                console.log('created user');
                const insertedUsers = await db('user').insert(
                    {
                        id: createId(),
                        oauth_user_id: payload.sub,
                        oauth_provider: 'google',
                        email: payload.email,
                        name: payload.name,
                    },
                    ['id']
                );

                user = insertedUsers[0];
            }

            if (user === undefined) {
                throw new Error('Could not find or create user');
            }

            req.session.userId = user.id;
            req.session.email = payload.email;
            req.session.name = payload.name;

            await req.session.save();

            return {
                email: payload.email,
                name: payload.name,
                userId: payload.sub,
            };
        } catch (error) {
            console.log(error);
            res.status(401).send({ error: 'Invalid token' });
        }
    }
);

app.post(
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
            const { skills, experience, total_experience_years, career_level, category, summary } =
                await llm({ base64Images });

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
                    skills,
                    experience: { ...experience },
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

app.get('/match-job', async (req, res) => {
    if (!req.session.userId) {
        return res.status(400).send({ error: 'must be signed in' });
    }

    const [userEmbeddings] = await db('user_profile')
        .select('skill_embedding', 'summary_embedding')
        .where('user_id', req.session.userId);

    if (!userEmbeddings) {
        throw new Error('User has not been onboarded yet');
    }

    const combined = weightedVectorCombine(
        ensureNumericVector(userEmbeddings.skill_embedding),
        ensureNumericVector(userEmbeddings.summary_embedding),
        0.25,
        0.75
    );

    const results = await db<SimilarityResult>('job_postings_details')
        .select(
            'id',
            'title',
            'location',
            'compensation',
            'summary',
            db.raw('(skill_embedding <-> ?::vector(1536)) AS similarity', [
                `[${combined.join(',')}]`,
            ])
        )
        .orderBy('similarity', 'asc')
        .limit(7);

    return {
        results,
    };
});

app.get('/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send({ error: 'Not authenticated' });
    }

    return {
        userId: req.session.userId,
        email: req.session.email,
        name: req.session.name,
    };
});

app.get('/logout', async (req, res) => {
    await req.session.destroy();
    res.clearCookie('sessionId');
    return res.status(200).send({});
});

app.get('/start-sse', (req, res) => {
    if (!req.session.userId) {
        throw new Error('Not logged in');
    }

    res.headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    res.raw.flushHeaders();

    res.raw.on('close', () => {
        console.log('connection closed');
    });
});

const start = async () => {
    try {
        const address = await app.listen({
            host: '0.0.0.0',
            port: 3000,
            listenTextResolver: (address) => `Server listening at ${address}`,
        });
        app.log.info(`Server is ready at ${address}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start().catch((err) => {
    console.log('could not start server', err);
});
