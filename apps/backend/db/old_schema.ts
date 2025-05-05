import { pgTable, varchar, timestamp, integer, numeric, text, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId as cuidCreateId } from '@paralleldrive/cuid2';

const createId: () => string = cuidCreateId;

// Enums
const careerLevelEnum = pgEnum('career_level', ['entry', 'mid', 'senior', 'staff']);
const authProviderEnum = pgEnum('auth_provider', ['google', 'x.com', 'linkedin']);

// JobPostingsDetails table
export const jobPostingsDetails = pgTable('job_postings_details', {
    id: varchar('id').primaryKey(),
    createdAt: timestamp('created_at').notNull(),
    summaryEmbedding: text('summary_embedding').array(),
    skillEmbedding: text('skill_embedding').array(),
    jobPostingId: integer('job_posting_id'),
    text: text('text'),
    title: varchar('title'),
    location: varchar('location'),
    compensation: varchar('compensation'),
    summary: text('summary'),
    jobPostingsScrapingId: varchar('job_postings_scraping_id'),
    lastModified: timestamp('last_modified').notNull(),
    embeddings: text('embeddings').array(),
});

// Experience table
export const experience = pgTable('experience', {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title').notNull(),
    company: varchar('company').notNull(),
    startDate: varchar('start_date').notNull(),
    endDate: varchar('end_date').notNull(),
    durationMonths: integer('duration_months').notNull(),
    responsibilities: text('responsibilities').array().notNull(),
});

// Users table with CUID
export const users = pgTable('users', {
    id: varchar('id', { length: 128 }).$defaultFn(() => {
        return createId();
    }),
    skills: text('skills').array().notNull(),
    externalAuthProvider: authProviderEnum('external_auth_provider').notNull(),
    externalAuthId: varchar('external_auth_id').notNull().unique(),
    totalExperienceYears: numeric('total_experience_years', { precision: 4, scale: 1 }).notNull(),
    careerLevel: careerLevelEnum('career_level').notNull(),
    category: varchar('category').notNull(),
    summary: text('summary').notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    experiences: many(experience),
}));

export const experienceRelations = relations(experience, ({ one }) => ({
    user: one(users, {
        fields: [experience.userId],
        references: [users.id],
    }),
}));
