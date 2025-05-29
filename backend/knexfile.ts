import type { Knex } from 'knex';
import 'dotenv/config';

const config: Knex.Config = {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
        directory: './migrations',
        extension: 'ts',
    },
};

export default config;
