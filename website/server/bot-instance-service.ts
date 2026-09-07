import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as db from "./db";
import { encrypt } from "./encryption";

type InstanceRuntimePaths = {
  instanceRoot: string;
  runtimeDir: string;
  logsDir: string;
  dbDir: string;
  pidFile: string;
  stdoutLog: string;
  stderrLog: string;
};

export type InstanceSiteConfigInput = {
  ticketEnabled: boolean;
  whitelistEnabled: boolean;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeMessage: string | null;
};

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const botEntryPath = path.resolve(repoRoot, "src", "index.js");
const instancesRoot = path.resolve(
  process.env.BOT_INSTANCES_DIR || path.join(repoRoot, "website", "bot-instances")
);

function getPaths(instanceId: number): InstanceRuntimePaths {
  const instanceRoot = path.join(instancesRoot, String(instanceId));
  const runtimeDir = path.join(instanceRoot, "runtime");
  const logsDir = path.join(instanceRoot, "logs");
  const dbDir = path.join(runtimeDir, "database");
  return {
    instanceRoot,
    runtimeDir,
    logsDir,
    dbDir,
    pidFile: path.join(instanceRoot, "process.json"),
    stdoutLog: path.join(logsDir, "stdout.log"),
    stderrLog: path.join(logsDir, "stderr.log"),
  };
}

function ensureInstanceDirs(paths: InstanceRuntimePaths) {
  fs.mkdirSync(paths.instanceRoot, { recursive: true });
  fs.mkdirSync(paths.runtimeDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
  fs.mkdirSync(paths.dbDir, { recursive: true });
}

function readProcessPid(pidFile: string): number | null {
  if (!fs.existsSync(pidFile)) return null;
  try {
    const raw = fs.readFileSync(pidFile, "utf8");
    const parsed = JSON.parse(raw) as { pid?: unknown };
    const pid = typeof parsed.pid === "number" ? parsed.pid : Number(parsed.pid);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function stopProcess(pid: number): Promise<boolean> {
  if (!isProcessAlive(pid)) return true;

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }

  for (let i = 0; i < 10; i++) {
    await wait(200);
    if (!isProcessAlive(pid)) return true;
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return false;
  }

  await wait(300);
  return !isProcessAlive(pid);
}

function writeProcessFile(
  paths: InstanceRuntimePaths,
  payload: { pid: number; serverId: string; ownerId: string }
) {
  fs.writeFileSync(
    paths.pidFile,
    JSON.stringify({ ...payload, startedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

function removeProcessFile(pidFile: string) {
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile, { force: true });
  }
}

function tailLines(content: string, maxLines: number): string {
  const lines = content.split("\n");
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n").trim();
}

function getSqliteConstructor(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("better-sqlite3");
}

function ensureBotConfigSchema(sqliteDb: any) {
  sqliteDb.exec(
    "CREATE TABLE IF NOT EXISTS guild_configs (guild_id TEXT PRIMARY KEY, whitelist_enabled INTEGER DEFAULT 0, ticket_enabled INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );
  sqliteDb.exec(
    "CREATE TABLE IF NOT EXISTS welcome_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, banner_url TEXT, role_id TEXT, enabled INTEGER DEFAULT 0)"
  );
  sqliteDb.exec(
    "CREATE TABLE IF NOT EXISTS goodbye_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, banner_url TEXT, enabled INTEGER DEFAULT 0)"
  );
  sqliteDb.exec(
    "CREATE TABLE IF NOT EXISTS ticket_configs (guild_id TEXT PRIMARY KEY, panel_channel_id TEXT, panel_message_id TEXT, category_id TEXT, log_channel_id TEXT, staff_role_id TEXT, transcript_channel_id TEXT, banner_url TEXT)"
  );
  sqliteDb.exec(
    "CREATE TABLE IF NOT EXISTS whitelist_configs (guild_id TEXT PRIMARY KEY, panel_channel_id TEXT, panel_message_id TEXT, approval_channel_id TEXT, log_channel_id TEXT, approved_role_id TEXT, pending_role_id TEXT, category_id TEXT, mysql_host TEXT, mysql_user TEXT, mysql_password TEXT, mysql_database TEXT, mysql_port INTEGER DEFAULT 3306, banner_url TEXT)"
  );
}

async function createLifecycleAudit(
  userId: number,
  instanceId: number,
  action: string,
  changes: Record<string, unknown>
) {
  await db.createAuditLog({
    userId,
    action,
    entityType: "bot_instance",
    entityId: instanceId,
    changes,
  });
}

async function startBotProcess(
  instanceId: number,
  botToken: string,
  serverId: string,
  ownerId: string
) {
  const paths = getPaths(instanceId);
  ensureInstanceDirs(paths);

  const existingPid = readProcessPid(paths.pidFile);
  if (existingPid && isProcessAlive(existingPid)) {
    return { alreadyRunning: true, pid: existingPid };
  }

  const stdoutFd = fs.openSync(paths.stdoutLog, "a");
  const stderrFd = fs.openSync(paths.stderrLog, "a");

  const child = spawn(process.execPath, [botEntryPath], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      TOKEN: botToken,
      GUILD_ID: serverId,
      ALLOWED_GUILD_ID: serverId,
      BOT_INSTANCE_ID: String(instanceId),
      BOT_LICENSE_OWNER_ID: ownerId,
      BOT_INSTANCE_DATA_DIR: paths.runtimeDir,
    },
    stdio: ["ignore", stdoutFd, stderrFd],
  });

  child.unref();
  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);

  writeProcessFile(paths, { pid: child.pid!, serverId, ownerId });
  return { alreadyRunning: false, pid: child.pid };
}

async function stopBotProcess(instanceId: number) {
  const paths = getPaths(instanceId);
  const pid = readProcessPid(paths.pidFile);
  if (!pid) return { stopped: true, reason: "not_running" as const };

  const stopped = await stopProcess(pid);
  if (stopped) {
    removeProcessFile(paths.pidFile);
    return { stopped: true, reason: "stopped" as const };
  }

  return { stopped: false, reason: "failed" as const };
}

async function ensureLicenseOwnership(licenseId: number, userId: number) {
  const license = await db.getLicenseById(licenseId);
  if (!license) throw new Error("License not found");
  if (license.userId !== userId) throw new Error("Forbidden");
  return license;
}

export async function createBotInstance(
  licenseId: number,
  botToken: string,
  serverId: string,
  ownerId: string,
  actorUserId: number
) {
  const license = await ensureLicenseOwnership(licenseId, actorUserId);
  if (license.status !== "active") throw new Error("License is not active");

  const existing = await db.getBotInstancesByLicenseId(licenseId);
  if (existing.length > 0) {
    throw new Error("This license already has an instance. Use restart/update instead.");
  }

  const encryptedToken = encrypt(botToken);
  const created = await db.createBotInstance({
    licenseId,
    botToken: encryptedToken,
    serverId,
    ownerId,
    instanceStatus: "pending",
  });

  if (!created?.id) {
    throw new Error("Failed to create bot instance");
  }

  try {
    await startBotProcess(created.id, botToken, serverId, ownerId);
    await db.updateBotInstanceStatus(created.id, "running");
    await createLifecycleAudit(actorUserId, created.id, "CREATE_BOT_INSTANCE", {
      serverId,
      ownerId,
    });
    return await db.getBotInstanceById(created.id);
  } catch (error) {
    await db.updateBotInstanceStatus(
      created.id,
      "error",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function startBotInstance(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  const license = await ensureLicenseOwnership(instance.licenseId, actorUserId);

  if (!license.botToken) throw new Error("Encrypted bot token not found");

  const decryptedToken = (await import("./encryption")).decrypt(license.botToken);
  await startBotProcess(instanceId, decryptedToken, instance.serverId, instance.ownerId);
  await db.updateBotInstanceStatus(instanceId, "running");
  await createLifecycleAudit(actorUserId, instanceId, "START_BOT_INSTANCE", {
    serverId: instance.serverId,
  });
  return await db.getBotInstanceById(instanceId);
}

export async function stopBotInstance(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  const result = await stopBotProcess(instanceId);
  if (!result.stopped) {
    await db.updateBotInstanceStatus(instanceId, "error", "Failed to stop instance process");
    throw new Error("Failed to stop bot instance");
  }

  await db.updateBotInstanceStatus(instanceId, "stopped");
  await createLifecycleAudit(actorUserId, instanceId, "STOP_BOT_INSTANCE", {
    reason: result.reason,
  });
  return await db.getBotInstanceById(instanceId);
}

export async function restartBotInstance(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  const license = await ensureLicenseOwnership(instance.licenseId, actorUserId);
  if (!license.botToken) throw new Error("Encrypted bot token not found");

  await stopBotProcess(instanceId);
  const decryptedToken = (await import("./encryption")).decrypt(license.botToken);
  await startBotProcess(instanceId, decryptedToken, instance.serverId, instance.ownerId);
  await db.updateBotInstanceStatus(instanceId, "running");
  await createLifecycleAudit(actorUserId, instanceId, "RESTART_BOT_INSTANCE", {
    serverId: instance.serverId,
  });
  return await db.getBotInstanceById(instanceId);
}

export async function getBotInstanceHealth(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  const pid = readProcessPid(getPaths(instanceId).pidFile);
  const healthy = !!pid && isProcessAlive(pid);
  const mappedStatus = healthy ? "running" : "error";

  if (instance.instanceStatus !== mappedStatus) {
    await db.updateBotInstanceStatus(instanceId, mappedStatus);
  }

  return {
    healthy,
    pid,
    status: mappedStatus,
    instanceId,
  };
}

export async function deleteBotInstance(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  await stopBotProcess(instanceId);
  await db.updateBotInstanceStatus(instanceId, "stopped");
  await createLifecycleAudit(actorUserId, instanceId, "DELETE_BOT_INSTANCE", {
    serverId: instance.serverId,
  });
  return { success: true };
}

export async function getInstanceLogs(instanceId: number, actorUserId: number, maxLines = 120) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  const paths = getPaths(instanceId);
  const stdout = fs.existsSync(paths.stdoutLog)
    ? tailLines(fs.readFileSync(paths.stdoutLog, "utf8"), maxLines)
    : "";
  const stderr = fs.existsSync(paths.stderrLog)
    ? tailLines(fs.readFileSync(paths.stderrLog, "utf8"), maxLines)
    : "";

  return { stdout, stderr, instanceId };
}

export async function getInstanceSiteConfig(instanceId: number, actorUserId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  const paths = getPaths(instanceId);
  ensureInstanceDirs(paths);
  const Sqlite = getSqliteConstructor();
  const sqlite = new Sqlite(path.join(paths.dbDir, "configs.db"));
  try {
    ensureBotConfigSchema(sqlite);
    const guildConfig = sqlite
      .prepare("SELECT whitelist_enabled, ticket_enabled FROM guild_configs WHERE guild_id = ?")
      .get(instance.serverId);
    const welcomeConfig = sqlite
      .prepare("SELECT enabled, channel_id, message FROM welcome_configs WHERE guild_id = ?")
      .get(instance.serverId);
    const goodbyeConfig = sqlite
      .prepare("SELECT enabled, channel_id, message FROM goodbye_configs WHERE guild_id = ?")
      .get(instance.serverId);

    return {
      ticketEnabled: !!guildConfig?.ticket_enabled,
      whitelistEnabled: !!guildConfig?.whitelist_enabled,
      welcomeEnabled: !!welcomeConfig?.enabled,
      welcomeChannelId: welcomeConfig?.channel_id || null,
      welcomeMessage: welcomeConfig?.message || null,
      goodbyeEnabled: !!goodbyeConfig?.enabled,
      goodbyeChannelId: goodbyeConfig?.channel_id || null,
      goodbyeMessage: goodbyeConfig?.message || null,
    };
  } finally {
    sqlite.close();
  }
}

export async function updateInstanceSiteConfig(
  instanceId: number,
  actorUserId: number,
  config: InstanceSiteConfigInput
) {
  const instance = await db.getBotInstanceById(instanceId);
  if (!instance) throw new Error("Instance not found");
  await ensureLicenseOwnership(instance.licenseId, actorUserId);

  const paths = getPaths(instanceId);
  ensureInstanceDirs(paths);
  const Sqlite = getSqliteConstructor();
  const sqlite = new Sqlite(path.join(paths.dbDir, "configs.db"));
  try {
    ensureBotConfigSchema(sqlite);
    sqlite
      .prepare(
        "INSERT INTO guild_configs (guild_id, whitelist_enabled, ticket_enabled) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET whitelist_enabled = excluded.whitelist_enabled, ticket_enabled = excluded.ticket_enabled, updated_at = CURRENT_TIMESTAMP"
      )
      .run(instance.serverId, config.whitelistEnabled ? 1 : 0, config.ticketEnabled ? 1 : 0);

    sqlite
      .prepare(
        "INSERT INTO welcome_configs (guild_id, channel_id, message, enabled) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message = excluded.message, enabled = excluded.enabled"
      )
      .run(
        instance.serverId,
        config.welcomeChannelId,
        config.welcomeMessage,
        config.welcomeEnabled ? 1 : 0
      );

    sqlite
      .prepare(
        "INSERT INTO goodbye_configs (guild_id, channel_id, message, enabled) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message = excluded.message, enabled = excluded.enabled"
      )
      .run(
        instance.serverId,
        config.goodbyeChannelId,
        config.goodbyeMessage,
        config.goodbyeEnabled ? 1 : 0
      );
  } finally {
    sqlite.close();
  }

  await createLifecycleAudit(actorUserId, instanceId, "UPDATE_INSTANCE_SITE_CONFIG", {
    guildId: instance.serverId,
    modules: {
      ticketEnabled: config.ticketEnabled,
      whitelistEnabled: config.whitelistEnabled,
      welcomeEnabled: config.welcomeEnabled,
      goodbyeEnabled: config.goodbyeEnabled,
    },
  });

  return await getInstanceSiteConfig(instanceId, actorUserId);
}
