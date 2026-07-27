import { eq, and, desc, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, licenses, botInstances, licenseTransfers, transactions, auditLogs, documents, notifications, InsertLicense, InsertBotInstance, InsertLicenseTransfer, InsertTransaction, InsertAuditLog, InsertDocument, InsertNotification } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      // Auto-configuração: Tenta criar as tabelas silenciosamente
      await ensureTablesExist();
    } catch (error) {
      console.warn("[Database] Failed to connect or auto-config:", error);
      _db = null;
    }
  }
  return _db;
}

async function ensureTablesExist() {
  if (!_db) return;
  try {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    const tables = [
      `CREATE TABLE IF NOT EXISTS bot_license_users (id INT AUTO_INCREMENT PRIMARY KEY, openId VARCHAR(64) UNIQUE NOT NULL, discordId VARCHAR(64) UNIQUE, name VARCHAR(255), email VARCHAR(320), role ENUM('prospect', 'client', 'admin') DEFAULT 'prospect', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS bot_licenses (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, licenseKey VARCHAR(64) UNIQUE NOT NULL, plan ENUM('monthly', 'quarterly', 'semiannual', 'annual') NOT NULL, status ENUM('active', 'expired', 'suspended', 'cancelled') DEFAULT 'active', expiryDate DATETIME NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS bot_instances (id INT AUTO_INCREMENT PRIMARY KEY, licenseId INT, userId INT NOT NULL, botToken VARCHAR(255) NOT NULL, discordServerId VARCHAR(64) NOT NULL, discordOwnerId VARCHAR(64) NOT NULL, status ENUM('running', 'stopped', 'error', 'migrating') DEFAULT 'stopped', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`
    ];

    for (const sql of tables) {
      await connection.execute(sql);
    }
    await connection.end();
  } catch (e) {
    console.warn("[Database] Auto-table creation skipped or failed:", e.message);
  }
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "discordId", "discordUsername"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ LICENSE QUERIES ============

export async function createLicense(license: InsertLicense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(licenses).values(license);
  return result;
}

export async function getLicenseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(licenses).where(eq(licenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLicenseByKey(licenseKey: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLicensesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(licenses).where(eq(licenses.userId, userId));
}

export async function getAllActiveLicenses() {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  return await db.select().from(licenses).where(
    and(
      eq(licenses.status, 'active'),
      gte(licenses.expiryDate, now)
    )
  );
}

export async function updateLicenseStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(licenses).set({ status: status as any }).where(eq(licenses.id, id));
}

// ============ BOT INSTANCE QUERIES ============

export async function createBotInstance(instance: InsertBotInstance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(botInstances).values(instance);
}

export async function getBotInstancesByLicenseId(licenseId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(botInstances).where(eq(botInstances.licenseId, licenseId));
}

export async function getBotInstanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(botInstances).where(eq(botInstances.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateBotInstanceStatus(id: number, status: string, errorMessage?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { instanceStatus: status, lastHealthCheck: new Date() };
  if (errorMessage) updateData.errorMessage = errorMessage;

  return await db.update(botInstances).set(updateData).where(eq(botInstances.id, id));
}

// ============ LICENSE TRANSFER QUERIES ============

export async function createLicenseTransfer(transfer: InsertLicenseTransfer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(licenseTransfers).values(transfer);
}

export async function getPendingTransfers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(licenseTransfers).where(eq(licenseTransfers.status, 'pending'));
}

export async function getTransferById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(licenseTransfers).where(eq(licenseTransfers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTransferStatus(id: number, status: string, approvedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  if (approvedBy) {
    updateData.approvedBy = approvedBy;
    updateData.approvedAt = new Date();
  }

  return await db.update(licenseTransfers).set(updateData).where(eq(licenseTransfers.id, id));
}

// ============ TRANSACTION QUERIES ============

export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(transactions).values(transaction);
}

export async function getTransactionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
}

export async function getTransactionsByLicenseId(licenseId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(transactions).where(eq(transactions.licenseId, licenseId)).orderBy(desc(transactions.createdAt));
}

// ============ AUDIT LOG QUERIES ============

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// ============ DOCUMENT QUERIES ============

export async function createDocument(document: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(documents).values(document);
}

export async function getDocumentsByLicenseId(licenseId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(documents).where(eq(documents.licenseId, licenseId));
}

// ============ NOTIFICATION QUERIES ============

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(notifications).values(notification);
}

export async function getUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(notifications).where(
    and(
      eq(notifications.userId, userId),
      eq(notifications.read, 'false')
    )
  ).orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(notifications).set({ read: 'true' }).where(eq(notifications.id, id));
}
