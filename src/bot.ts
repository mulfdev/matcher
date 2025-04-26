import 'dotenv/config';

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
import OpenAI from 'openai';
import { db, llm, type MessageContent } from './core.js';
import type { JobPostingsDetails } from '../types.js';

type SimilarityResult = JobPostingsDetails & { similarity: number };

type FileResult = {
    result?: {
        file_path?: string;
    };
};

const { BOT_TOKEN } = process.env;

ok(BOT_TOKEN, 'BOT_TOKEN MUST BE DEFINED');

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

const embeder = new OpenAI();

bot.command('start', (ctx) =>
    ctx.reply(
        'Welcome to the Matcher. I am here to help you find your pefect job matches! Please provide your resume in PDF format to begin!'
    )
);
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
        const fileUrl = (await got.get(getFileUrl).json()) as FileResult;

        ok(fileUrl.result);

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

        ctx.reply(
            "Got your info here, I'm processing it now to add you to my system 💪\n\nOne moment Please"
        );

        const base64Images: MessageContent[] = await Promise.all(
            jpgFiles.map(async (file) => {
                const fullPath = join(subDir, file);
                const data = await readFile(fullPath);
                return {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${data.toString('base64')}`,
                        detail: 'auto',
                    },
                };
            })
        );

        await llm({ base64Images });

        // const comp = await openai.chat.completions.create({
        //     model: 'meta-llama/llama-4-maverick',
        //     max_tokens: 1000,
        //     temperature: 0.4,
        //     top_p: 0.8,
        //     messages: [
        //         { role: 'system', content: systemPrompt },
        //         {
        //             role: 'user',
        //             content: base64Images,
        //         },
        //     ],
        // });

        //         ctx.reply('Analysis Complete ✅\n\nmatching you now');
        //         ok(
        //             comp.choices[0] &&
        //                 comp.choices[0].message &&
        //                 typeof comp.choices[0].message.content === 'string'
        //         );
        //
        //         const agentRes = comp.choices[0].message.content;
        //
        //         console.log(agentRes);
        //
        //         const embeddingResponse = await embeder.embeddings.create({
        //             model: 'text-embedding-3-small',
        //             input: agentRes,
        //             encoding_format: 'float',
        //         });
        //
        //         ok(embeddingResponse.data[0] && embeddingResponse.data[0].embedding);
        //
        //         const embedding = embeddingResponse.data[0].embedding;
        //
        //         const vectorString = `[${embedding.join(',')}]`;
        //
        //         // Min 80% to show result
        //
        //         const results = (await db<SimilarityResult>('job_postings_details')
        //             .select(
        //                 'text',
        //                 'title',
        //                 'location',
        //                 'compensation',
        //                 'summary',
        //                 db.raw('embeddings <-> ?::vector(1536) AS similarity', [vectorString])
        //             )
        //             .orderBy('similarity', 'asc')
        //             .limit(25)) as SimilarityResult[];
        //
        //         const replyItems = [];
        //
        //         console.log(results);
        //         for (const job of results) {
        //             replyItems.push(`
        // **Title:** ${job.title}
        // **Location:** ${job.location}
        // **Compensation:** ${job.compensation}
        // **Summary:** ${job.summary}
        // `);
        //         }
        //
        //         const replyMessage = `Heres what i found for you!\n\n${replyItems.join('\n\n')}`;
        //
        //         await ctx.reply(replyMessage, { parse_mode: 'Markdown' });

        // TODO: Inject match feedback into matching. start list of liked jobs and add that into
        //the matching process. every job that got a thumbs up, add that into match
        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
});
