import * as db from './db';
import { encrypt, decrypt } from './encryption';

/**
 * Calculate remaining days for a license
 */
export function calculateRemainingDays(expiryDate: Date): number {
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Check if a license is expiring soon (within 7 days)
 */
export function isExpiringoon(expiryDate: Date): boolean {
  const remainingDays = calculateRemainingDays(expiryDate);
  return remainingDays <= 7 && remainingDays > 0;
}

/**
 * Check if a license is expired
 */
export function isExpired(expiryDate: Date): boolean {
  return calculateRemainingDays(expiryDate) <= 0;
}

/**
 * Validate a license and return its status
 */
export async function validateLicense(licenseKey: string) {
  try {
    const license = await db.getLicenseByKey(licenseKey);
    
    if (!license) {
      return {
        valid: false,
        reason: 'License not found',
        license: null,
      };
    }

    if (license.status !== 'active') {
      return {
        valid: false,
        reason: `License is ${license.status}`,
        license,
      };
    }

    if (isExpired(license.expiryDate)) {
      await db.updateLicenseStatus(license.id, 'expired');
      return {
        valid: false,
        reason: 'License has expired',
        license,
      };
    }

    const remainingDays = calculateRemainingDays(license.expiryDate);
    
    return {
      valid: true,
      reason: 'License is valid',
      license,
      remainingDays,
      expiringsoon: isExpiringoon(license.expiryDate),
    };
  } catch (error) {
    console.error('[License] Validation error:', error);
    return {
      valid: false,
      reason: 'Validation error',
      license: null,
    };
  }
}

/**
 * Get license details with decrypted bot token
 */
export async function getLicenseDetails(licenseId: number) {
  const license = await db.getLicenseById(licenseId);
  
  if (!license) {
    return null;
  }

  const decryptedToken = license.botToken ? decrypt(license.botToken) : null;
  
  return {
    ...license,
    botToken: decryptedToken,
    remainingDays: calculateRemainingDays(license.expiryDate),
    isExpired: isExpired(license.expiryDate),
    isExpiringSoon: isExpiringoon(license.expiryDate),
  };
}

/**
 * Store encrypted bot token in license
 */
export async function updateLicenseToken(licenseId: number, botToken: string) {
  const encryptedToken = encrypt(botToken);
  
  const db_instance = await db.getDb();
  if (!db_instance) throw new Error('Database not available');
  
  return await (db_instance as any).execute(
    'UPDATE licenses SET botToken = ? WHERE id = ?',
    [encryptedToken, licenseId]
  );
}

/**
 * Get all licenses for a user with calculated remaining days
 */
export async function getUserLicensesWithDetails(userId: number) {
  const licenses = await db.getLicensesByUserId(userId);
  
  return licenses.map(license => ({
    ...license,
    remainingDays: calculateRemainingDays(license.expiryDate),
    isExpired: isExpired(license.expiryDate),
    isExpiringSoon: isExpiringoon(license.expiryDate),
    botToken: undefined,
  }));
}

/**
 * Check licenses expiring soon and create notifications
 */
export async function checkExpiringLicenses() {
  const licenses = await db.getAllActiveLicenses();
  
  for (const license of licenses) {
    if (isExpiringoon(license.expiryDate)) {
      const remainingDays = calculateRemainingDays(license.expiryDate);
      
      const existingNotification = await db.getUnreadNotifications(license.userId);
      const hasNotification = existingNotification.some(
        n => n.type === 'expiry_warning' && 
        new Date(n.createdAt).toDateString() === new Date().toDateString()
      );
      
      if (!hasNotification) {
        await db.createNotification({
          userId: license.userId,
          type: 'expiry_warning',
          title: 'License Expiring Soon',
          content: `Your license will expire in ${remainingDays} days. Please renew to avoid service interruption.`,
          actionUrl: `/dashboard/licenses/${license.id}`,
        });
      }
    }
  }
}

/**
 * Renew a license with a new expiry date
 */
export async function renewLicense(licenseId: number, planType: string) {
  const license = await db.getLicenseById(licenseId);
  
  if (!license) {
    throw new Error('License not found');
  }

  const newExpiryDate = new Date();
  
  switch (planType) {
    case 'monthly':
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
      break;
    case 'quarterly':
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
      break;
    case 'semi_annual':
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 6);
      break;
    case 'annual':
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
      break;
    default:
      throw new Error('Invalid plan type');
  }

  const db_instance = await db.getDb();
  if (!db_instance) throw new Error('Database not available');
  
  await (db_instance as any).execute(
    'UPDATE licenses SET expiryDate = ?, planType = ?, status = ? WHERE id = ?',
    [newExpiryDate, planType, 'active', licenseId]
  );

  return {
    licenseId,
    newExpiryDate,
    remainingDays: calculateRemainingDays(newExpiryDate),
  };
}
