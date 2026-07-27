import { decimal, int, json, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extended with Discord integration and role-based access control.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  discordId: varchar("discordId", { length: 64 }).unique(),
  discordUsername: varchar("discordUsername", { length: 255 }),
  role: mysqlEnum("role", ["prospect", "client", "admin"]).default("prospect").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Licenses table - stores all bot licenses sold to clients
 */
export const licenses = mysqlTable("licenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  licenseKey: varchar("licenseKey", { length: 64 }).notNull().unique(),
  planType: mysqlEnum("planType", ["monthly", "quarterly", "semi_annual", "annual"]).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "suspended", "expired", "transferred"]).default("active").notNull(),
  purchaseDate: timestamp("purchaseDate").defaultNow().notNull(),
  expiryDate: timestamp("expiryDate").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  discordServerId: varchar("discordServerId", { length: 64 }),
  discordOwnerId: varchar("discordOwnerId", { length: 64 }),
  botToken: longtext("botToken"), // Encrypted
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type License = typeof licenses.$inferSelect;
export type InsertLicense = typeof licenses.$inferInsert;

/**
 * Bot instances - stores running instances of bots for each license
 */
export const botInstances = mysqlTable("bot_instances", {
  id: int("id").autoincrement().primaryKey(),
  licenseId: int("licenseId").notNull(),
  botToken: longtext("botToken").notNull(), // Encrypted
  serverId: varchar("serverId", { length: 64 }).notNull(),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  instanceStatus: mysqlEnum("instanceStatus", ["running", "stopped", "error", "pending"]).default("pending").notNull(),
  lastHealthCheck: timestamp("lastHealthCheck"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BotInstance = typeof botInstances.$inferSelect;
export type InsertBotInstance = typeof botInstances.$inferInsert;

/**
 * License transfers - workflow for transferring licenses between users
 */
export const licenseTransfers = mysqlTable("license_transfers", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  licenseId: int("licenseId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LicenseTransfer = typeof licenseTransfers.$inferSelect;
export type InsertLicenseTransfer = typeof licenseTransfers.$inferInsert;

/**
 * Transactions - complete history of all financial transactions
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  licenseId: int("licenseId"),
  type: mysqlEnum("type", ["purchase", "renewal", "refund", "transfer", "upgrade"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripeTransactionId: varchar("stripeTransactionId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Audit logs - complete audit trail of all system actions
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 255 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  changes: json("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Documents - stores references to uploaded documents (payment proofs, agreements, logs)
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  licenseId: int("licenseId"),
  type: mysqlEnum("type", ["payment_proof", "transfer_agreement", "instance_log", "other"]).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Notifications - in-app notifications for users
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["payment_confirmed", "transfer_pending", "transfer_approved", "transfer_rejected", "expiry_warning", "license_expired", "system_alert"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  read: mysqlEnum("read", ["true", "false"]).default("false").notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Relations for type safety
 */
export const usersRelations = relations(users, ({ many }) => ({
  licenses: many(licenses),
  transactions: many(transactions),
  auditLogs: many(auditLogs),
  sentTransfers: many(licenseTransfers, { relationName: "fromUser" }),
  receivedTransfers: many(licenseTransfers, { relationName: "toUser" }),
  approvedTransfers: many(licenseTransfers, { relationName: "approver" }),
  notifications: many(notifications),
  documents: many(documents),
}));

export const licensesRelations = relations(licenses, ({ one, many }) => ({
  user: one(users, { fields: [licenses.userId], references: [users.id] }),
  instances: many(botInstances),
  transfers: many(licenseTransfers),
  transactions: many(transactions),
  documents: many(documents),
}));

export const botInstancesRelations = relations(botInstances, ({ one }) => ({
  license: one(licenses, { fields: [botInstances.licenseId], references: [licenses.id] }),
}));

export const licenseTransfersRelations = relations(licenseTransfers, ({ one }) => ({
  fromUser: one(users, { fields: [licenseTransfers.fromUserId], references: [users.id], relationName: "fromUser" }),
  toUser: one(users, { fields: [licenseTransfers.toUserId], references: [users.id], relationName: "toUser" }),
  license: one(licenses, { fields: [licenseTransfers.licenseId], references: [licenses.id] }),
  approver: one(users, { fields: [licenseTransfers.approvedBy], references: [users.id], relationName: "approver" }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  license: one(licenses, { fields: [transactions.licenseId], references: [licenses.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  license: one(licenses, { fields: [documents.licenseId], references: [licenses.id] }),
  uploadedByUser: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
