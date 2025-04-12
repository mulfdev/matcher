import 'dotenv/config';
import { agent, AgentStream, tool, openai, Settings } from 'llamaindex';
import { z } from 'zod';
import { Bot } from 'grammy';
import got from 'got';
import { ok } from 'assert';
import { pipeline } from 'stream/promises';
import { createId } from '@paralleldrive/cuid2';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { Poppler } from 'node-poppler';

type MessageContent = { type: 'text'; text: string } | { type: 'image_url'; image_url: string };

const { BOT_TOKEN, OPENROUTER_KEY } = process.env;

ok(BOT_TOKEN, 'BOT_TOKEN MUST BE DEFINED');
ok(OPENROUTER_KEY, 'OPENROUTER_KEY MUST BE DEFINED');

const baseDir = join(process.cwd(), 'tmp');

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
const poppler = new Poppler();

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

        const tempDir = createId();
        const subDir = join(baseDir, tempDir);
        mkdirSync(subDir, { recursive: true });

        const pdfPath = `./tmp/${tempDir}/${createId()}.pdf`;
        const imgPath = `./tmp/${tempDir}/${createId()}`;

        await pipeline(
            got.stream(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileUrl.result.file_path}`),

            createWriteStream(pdfPath)
        );

        if (!existsSync(pdfPath)) {
            return ctx.reply('could not save your file');
        }
        await poppler.pdfToCairo(pdfPath, imgPath, {
            jpegFile: true,
            resolutionXAxis: 72,
            resolutionYAxis: 72,
        });

        const files = await readdir(subDir);

        const jpgFiles = files.filter(
            (file) => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')
        );

        const base64Images: MessageContent[] = await Promise.all(
            jpgFiles.map(async (file) => {
                const fullPath = join(subDir, file);
                const data = await readFile(fullPath);
                return {
                    type: 'image_url',
                    image_url: `data:image/jpeg;base64,${data.toString('base64')}`,
                };
            })
        );

        // const textBlock: MessageContent[] = [
        //     {
        //         type: 'text',
        //         text: 'classify this person based on their resume, i have included images of each page of their resume, ensure you understand the content, think step by step about the candidate, their skills and experience and tell me what you think of their skills',
        //     },
        // ];
        // const contentArray = textBlock.concat(base64Images);
        //
        // const body = {
        //     model: 'meta-llama/llama-4-maverick',
        //     messages: [
        //         {
        //             role: 'user',
        //             content: contentArray,
        //         },
        //     ],
        //     max_tokens: 800,
        //     temperature: 0.2,
        //     top_p: 1,
        //     presence_penalty: 0.1,
        //     frequency_penalty: 0.3,
        // };
        //
        // const response = await got.post('https://openrouter.ai/api/v1/chat/completions', {
        //     headers: {
        //         Authorization: `Bearer ${OPENROUTER_KEY}`,
        //         'Content-Type': 'application/json',
        //         'X-OpenRouter-Provider': 'lambda',
        //     },
        //     json: body,
        //     responseType: 'json',
        // });
        //
        // console.log(JSON.stringify(response.body, null, 2));
        //
        Settings.llm = openai({
            apiKey: OPENROUTER_KEY,
            model: 'meta-llama/llama-4-maverick',
        });

        const sumNumbers = ({ a, b }: { a: number; b: number }) => {
            return `${a + b}`;
        };

        const addTool = tool({
            name: 'sumNumbers',
            description: 'Use this function to sum two numbers',
            parameters: z.object({
                a: z.number({
                    description: 'First number to sum',
                }),
                b: z.number({
                    description: 'Second number to sum',
                }),
            }),
            execute: sumNumbers,
        });

        const myAgent = agent({ tools: [addTool] });
        const context = myAgent.run('Sum 101 and 303');
        const result = await context;
        console.log(result.data);
        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
    await ctx.reply('got document');
});
