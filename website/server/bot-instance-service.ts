import * as db from './db';
import { encrypt, decrypt } from './encryption';
import { notifyOwner } from './_core/notification';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Create a new bot instance
 */
export async function createBotInstance(
  licenseId: number,
  botToken: string,
  serverId: string,
  ownerId: string
) {
  try {
    // Validate license
    const license = await db.getLicenseById(licenseId);
    if (!license) {
      throw new Error('License not found');
    }

    if (license.status !== 'active') {
      throw new Error('License is not active');
    }

    // Encrypt bot token before storing
    const encryptedToken = encrypt(botToken);

    // Create instance in database
    const instance = await db.createBotInstance({
      licenseId,
      botToken: encryptedToken,
      serverId,
      ownerId,
      instanceStatus: 'pending',
    });

    // Get the created instance ID
    const instances = await db.getBotInstancesByLicenseId(licenseId);
    const newInstance = instances[instances.length - 1];
    const instanceId = newInstance?.id;

    if (!instanceId) {
      throw new Error('Failed to create bot instance');
    }

    // Execute CMD to start bot instance
    await startBotInstanceCmd(instanceId, botToken, serverId, ownerId);

    // Update instance status
    await db.updateBotInstanceStatus(instanceId, 'running');

    // Log audit
    await db.createAuditLog({
      userId: license.userId,
      action: 'CREATE_BOT_INSTANCE',
      entityType: 'bot_instance',
      entityId: instanceId,
      changes: { serverId, ownerId },
    });

    // Notify owner
    await notifyOwner({
      title: 'New Bot Instance Created',
      content: `A new bot instance has been created for license ${license.licenseKey}. Server: ${serverId}`,
    });

    return newInstance;
  } catch (error) {
    console.error('[Bot Instance] Creation error:', error);
    throw error;
  }
}

/**
 * Start bot instance via CMD
 */
async function startBotInstanceCmd(
  instanceId: number,
  botToken: string,
  serverId: string,
  ownerId: string
) {
  try {
    const cmd = `node bot-launcher.mjs ${instanceId} "${botToken}" "${serverId}" "${ownerId}"`;
    
    // Execute in background
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      cwd: process.env.BOT_INSTANCES_DIR || '/opt/bot-instances',
    });

    if (stderr) {
      console.warn('[Bot Instance] CMD stderr:', stderr);
    }

    console.log('[Bot Instance] CMD output:', stdout);
    return { success: true, output: stdout };
  } catch (error) {
    console.error('[Bot Instance] CMD execution error:', error);
    throw new Error('Failed to start bot instance');
  }
}

/**
 * Stop bot instance via CMD
 */
async function stopBotInstanceCmd(instanceId: number) {
  try {
    const cmd = `node bot-launcher.mjs stop ${instanceId}`;
    
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      cwd: process.env.BOT_INSTANCES_DIR || '/opt/bot-instances',
    });

    if (stderr) {
      console.warn('[Bot Instance] Stop stderr:', stderr);
    }

    console.log('[Bot Instance] Stop output:', stdout);
    return { success: true, output: stdout };
  } catch (error) {
    console.error('[Bot Instance] Stop error:', error);
    throw new Error('Failed to stop bot instance');
  }
}

/**
 * Delete bot instance
 */
export async function deleteBotInstance(instanceId: number) {
  try {
    const instance = await db.getBotInstanceById(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Stop the instance
    await stopBotInstanceCmd(instanceId);

    // Update instance status
    await db.updateBotInstanceStatus(instanceId, 'stopped');

    // Log audit
    const license = await db.getLicenseById(instance.licenseId);
    if (license) {
      await db.createAuditLog({
        userId: license.userId,
        action: 'DELETE_BOT_INSTANCE',
        entityType: 'bot_instance',
        entityId: instanceId,
        changes: { serverId: instance.serverId },
      });
    }

    // Notify owner
    await notifyOwner({
      title: 'Bot Instance Deleted',
      content: `Bot instance ${instanceId} for server ${instance.serverId} has been stopped.`,
    });

    return { success: true };
  } catch (error) {
    console.error('[Bot Instance] Deletion error:', error);
    throw error;
  }
}

/**
 * Migrate bot instance to new owner
 */
export async function migrateBotInstance(
  instanceId: number,
  newBotToken: string,
  newServerId: string,
  newOwnerId: string
) {
  try {
    const instance = await db.getBotInstanceById(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Stop old instance
    await stopBotInstanceCmd(instanceId);

    // Encrypt new token
    const encryptedToken = encrypt(newBotToken);

    // Update instance with new details
    const db_instance = await db.getDb();
    if (!db_instance) throw new Error('Database not available');

    await (db_instance as any).execute(
      'UPDATE bot_instances SET botToken = ?, serverId = ?, ownerId = ?, instanceStatus = ? WHERE id = ?',
      [encryptedToken, newServerId, newOwnerId, 'starting', instanceId]
    );

    // Start new instance
    await startBotInstanceCmd(instanceId, newBotToken, newServerId, newOwnerId);

    // Update status
    await db.updateBotInstanceStatus(instanceId, 'running');

    // Log audit
    const license = await db.getLicenseById(instance.licenseId);
    if (license) {
      await db.createAuditLog({
        userId: license.userId,
        action: 'MIGRATE_BOT_INSTANCE',
        entityType: 'bot_instance',
        entityId: instanceId,
        changes: {
          oldServerId: instance.serverId,
          newServerId,
          oldOwnerId: instance.ownerId,
          newOwnerId,
        },
      });
    }

    // Notify owner
    await notifyOwner({
      title: 'Bot Instance Migrated',
      content: `Bot instance ${instanceId} has been migrated from server ${instance.serverId} to server ${newServerId}.`,
    });

    return { success: true };
  } catch (error) {
    console.error('[Bot Instance] Migration error:', error);
    throw error;
  }
}

/**
 * Get instance details with decrypted token
 */
export async function getBotInstanceDetails(instanceId: number) {
  const instance = await db.getBotInstanceById(instanceId);
  
  if (!instance) {
    return null;
  }

  const decryptedToken = instance.botToken ? decrypt(instance.botToken) : null;

  return {
    ...instance,
    botToken: decryptedToken,
  };
}

/**
 * Get all instances for a license
 */
export async function getLicenseInstances(licenseId: number) {
  return await db.getBotInstancesByLicenseId(licenseId);
}

/**
 * Check instance health and update status
 */
export async function checkInstanceHealth(instanceId: number) {
  try {
    const instance = await db.getBotInstanceById(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Check if process is running
    const cmd = `node bot-launcher.mjs health ${instanceId}`;
    const { stdout } = await execAsync(cmd, {
      timeout: 10000,
      cwd: process.env.BOT_INSTANCES_DIR || '/opt/bot-instances',
    });

    const isHealthy = stdout.includes('healthy');

    if (isHealthy && instance.instanceStatus !== 'running') {
      await db.updateBotInstanceStatus(instanceId, 'running');
    } else if (!isHealthy && instance.instanceStatus === 'running') {
      await db.updateBotInstanceStatus(instanceId, 'error');
    }

    return { healthy: isHealthy, status: instance.instanceStatus };
  } catch (error) {
    console.error('[Bot Instance] Health check error:', error);
    
    // Mark instance as unhealthy
    await db.updateBotInstanceStatus(instanceId, 'error');
    
    return { healthy: false, status: 'error' };
  }
}
