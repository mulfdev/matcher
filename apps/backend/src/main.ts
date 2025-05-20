import assert from 'assert';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { OAuth2Client } from 'google-auth-library';
import type { SimilarityResult } from '../types.js';
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
import { ConnectSessionKnexStore } from 'connect-session-knex';
import got from 'got';

import type { FastifyRequest } from 'fastify';

interface GoogleCallbackQuery {
    code: string;
}

const { GOOGLE_CLIENT_ID, COOKIE_SECRET, BASE_URL, FRONTEND_URL, GOOGLE_CLIENT_SECRET } =
    process.env;

assert(typeof GOOGLE_CLIENT_ID === 'string', 'GOOGLE_CLIENT_ID must be defined');
assert(typeof COOKIE_SECRET === 'string', 'COOKIE_SECRET must be set');
assert(typeof BASE_URL === 'string', 'BASE_URL must be set');
assert(typeof FRONTEND_URL === 'string', 'FRONTEND_URL must be set');
assert(typeof GOOGLE_CLIENT_SECRET === 'string', 'GOOGLE_CLIENT_SECRET must be set');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const poppler = new Poppler();

const app = Fastify({
    logger: false,
});

//
// PLUGINS
//

const store = new ConnectSessionKnexStore({
    knex: db,
    tableName: 'sessions',
});

app.register(cookie);

app.register(fastifySession, {
    secret: COOKIE_SECRET,
    store,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // In milliseconds
    },
    saveUninitialized: false,
});
app.register(cors, {
    origin: ['https://matcher.pages.dev', 'http://localhost:5173'],
    credentials: true,
});

app.register(fastifyMultipart, {
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1,
    },
});

//
// ROUTES
//

app.get('/', () => {
    return { hello: 'world' };
});

app.get('/auth/google', async (_, res) => {
    const redirectUri = `${BASE_URL}/auth/google/callback`;

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

app.get(
    '/auth/google/callback',
    async (req: FastifyRequest<{ Querystring: GoogleCallbackQuery }>, res) => {
        try {
            const { code } = req.query;
            const redirectUri = `${BASE_URL}/auth/google/callback`;

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
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            if (!payload || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
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

            res.redirect(`${FRONTEND_URL}/dashboard`);
        } catch (e) {
            console.log(e);
            res.status(500).send('OAuth callback error');
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
        await app.listen({
            host: '0.0.0.0',
            port: 3000,
        });

        console.log('Server running!');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start().catch((err) => {
    console.log('could not start server', err);
});
