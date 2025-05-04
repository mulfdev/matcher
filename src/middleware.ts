// src/middleware.ts
import { GrammyError, HttpError, session } from 'grammy';

export const sessionMiddleware = session({
    initial: () => ({
        matches: [],
        index: 0,
    }),
});

export function errorHandler(err: any) {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error('Error in request:', e.description);
    } else if (e instanceof HttpError) {
        console.error('Could not contact Telegram:', e);
    } else {
        console.error('Unknown error:', e);
    }
}
