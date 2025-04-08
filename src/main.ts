import { createApp, toNodeListener, setResponseStatus } from 'h3';
import { createServer } from 'http';

const app = createApp();

app.use('/healthcheck', (evt) => {
    setResponseStatus(evt, 200);
    return { status: 'OK' };
});

createServer(toNodeListener(app)).listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
