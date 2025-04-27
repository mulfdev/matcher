import 'dotenv/config';

import { z } from 'zod';
import { Bot, Context, InlineKeyboard, type CallbackQueryContext } from 'grammy';
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
import type { JobPostingsDetails, User } from '../types.js';

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
        from: z.object({
            id: z.number(),
        }),
        document: z.object({
            file_id: z.string(),
            file_name: z.string().optional(),
            mime_type: z.string().optional(),
            file_size: z.number().optional(),
        }),
    }),
});

const CallbackQuerySchema = z.object({
    from: z.object({ id: z.number() }),
});

export const bot = new Bot(BOT_TOKEN);
const poppler = new Poppler();

const embeder = new OpenAI();

const ACTIONS = {
    MATCH: { id: 'button_1', label: 'Get Matched' },
    PROFILE: { id: 'button_2', label: 'My Profile' },
    BUTTON_3: { id: 'button_3', label: 'Button 3' },
} as const;

function createKeyboard() {
    const keyboard = new InlineKeyboard();
    for (const action of Object.values(ACTIONS)) {
        keyboard.text(action.label, action.id);
    }
    return keyboard;
}

function singleButtonKeyboard(actionId: string) {
    const action = Object.values(ACTIONS).find((a) => a.id === actionId);
    if (!action) throw new Error('Invalid action ID');

    return new InlineKeyboard().text(action.label, action.id);
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatUserProfile(user: User): string {
    const skills = user.skills.map(escapeHtml).join(', ');

    let experience = '';
    for (const key in user.experience) {
        const exp = user.experience[key];

        if (!exp) throw new Error('Could not reply with user profile');

        const responsibilities = exp.responsibilities.map(escapeHtml).join(', ');
        experience += `<b>${escapeHtml(exp.title)}</b> at <i>${escapeHtml(exp.company)}</i> (${escapeHtml(exp.start_date)} - ${escapeHtml(exp.end_date)}): ${responsibilities}\n\n`;
    }

    return `
<b>Career Level:</b> ${escapeHtml(user.career_level)}
<b>Category:</b> ${escapeHtml(user.category)}
<b>Total Experience:</b> ${escapeHtml(user.total_experience_years.toString())} years

<b>Skills:</b>
${skills}

<b>Experience:</b>
${experience}

<b>Summary:</b>
${escapeHtml(user.summary)}`;
}

async function handleButtonPress(ctx: CallbackQueryContext<Context>, actionId: string) {
    switch (actionId) {
        case ACTIONS.MATCH.id: {
            const result = CallbackQuerySchema.safeParse(ctx.update.callback_query);

            console.log(ctx.update.callback_query);

            if (!result.success) {
                return ctx.reply('Could not process your request');
            }

            const existingUser = await db('user')
                .where('telegram_id', result.data.from.id.toString())
                .first();

            console.log(existingUser);

            if (existingUser) {
                const keyboard = singleButtonKeyboard(ACTIONS.PROFILE.id); // pick dynamically
                await ctx.reply("You're already on file!", { reply_markup: keyboard });
                return;
            }

            ctx.reply('Please provide your resume in pdf format');
            break;
        }
        case ACTIONS.PROFILE.id: {
            const result = CallbackQuerySchema.safeParse(ctx.update.callback_query);

            console.log(ctx.update.callback_query);

            if (!result.success) {
                return ctx.reply('Could not process your request');
            }

            const existingUser = await db('user')
                .where('telegram_id', result.data.from.id.toString())
                .first();

            console.log(existingUser);

            if (!existingUser) {
                ctx.reply('No Profile Found, get matched to get started');
                return;
            }

            const message = formatUserProfile(existingUser);
            const keyboard = singleButtonKeyboard(ACTIONS.PROFILE.id); // pick dynamically
            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });

            break;
        }
        case ACTIONS.BUTTON_3.id:
            await ctx.answerCallbackQuery('Handled Button 3');
            break;
        default:
            await ctx.answerCallbackQuery('Unknown action');
    }
}

Object.values(ACTIONS).forEach(({ id }) => {
    bot.callbackQuery(id, (ctx) => handleButtonPress(ctx, id));
});

bot.command('start', (ctx) => {
    return ctx.reply(
        'Welcome to the Matcher. I am here to help you find your pefect job! Please select one of the following',
        { reply_markup: createKeyboard() }
    );
});
// bot.on('message', (ctx) => ctx.reply('Got another message!'));
bot.on(':document', async (ctx) => {
    const result = DocumentMessageSchema.safeParse(ctx.update);

    if (!result.success) {
        return ctx.reply('there was a problem with your request');
    }
    console.log('ctx update', ctx.update);

    const existingUser = await db('user')
        .where('telegram_id', result.data.message.from.id.toString())
        .first();

    console.log(existingUser);

    if (existingUser) {
        const keyboard = singleButtonKeyboard(ACTIONS.PROFILE.id); // pick dynamically
        await ctx.reply("You're already on file!", { reply_markup: keyboard });
        return;
    }

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

        const { skills, experience, total_experience_years, career_level, category, summary } =
            await llm({ base64Images });

        const newUserId = createId();

        await db('user').insert({
            id: newUserId,
            telegram_id: result.data.message.from.id.toString(),
            skills,
            experience: { ...experience },
            total_experience_years,
            career_level,
            category,
            summary,
        });

        const skillsText = skills.join(', ');
        const skillsEmbedding = await embeder.embeddings.create({
            model: 'text-embedding-3-small',
            input: skillsText,
            encoding_format: 'float',
        });

        const summaryEmbedding = await embeder.embeddings.create({
            model: 'text-embedding-3-small',
            input: summary,
            encoding_format: 'float',
        });

        if (!skillsEmbedding?.data?.[0]?.embedding) {
            throw new Error('Could not generate embeddings for skills');
        }

        if (!summaryEmbedding?.data?.[0]?.embedding) {
            throw new Error('Could not generate embeddings for skills');
        }

        const skillsVec = `[${skillsEmbedding.data[0].embedding.join(',')}]`;
        const summaryVec = `[${summaryEmbedding.data[0].embedding.join(',')}]`;

        const results = await db<SimilarityResult>('job_postings_details')
            .select(
                'id',
                'title',
                'location',
                'compensation',
                'summary',
                db.raw(
                    '((skill_embedding <#> ?::vector(1536)) * 0.90 + (summary_embedding <#> ?::vector(1536)) * 0.10) AS similarity',
                    [skillsVec, summaryVec]
                )
            )
            .orderBy('similarity', 'asc')
            .limit(7);

        const replyItems = results.map(
            (job) =>
                `Title: ${job.title}\nLocation: ${job.location}\nCompensation: ${job.compensation ?? 'N/A'}\nSummary: ${job.summary?.split('.')[0]}`
        );

        console.log(results);

        const replyMessage = `Here's what I found for you!\n\n${replyItems.join('\n\n')}`;

        await ctx.reply(replyMessage);

        // TODO: Inject match feedback into matching. start list of liked jobs and add that into
        //the matching process. every job that got a thumbs up, add that into match
        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
});
