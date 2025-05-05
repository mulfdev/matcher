import assert from 'assert';
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const { DATABASE_URL } = process.env;

assert(typeof DATABASE_URL === 'string', 'Database url must be set');

export default defineConfig({
    out: './drizzle',
    schema: './db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: DATABASE_URL,
    },
});
