import { build } from 'esbuild';

build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    outfile: '../../dist/server.js',
    external: [
        'mysql',
        'mysql2',
        'better-sqlite3',
        'oracledb',
        'pg-query-stream',
        'tedious',
        'oracledb',
        'sqlite3',
    ],
}).catch(() => process.exit(1));
