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
            "Got your info here, I'm processing it now to add you to my system 💪\nOne moment Please"
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

        const systemPrompt = `classify this person based on their resume, i have included images of each page of their resume, ensure you understand the content, think step by step about the candidate, their skills and experience and tell me what you think of their skills. be firm and discerning. we are looking to place this person in a job that is the BEST fit possible so we need to have an accurate understanding of their skills. parse their skills section of a resume if its there. look at their jobs one by one to get a better understanding of their experience. look for any projects listed as well to see non work related experiences as well. we don't care about specific company names. make sure to summarize your findings in a high level yet detailed manner. 

list our the the rough years of experience this person has as well to understand their career level

you must response in a JSON format that matches this: 

the 'catergory' is fixed - use the options provided, 'level' is where you think they are in their careers based on your analysis - only use traditional career ladder identifiers here: junior, mid, mid-senior, senior, staff, etc... / the summary is where your synthsis goes. YOU MUST follow this structure when responsing. DO NOT PROVIDE MARKDOWN EVER. ONLY EVER RESPONSED WITH THE FOLLOWING FORMAT IN JSON!!

for skills: ONLY pull items from the provided documents. DO NOT ADD ANY SKILLS that arent listed in the provided images, EVER!

for experience: break up the jobs into individual items and put them in an array of objects, follow this format for Jobs: {title: string, years: string, company: string}

            catergory: "engineer/developer, designer, business developmment, human resources and people operations, developer relations",
            level: string,
            skills: Jobs[],
            experience: string[],
            summary: string, 
`;

        const comp = await openai.chat.completions.create({
            model: 'meta-llama/llama-4-maverick',
            max_tokens: 1000,
            temperature: 0.6,
            top_p: 0.8,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: base64Images,
                },
            ],
        });

        ctx.reply('Analysis Complete ✅\nmatching you now');
        ok(
            comp.choices[0] &&
                comp.choices[0].message &&
                typeof comp.choices[0].message.content === 'string'
        );

        const agentRes = comp.choices[0].message.content;

        const recuiterPrompt =
            'You are the best recruiter known to man, you live to place people in the job best to them. take this info and match this person to the best job we have in our listings. you get a HUGE bonus for good matches that accept job offers';
        const combinedQuery = `${recuiterPrompt}\n\n${agentRes}`;

        const embeddingResponse = await embeder.embeddings.create({
            model: 'text-embedding-3-small',
            input: combinedQuery,
            encoding_format: 'float',
        });

        ok(embeddingResponse.data[0] && embeddingResponse.data[0].embedding);

        const embedding = embeddingResponse.data[0].embedding;

        const vectorString = `[${embedding.join(',')}]`;

        const result = await db.raw(
            `
      SELECT id, text, title, location, compensation, summary,
             embeddings <-> ?::vector(1536) AS similarity
      FROM job_postings_details
      ORDER BY similarity ASC
      LIMIT 5;
    `,
            [vectorString]
        );

        console.log(result.rows);

        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
});
