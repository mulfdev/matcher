import '@fastify/session';

declare module 'fastify' {
    interface Session {
        userId: string;
        email: string;
        name: string;
    }
}

import type { authSchema } from './schemas.js';

type InferSchemaType<T> = T extends { properties: infer P }
    ? {
          [K in keyof P]: P[K] extends { type: 'string' }
              ? string
              : P[K] extends { type: 'number' }
                ? number
                : P[K] extends { type: 'boolean' }
                  ? boolean
                  : P[K] extends { type: 'object' }
                    ? InferSchemaType<P[K]>
                    : P[K] extends { type: 'array' }
                      ? unknown[]
                      : unknown;
      }
    : never;

export type AuthBody = InferSchemaType<typeof authSchema>;
