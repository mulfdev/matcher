import 'dotenv/config';

const config = {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
        directory: './migrations',
        extension: 'ts',
    },
};

export default config;
