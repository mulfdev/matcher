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

const { GOOGLE_CLIENT_ID, COOKIE_SECRET } = process.env;

assert(typeof GOOGLE_CLIENT_ID === 'string', 'GOOGLE_CLIENT_ID must be defined');
assert(typeof COOKIE_SECRET === 'string', 'COOKIE_SECRET must be set');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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

    const file = await data.toBuffer();

    console.log(file)

    return reply.send({ message: 'File uploaded successfully' });
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
