import crypto from 'crypto';
import { ENV } from './_core/env';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts sensitive data like bot tokens
 */
export function encrypt(plaintext: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(ENV.cookieSecret, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts sensitive data like bot tokens
 */
export function decrypt(ciphertext: string): string {
  try {
    const combined = Buffer.from(ciphertext, 'base64');
    
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + 12);
    const authTag = combined.slice(SALT_LENGTH + 12, SALT_LENGTH + 12 + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + 12 + TAG_LENGTH);
    
    const key = crypto.pbkdf2Sync(ENV.cookieSecret, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Generates a random license key
 */
export function generateLicenseKey(): string {
  return `LIC-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

/**
 * Validates a license key format
 */
export function isValidLicenseKey(key: string): boolean {
  return /^LIC-\d+-[A-F0-9]{12}$/.test(key);
}
