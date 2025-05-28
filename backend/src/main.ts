import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { dirname, join } from 'path';
import { db } from './core.js';
import { ConnectSessionKnexStore } from 'connect-session-knex';

import fastifyStatic from '@fastify/static';
import assert from 'assert';
import { apiRoutes } from './handlers/apiHandlers.js';
import { fileURLToPath } from 'url';

const { COOKIE_SECRET, NODE_ENV } = process.env;

assert(typeof COOKIE_SECRET === 'string', 'COOKIE_SECRET must be set');

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

app.register(fastifyMultipart, {
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1,
    },
});

//
// ROUTES

app.register(apiRoutes, { prefix: '/api' });

if (NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const clientDistPath = join(__dirname, '..', 'client');
    console.log(`Production mode: Static assets served from: ${clientDistPath}`);

    app.register(fastifyStatic, {
        root: clientDistPath,
    });

    app.setNotFoundHandler((_, res) => {
        res.sendFile('index.html');
    });
}

const start = async () => {
    try {
        await app.listen({
            host: '0.0.0.0',
            port: 3000,
        });

        console.log('Server running!');
    } catch (err) {
        app.log.error(err);
        console.log(err);
        process.exit(1);
    }
};
start().catch((err) => {
    console.log('could not start server', err);
});
