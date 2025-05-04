// src/bot.ts
import { Bot } from 'grammy';
import { Menu } from '@grammyjs/menu';
import { conversations } from '@grammyjs/conversations';
import { hydrateReply, parseMode } from '@grammyjs/parse-mode';

import { errorHandler, sessionMiddleware } from './middleware.js';
import {
    getUserFromId,
    formatUserProfile,
    startMatching,
    processResume,
    handleMatchFeedback,
} from './utils.js';
import type { MyContext } from '../types.js';

// Create the bot instance
const bot = new Bot<MyContext>(process.env.BOT_TOKEN || '');

// Attach plugins
bot.api.config.use(parseMode('HTML'));
bot.use(hydrateReply);

// Session must be attached before other middleware that uses session data
bot.use(sessionMiddleware);
bot.use(conversations());

// Create match feedback menu
const matchMenu = new Menu<MyContext>('match-menu')
    .text('👍', async (ctx) => await handleMatchFeedback(ctx, true))
    .text('👎', async (ctx) => await handleMatchFeedback(ctx, false));

// Create main menu
const mainMenu = new Menu<MyContext>('main-menu')
    .text('🔍 Get Matched', async (ctx) => {
        const existingUser = await getUserFromId(ctx.from?.id.toString());
        if (existingUser) {
            await ctx.reply("You're already in our system! Let's find you some matches.");
            await startMatching(ctx);
        } else {
            await ctx.reply('Please upload your resume (PDF format) to get started!');
        }
    })
    .row()
    .text('👤 My Profile', async (ctx) => {
        const user = await getUserFromId(ctx.from?.id.toString());
        if (user) {
            await ctx.reply(formatUserProfile(user), { parse_mode: 'HTML' });
        } else {
            await ctx.reply('No profile found. Upload your resume to get started!');
        }
    });

// Attach menus
bot.use(mainMenu);
bot.use(matchMenu);

// Start command
bot.command('start', async (ctx) => {
    await ctx.reply(
        `Welcome to the Job Matcher! I'll help you find your perfect job match. Choose an option:`,
        { reply_markup: mainMenu }
    );
});

// Help command
bot.command('help', async (ctx) => {
    await ctx.reply(
        `Here's how to use the Job Matcher bot:\n\n' +
        '• Upload your resume to get started\n' +
        '• Use "Get Matched" to see job matches\n' +
        '• Check "My Profile" to see your parsed info\n' +
        '• Use 👍 or 👎 to rate job matches`
    );
});

// Handle document uploads (resumes)
bot.on(':document', async (ctx) => {
    const document = ctx.message?.document;
    if (!document) return;

    const existingUser = await getUserFromId(ctx.from?.id.toString());
    if (existingUser) {
        await ctx.reply("You're already in our system!", { reply_markup: mainMenu });
        return;
    }

    try {
        await processResume(ctx, document);
        await ctx.reply("Resume processed successfully! Let's find you some matches.", {
            reply_markup: mainMenu,
        });
        await startMatching(ctx);
    } catch (err) {
        console.error('Error processing resume:', err);
        await ctx.reply('Sorry, there was an error processing your resume. Please try again.');
    }
});

// Error handling
bot.catch(errorHandler);

export { bot };
