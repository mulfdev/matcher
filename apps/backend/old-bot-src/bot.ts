import 'dotenv/config';

import { z } from 'zod';
import {
    Bot,
    Context,
    InlineKeyboard,
    session,
    type CallbackQueryContext,
    type SessionFlavor,
} from 'grammy';
import got from 'got';
import { ok } from 'assert';
import { pipeline } from 'stream/promises';
import { createId } from '@paralleldrive/cuid2';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { Poppler } from 'node-poppler';
import OpenAI from 'openai';
import { db, llm, type MessageContent } from '../src/core.js';
import type { JobPostingsDetails, User } from '../types.js';

type SimilarityResult = JobPostingsDetails & { similarity: number };

type FileResult = {
    result?: {
        file_path?: string;
    };
};

interface SessionData {
    matches: SimilarityResult[];
    index: number;
}

type MyContext = Context & SessionFlavor<SessionData>;

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

export const bot = new Bot<MyContext>(BOT_TOKEN);
bot.use(session({ initial: (): SessionData => ({ matches: [], index: 0 }) }));

const poppler = new Poppler();

const embeder = new OpenAI();

const ACTIONS = {
    MATCH: { id: 'button_1', label: 'Get Matched' },
    PROFILE: { id: 'button_2', label: 'My Profile' },
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

async function sendCurrentMatch(ctx: MyContext) {
    const { matches, index } = ctx.session;
    if (index >= matches.length) {
        await ctx.reply('✅ That was all of them!');
        return;
    }
    const job = matches[index];

    if (!job) throw new Error('Could not get job info');

    const text =
        `Title: ${job.title}\n` +
        `Location: ${job.location}\n` +
        `Compensation: ${job.compensation ?? 'N/A'}\n` +
        `Summary: ${job.summary?.split('.')[0]}`;
    const kb = new InlineKeyboard().text('👍', 'like').text('👎', 'dislike');
    await ctx.reply(text, { reply_markup: kb });
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
        default:
            await ctx.answerCallbackQuery('Unknown action');
    }
}

Object.values(ACTIONS).forEach(({ id }) => {
    bot.callbackQuery(id, (ctx) => handleButtonPress(ctx, id));
});

bot.callbackQuery(['like', 'dislike'], async (ctx: MyContext) => {
    const result = CallbackQuerySchema.safeParse(ctx.update.callback_query);

    console.log(ctx.update.callback_query);

    if (!result.success) {
        return ctx.reply('Could not process your request');
    }

    const userId = result.data.from.id.toString();
    const { matches, index } = ctx.session;
    const job = matches[index];

    if (!job) throw new Error('Could not like/dislike job');

    await db('user_job_feedback')
        //@ts-expect-error need to narrow/check type
        .insert({ user_id: userId, job_id: job.id, liked: ctx.callbackQuery.data === 'like' })
        .onConflict(['user_id', 'job_id'])
        .merge();
    await ctx.editMessageReplyMarkup();
    //@ts-expect-error need to narrow/check type
    await ctx.answerCallbackQuery(ctx.callbackQuery.data === 'like' ? 'Saved 👍' : 'Saved 👎');
    ctx.session.index += 1;
    await sendCurrentMatch(ctx);
});

bot.command('start', (ctx) => {
    return ctx.reply(
        'Welcome to the Matcher. I am here to help you find your pefect job! Please select one of the following',
        { reply_markup: createKeyboard() }
    );
});

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
        const fileUrl = (await got.get(getFileUrl).json());

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

        const userId = result.data.message.from.id.toString();

        const ratedJobs = db('user_job_feedback').select('job_id').where('user_id', userId);

        const results = await db<SimilarityResult>('job_postings_details as j')
            .whereNotIn('j.id', ratedJobs)
            .select(
                'j.id',
                'j.title',
                'j.location',
                'j.compensation',
                'j.summary',
                db.raw(
                    '((j.skill_embedding <#> ?::vector(1536)) * 0.90 + (j.summary_embedding <#> ?::vector(1536)) * 0.10) AS similarity',
                    [skillsVec, summaryVec]
                )
            )
            .orderBy('similarity', 'asc')
            .limit(7);
        ctx.session.matches = results;
        ctx.session.index = 0;

        await sendCurrentMatch(ctx);

        // TODO: Inject match feedback into matching. start list of liked jobs and add that into
        //the matching process. every job that got a thumbs up, add that into match
        await rm(subDir, { recursive: true, force: true });
    } catch (e) {
        console.log(e);
    }
});
