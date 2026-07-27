import { invokeLLM } from './_core/llm';
import * as db from './db';
import { ENV } from './_core/env';

interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Generate email template for license expiry warning
 */
function generateExpiryWarningEmail(
  userName: string,
  licenseKey: string,
  daysRemaining: number,
  renewalUrl: string
): EmailTemplate {
  return {
    subject: `⚠️ Your License ${licenseKey} Expires in ${daysRemaining} Days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>License Expiry Warning</h2>
        <p>Hi ${userName},</p>
        <p>Your bot license <strong>${licenseKey}</strong> will expire in <strong>${daysRemaining} days</strong>.</p>
        <p>To continue using your bot without interruption, please renew your license:</p>
        <a href="${renewalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Renew License
        </a>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          © 2026 Bot License Manager. All rights reserved.
        </p>
      </div>
    `,
  };
}

/**
 * Generate email template for payment confirmation
 */
function generatePaymentConfirmationEmail(
  userName: string,
  licenseKey: string,
  planType: string,
  amount: string,
  expiryDate: string,
  dashboardUrl: string
): EmailTemplate {
  const planLabel = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annual: 'Semi-Annual',
    annual: 'Annual',
  }[planType] || planType;

  return {
    subject: `✅ Payment Confirmed - License ${licenseKey}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Confirmed</h2>
        <p>Hi ${userName},</p>
        <p>Thank you for your payment! Your bot license has been activated.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <p><strong>License Details:</strong></p>
          <p>License Key: <code>${licenseKey}</code></p>
          <p>Plan: ${planLabel}</p>
          <p>Amount: ${amount}</p>
          <p>Expires: ${expiryDate}</p>
        </div>
        <p>You can now manage your license and create bot instances from your dashboard:</p>
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Go to Dashboard
        </a>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          © 2026 Bot License Manager. All rights reserved.
        </p>
      </div>
    `,
  };
}

/**
 * Generate email template for transfer request
 */
function generateTransferRequestEmail(
  userName: string,
  licenseKey: string,
  fromUserName: string,
  approvalUrl: string
): EmailTemplate {
  return {
    subject: `📋 License Transfer Request - ${licenseKey}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>License Transfer Request</h2>
        <p>Hi ${userName},</p>
        <p>A license transfer request has been submitted for review.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <p><strong>Transfer Details:</strong></p>
          <p>License Key: <code>${licenseKey}</code></p>
          <p>From: ${fromUserName}</p>
        </div>
        <p>Please review and approve or reject this transfer request:</p>
        <a href="${approvalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Review Transfer
        </a>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          © 2026 Bot License Manager. All rights reserved.
        </p>
      </div>
    `,
  };
}

/**
 * Send email using LLM-powered email service
 */
async function sendEmail(
  toEmail: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    // In production, this would integrate with a real email service
    // For now, we'll log and simulate success
    console.log(`[Email] Sending to ${toEmail}`);
    console.log(`[Email] Subject: ${subject}`);
    
    // TODO: Integrate with SendGrid, AWS SES, or similar
    // For now, just return success
    return true;
  } catch (error) {
    console.error('[Email] Send error:', error);
    return false;
  }
}

/**
 * Send license expiry warning email
 */
export async function sendExpiryWarningEmail(
  userId: number,
  licenseKey: string,
  daysRemaining: number
): Promise<boolean> {
  try {
    const user = await db.getUserById(userId);
    if (!user || !user.email) {
      console.warn('[Email] User not found or no email');
      return false;
    }

    const renewalUrl = `${process.env.APP_URL || 'https://app.example.com'}/dashboard`;
    const template = generateExpiryWarningEmail(
      user.name || 'User',
      licenseKey,
      daysRemaining,
      renewalUrl
    );

    return await sendEmail(user.email, template.subject, template.html);
  } catch (error) {
    console.error('[Email] Expiry warning error:', error);
    return false;
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  userId: number,
  licenseKey: string,
  planType: string,
  amount: string,
  expiryDate: string
): Promise<boolean> {
  try {
    const user = await db.getUserById(userId);
    if (!user || !user.email) {
      console.warn('[Email] User not found or no email');
      return false;
    }

    const dashboardUrl = `${process.env.APP_URL || 'https://app.example.com'}/dashboard`;
    const template = generatePaymentConfirmationEmail(
      user.name || 'User',
      licenseKey,
      planType,
      amount,
      expiryDate,
      dashboardUrl
    );

    return await sendEmail(user.email, template.subject, template.html);
  } catch (error) {
    console.error('[Email] Payment confirmation error:', error);
    return false;
  }
}

/**
 * Send transfer request email to admin
 */
export async function sendTransferRequestEmail(
  transferId: number,
  licenseKey: string,
  fromUserId: number
): Promise<boolean> {
  try {
    const fromUser = await db.getUserById(fromUserId);
    // Get admin user (owner)
    const adminUser = await db.getUserByOpenId(ENV.ownerOpenId);

    if (!adminUser || !adminUser.email) {
      console.warn('[Email] Admin not found or no email');
      return false;
    }

    const approvalUrl = `${process.env.APP_URL || 'https://app.example.com'}/admin/transfers/${transferId}`;
    const template = generateTransferRequestEmail(
      adminUser.name || 'Admin',
      licenseKey,
      fromUser?.name || 'User',
      approvalUrl
    );

    return await sendEmail(adminUser.email, template.subject, template.html);
  } catch (error) {
    console.error('[Email] Transfer request error:', error);
    return false;
  }
}

/**
 * Send bulk expiry warnings for licenses expiring soon
 */
export async function sendBulkExpiryWarnings(): Promise<number> {
  try {
    const licenses = await db.getAllActiveLicenses();
    let sentCount = 0;

    for (const license of licenses) {
      const daysRemaining = Math.ceil(
        (new Date(license.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send warning if expiring in 7 days or less
      if (daysRemaining <= 7 && daysRemaining > 0) {
        const sent = await sendExpiryWarningEmail(
          license.userId,
          license.licenseKey,
          daysRemaining
        );
        if (sent) sentCount++;
      }
    }

    console.log(`[Email] Sent ${sentCount} expiry warning emails`);
    return sentCount;
  } catch (error) {
    console.error('[Email] Bulk warning error:', error);
    return 0;
  }
}
