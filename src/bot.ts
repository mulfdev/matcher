import PDFParser from 'pdf2json';
import { Bot } from 'grammy';
import got from 'got';
import { pipeline } from 'stream/promises';
import { createId } from '@paralleldrive/cuid2';
import { createWriteStream, existsSync } from 'fs';
import { z } from 'zod';
import { formatStructuredText } from './core.js';

const { BOT_TOKEN } = process.env;

if (!BOT_TOKEN) {
    throw new Error('Bot token must be set');
}

const DocumentMessageSchema = z.object({
    message: z.object({
        document: z.object({
            file_id: z.string(),
            file_name: z.string().optional(),
            mime_type: z.string().optional(),
            file_size: z.number().optional(),
        }),
    }),
});

export const bot = new Bot(BOT_TOKEN);
const pdfParser = new PDFParser();

bot.command('start', (ctx) => ctx.reply('Welcome! Up and running.'));
// bot.on('message', (ctx) => ctx.reply('Got another message!'));
bot.on(':document', async (ctx) => {
    const result = DocumentMessageSchema.safeParse(ctx.update);

    if (!result.success) {
        return ctx.reply('there was a problem with your request');
    }
    console.log(ctx.update);
    const document = result.data.message.document;
    console.log('Received document:', document.file_id);

    try {
        const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${document.file_id}`;
        const fileUrl = await got.get(getFileUrl).json();

        console.log(fileUrl.result);

        const filePath = `./${createId()}`;
        await pipeline(
            got.stream(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileUrl.result.file_path}`),

            createWriteStream(filePath)
        );

        if (!existsSync(filePath)) {
            return ctx.reply('could not save your file');
        }

        pdfParser.on('pdfParser_dataError', (errData) => console.error(errData.parserError));
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            const structured = formatStructuredText(pdfData as any);
            console.log('✅ Structured resume saved as JSON.');
            console.log(structured);
        });

        pdfParser.loadPDF(filePath);
    } catch (e) {
        console.log(e);
    }
    ctx.reply('got document');
});
