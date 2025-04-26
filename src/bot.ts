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
import { db } from './core.js';
import type { JobPostingsDetails } from '../types.js';

type SimilarityResult = JobPostingsDetails & { similarity: number };

type MessageContent =
    | { type: 'text'; text: string }
    | {
          type: 'image_url';
          image_url: {
              url: string;
              detail: 'auto';
          };
      };
type FileResult = {
    result?: {
        file_path?: string;
    };
};

const { BOT_TOKEN, OPENROUTER_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER } = process.env;

ok(BOT_TOKEN, 'BOT_TOKEN MUST BE DEFINED');
ok(OPENROUTER_KEY, 'OPENROUTER_KEY MUST BE DEFINED');

ok(DB_HOST && DB_PORT && DB_NAME && DB_USER, 'DB env vars must be set');

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

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_KEY,
});

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

        const systemPrompt = `Here is the resume content to analyze:



You are an expert resume analyst tasked with classifying and summarizing a candidate's skills and experience for potential job placement. Your analysis will be used in a vector search system for retrieval-augmented generation, so it's crucial to provide structured, detailed, and easily retrievable information.

The current year is 2025 as of right now.

Please follow these steps to analyze the resume:

1. Carefully read through the entire resume content.
2. Analyze the candidate's skills, experience, and career level.
3. provide your analysis to break down your thought process for each section before compiling the final output.


During your analysis, consider the following:

- Skills: Only include skills explicitly mentioned in the resume. Do not add any skills that aren't listed in the provided content.
- Experience: Break down the job history into individual items.
- Career Level: Estimate the candidate's career level based on their years of experience and job titles.
- Category: Classify the candidate into one of the following categories: "engineer/developer", "designer", "business development", "human resources and people operations", "developer relations".

- Extract and list all relevant skills mentioned in the resume. Count and number each skill as you list it.
- Break down each job experience, noting the title, company, and duration. Calculate and note the duration for each position.
- Calculate the total years of experience by summing up the durations from each position.
- Determine the most appropriate career level and category. Consider arguments for different levels and categories before making a final decision.
- Synthesize the information to create a concise yet informative summary.


Begin your analysis now. Dont reply with markdown, just normal text`;

        const comp = await openai.chat.completions.create({
            model: 'meta-llama/llama-4-maverick',
            max_tokens: 1000,
            temperature: 0.4,
            top_p: 0.8,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: base64Images,
                },
            ],
        });

        ctx.reply('Analysis Complete ✅\n\nmatching you now');
        ok(
            comp.choices[0] &&
                comp.choices[0].message &&
                typeof comp.choices[0].message.content === 'string'
        );

        const agentRes = comp.choices[0].message.content;

        console.log(agentRes);

        const embeddingResponse = await embeder.embeddings.create({
            model: 'text-embedding-3-small',
            input: agentRes,
            encoding_format: 'float',
        });

        ok(embeddingResponse.data[0] && embeddingResponse.data[0].embedding);

        const embedding = embeddingResponse.data[0].embedding;

        const vectorString = `[${embedding.join(',')}]`;

        // Min 80% to show result

        const results = (await db<SimilarityResult>('job_postings_details')
            .select(
                'text',
                'title',
                'location',
                'compensation',
                'summary',
                db.raw('embeddings <-> ?::vector(1536) AS similarity', [vectorString])
            )
            .orderBy('similarity', 'asc')
            .limit(25)) as SimilarityResult[];

        const replyItems = [];

        console.log(results);
        for (const job of results) {
            replyItems.push(`
**Title:** ${job.title}
**Location:** ${job.location}
**Compensation:** ${job.compensation}
**Summary:** ${job.summary}
`);
        }

        const replyMessage = `Heres what i found for you!\n\n${replyItems.join('\n\n')}`;

        await ctx.reply(replyMessage, { parse_mode: 'Markdown' });

        // TODO: Inject match feedback into matching. start list of liked jobs and add that into
        //the matching process. every job that got a thumbs up, add that into match
        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
});
