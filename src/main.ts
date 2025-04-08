import 'dotenv/config';
import {
    createApp,
    toNodeListener,
    setResponseStatus,
    createRouter,
    defineEventHandler as handler,
} from 'h3';
import { createServer } from 'http';

const app = createApp();

const router = createRouter();
app.use(router);

router.get(
    '/',
    handler(() => {
        return { message: 'hello' };
    })
);

router.get(
    '/healthcheck',
    handler((evt) => {
        setResponseStatus(evt, 200);
        return { status: 'OK' };
    })
);

createServer(toNodeListener(app)).listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
