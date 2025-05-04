import { ok } from 'assert';
import OpenAI from 'openai';
import { db } from './core.js';
import type { User, MyContext } from '../types.js';
import { createId } from '@paralleldrive/cuid2';
import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { Poppler } from 'node-poppler';
import got from 'got';

const poppler = new Poppler();
const openai = new OpenAI();
const baseDir = join(process.cwd(), 'tmp');

export async function getUserFromId(id: string | undefined): Promise<User | undefined> {
    if (!id) return undefined;
    return await db('user').where('telegram_id', id).first();
}

export function formatUserProfile(user: User): string {
    const skills = user.skills.map(escapeHtml).join(', ');

    let experience = '';
    for (const exp of user.experience) {
        const responsibilities = exp.responsibilities.map(escapeHtml).join(', ');
        experience +=
            `<b>${escapeHtml(exp.title)}</b> at <i>${escapeHtml(exp.company)}</i> ` +
            `(${escapeHtml(exp.start_date)} - ${escapeHtml(exp.end_date)}): ${responsibilities}\n\n`;
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

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function startMatching(ctx: MyContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const user = await getUserFromId(userId);
    if (!user) return;

    const skillsText = user.skills.join(', ');

    const skillsEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: skillsText,
        encoding_format: 'float',
    });

    const summaryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: user.summary,
        encoding_format: 'float',
    });

    const skillsVec = `[${skillsEmbedding.data[0].embedding.join(',')}]`;
    const summaryVec = `[${summaryEmbedding.data[0].embedding.join(',')}]`;

    const ratedJobs = db('user_job_feedback').select('job_id').where('user_id', userId);

    const results = await db('job_postings_details as j')
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
}

export async function processResume(ctx: MyContext, document: { file_id: string }) {
    const { BOT_TOKEN } = process.env;
    ok(BOT_TOKEN, 'BOT_TOKEN must be defined');

    try {
        const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${document.file_id}`;
        const fileUrl = (await got.get(getFileUrl).json()) as { result?: { file_path?: string } };

        ok(fileUrl.result?.file_path);

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
            await ctx.reply('Could not save your file');
            return;
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

        await ctx.reply('Processing your resume, just a moment... 💪');

        const base64Images = await Promise.all(
            jpgFiles.map(async (file) => {
                const fullPath = join(subDir, file);
                const data = await readFile(fullPath);
                return {
                    type: 'image_url' as const,
                    image_url: {
                        url: `data:image/jpeg;base64,${data.toString('base64')}`,
                        detail: 'auto' as const,
                    },
                };
            })
        );

        const analysis = await analyzeResume(base64Images);
        const user = await saveUserData(ctx, analysis);

        await rm(subDir, { recursive: true, force: true });
        return user;
    } catch (err) {
        console.error('Error processing resume:', err);
        throw err;
    }
}

export async function sendCurrentMatch(ctx: MyContext) {
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

    await ctx.reply(text, { reply_markup: ctx.menu });
}

export async function handleMatchFeedback(ctx: MyContext, liked: boolean) {
    const userId = ctx.from?.id.toString();
    const { matches, index } = ctx.session;
    const job = matches[index];

    if (!userId || !job) throw new Error('Could not process match feedback');

    await db('user_job_feedback')
        .insert({ user_id: userId, job_id: job.id, liked })
        .onConflict(['user_id', 'job_id'])
        .merge();

    await ctx.editMessageReplyMarkup();
    await ctx.answerCallbackQuery(liked ? 'Saved 👍' : 'Saved 👎');

    ctx.session.index += 1;
    await sendCurrentMatch(ctx);
}
