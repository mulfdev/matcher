import { ok } from 'assert';
import Knex from 'knex';

const { DB_HOST, DB_PORT, DB_NAME, DB_USER } = process.env;

ok(DB_HOST && DB_PORT && DB_NAME && DB_USER, 'DB env vars must be set');

const config = {
    client: 'pg',
    connection: {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
    },
};

export const db = Knex(config);
