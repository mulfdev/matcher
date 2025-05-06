import assert from 'assert';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { OAuth2Client } from 'google-auth-library';
import type { AuthBody } from './types.js';
import { authSchema } from './schemas.js';
import { createId } from '@paralleldrive/cuid2';
import { join } from 'path';
import { mkdirSync, existsSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { readdir, readFile, rm } from 'fs/promises';
import { Poppler } from 'node-poppler';
import { llm, type MessageContent } from './core.js';

const { GOOGLE_CLIENT_ID, COOKIE_SECRET } = process.env;

assert(typeof GOOGLE_CLIENT_ID === 'string', 'GOOGLE_CLIENT_ID must be defined');
assert(typeof COOKIE_SECRET === 'string', 'COOKIE_SECRET must be set');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const poppler = new Poppler();

const app = Fastify({
    logger: true,
});

// PLUGINS

app.register(cookie);

app.register(fastifySession, {
    secret: COOKIE_SECRET,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
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
            body: authSchema,
        },
    },
    async (request, reply) => {
        try {
            const ticket = await client.verifyIdToken({
                idToken: request.body.credential,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            if (!payload) {
                return await reply.status(401).send({ error: 'Bad request' });
            }

            if (typeof payload.email !== 'string') {
                return await reply.status(400).send({ error: 'Could not get email' });
            }

            if (typeof payload.name !== 'string') {
                return await reply.status(400).send({ error: 'Could not get name' });
            }

            request.session.userId = payload.sub;
            request.session.email = payload.email;
            request.session.name = payload.name;
            await request.session.save();

            return {
                email: payload.email,
                name: payload.name,
                userId: payload.sub,
            };
        } catch (error) {
            console.log(error);
            reply.status(401).send({ error: 'Invalid token' });
        }
    }
);


app.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
    }

    if (data.mimetype !== 'application/pdf') {
        return reply.status(400).send({ error: 'Only PDF files are allowed' });
    }

    const fileBuffer = await data.toBuffer();

    // Save file to temp directory
    const tempDir = createId();
    const baseTempDir = join(process.cwd(), 'tmp', tempDir);
    mkdirSync(baseTempDir, { recursive: true });

    const pdfPath = join(baseTempDir, `${createId()}.pdf`);

    await pipeline(
        async function*() {
            yield fileBuffer
            await Promise.resolve();
        }(),
        createWriteStream(pdfPath)
    );

    if (!existsSync(pdfPath)) {
        return reply.status(500).send({ error: 'Failed to save uploaded file' });
    }

    // Convert PDF pages to JPEG images
    const imgPath = join(baseTempDir, createId());

    await poppler.pdfToCairo(pdfPath, imgPath, {
        jpegFile: true,
        resolutionXAxis: 72,
        resolutionYAxis: 72,
    });

    // Read JPEG files
    const files = await readdir(baseTempDir);
    const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));

    // Convert JPEGs to base64 images for LLM
    const base64Images: MessageContent[] = await Promise.all(jpgFiles.map(async (file) => {
        const fullPath = join(baseTempDir, file);
        const data = await readFile(fullPath);
        return {
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${data.toString('base64')}`,
                detail: 'auto',
            },
        };
    }));

    try {
        /* const { skills, experience, total_experience_years, career_level, category, summary } = await llm({ base64Images }); */
        const { skills, experience, summary } = await llm({ base64Images });

        // const newUserId = createId();
        // // TODO: Adapt user identification as needed
        // await db('user').insert({
        //     id: newUserId,
        //     skills,
        //     experience: { ...experience },
        //     total_experience_years,
        //     career_level,
        //     category,
        //     summary,
        // });
        //
        console.log(skills, experience, summary)

        await rm(baseTempDir, { recursive: true, force: true });

        return await reply.send({ message: 'File processed and user data saved successfully' });
    } catch (error) {
        console.error(error);
        await rm(baseTempDir, { recursive: true, force: true });
        return reply.status(500).send({ error: 'Failed to process PDF' });
    }
});

app.get('/auth/me', async (request, reply) => {
    if (!request.session.userId) {
        return reply.status(401).send({ error: 'Not authenticated' });
    }

    return {
        userId: request.session.userId,
        email: request.session.email,
        name: request.session.name,
    };
});

app.get('/logout', async (req, reply) => {
    await req.session.destroy();
    reply.clearCookie('sessionId');
    return reply.status(200).send({})
});

const start = async () => {
    try {
        await app.listen({ port: 3000 });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start().catch((err) => {
    console.log('could not start server', err);
});
