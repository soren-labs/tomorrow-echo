import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Official Better Auth core tables (snake_case columns, singular model names).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_email_key").on(table.email),
]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("session_token_key").on(table.token),
  index("session_user_id_idx").on(table.userId),
]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("account_user_id_idx").on(table.userId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("verification_identifier_idx").on(table.identifier),
]);

// Business table.

export const capsules = pgTable("capsules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  note: text("note"),
  probability: integer("probability").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  unlockAt: timestamp("unlock_at", { withTimezone: true }).notNull(),
  outcome: boolean("outcome"),
  reflection: text("reflection"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("capsules_user_created_idx").on(table.userId, table.createdAt),
  check("capsules_title_length", sql`char_length(${table.title}) between 1 and 120`),
  check("capsules_note_length", sql`${table.note} is null or char_length(${table.note}) <= 1000`),
  check("capsules_probability_range", sql`${table.probability} between 0 and 100`),
  check("capsules_reflection_length", sql`${table.reflection} is null or char_length(${table.reflection}) <= 500`),
  check(
    "capsules_resolution_consistent",
    sql`(${table.resolvedAt} is null) = (${table.outcome} is null)`,
  ),
  check(
    "capsules_reflection_resolved",
    sql`${table.reflection} is null or ${table.resolvedAt} is not null`,
  ),
]);

export type CapsuleRow = typeof capsules.$inferSelect;
