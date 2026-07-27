import * as db from './db';
import { notifyOwner } from './_core/notification';

/**
 * Request a license transfer
 */
export async function requestLicenseTransfer(
  licenseId: number,
  fromUserId: number,
  toUserEmail: string
) {
  try {
    // Validate license exists and belongs to user
    const license = await db.getLicenseById(licenseId);
    if (!license || license.userId !== fromUserId) {
      throw new Error('License not found or unauthorized');
    }

    // Find recipient user
    const toUser = await db.getUserByEmail(toUserEmail);
    if (!toUser) {
      throw new Error('Recipient user not found');
    }

    // Check if transfer already pending
    const pendingTransfers = await db.getPendingTransfers();
    const existingTransfer = pendingTransfers.find(t => t.licenseId === licenseId);
    if (existingTransfer) {
      throw new Error('Transfer already pending for this license');
    }

    // Create transfer request
    await db.createLicenseTransfer({
      fromUserId,
      toUserId: toUser.id,
      licenseId,
      status: 'pending',
    });

    // Get the created transfer
    const pendingTransfers2 = await db.getPendingTransfers();
    const transfer = pendingTransfers2.find(t => t.licenseId === licenseId && t.toUserId === toUser.id);

    if (!transfer) {
      throw new Error('Failed to create transfer');
    }

    // Log audit
    await db.createAuditLog({
      userId: fromUserId,
      action: 'REQUEST_LICENSE_TRANSFER',
      entityType: 'license_transfer',
      entityId: transfer.id,
      changes: {
        licenseId,
        toUserId: toUser.id,
      },
    });

    // Notify owner of pending transfer
    await notifyOwner({
      title: 'License Transfer Request Pending',
      content: `A transfer has been requested for license ${license.licenseKey} from user ${fromUserId} to user ${toUser.id}. Please review and approve or reject.`,
    });

    return transfer;
  } catch (error) {
    console.error('[Transfer] Request error:', error);
    throw error;
  }
}

/**
 * Approve a license transfer
 */
export async function approveLicenseTransfer(
  transferId: number,
  approvedBy: number
) {
  try {
    const transfer = await db.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Transfer is not pending');
    }

    // Get license and update owner
    const license = await db.getLicenseById(transfer.licenseId);
    if (!license) {
      throw new Error('License not found');
    }

    // Update license owner
    const db_instance = await db.getDb();
    if (!db_instance) throw new Error('Database not available');

    await (db_instance as any).execute(
      'UPDATE licenses SET userId = ?, status = ? WHERE id = ?',
      [transfer.toUserId, 'active', transfer.licenseId]
    );

    // Update transfer status
    await db.updateTransferStatus(transferId, 'approved', approvedBy);

    // Log audit
    await db.createAuditLog({
      userId: approvedBy,
      action: 'APPROVE_LICENSE_TRANSFER',
      entityType: 'license_transfer',
      entityId: transferId,
      changes: {
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        licenseId: transfer.licenseId,
      },
    });

    // Notify both users
    await notifyOwner({
      title: 'License Transfer Approved',
      content: `License transfer ${transferId} has been approved. License ${license.licenseKey} is now owned by user ${transfer.toUserId}.`,
    });

    return transfer;
  } catch (error) {
    console.error('[Transfer] Approval error:', error);
    throw error;
  }
}

/**
 * Reject a license transfer
 */
export async function rejectLicenseTransfer(
  transferId: number,
  rejectionReason: string,
  rejectedBy: number
) {
  try {
    const transfer = await db.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Transfer is not pending');
    }

    // Update transfer status
    const db_instance = await db.getDb();
    if (!db_instance) throw new Error('Database not available');
    
    await (db_instance as any).execute(
      'UPDATE license_transfers SET status = ?, approvedBy = ?, rejectionReason = ? WHERE id = ?',
      ['rejected', rejectedBy, rejectionReason, transferId]
    );

    // Log audit
    await db.createAuditLog({
      userId: rejectedBy,
      action: 'REJECT_LICENSE_TRANSFER',
      entityType: 'license_transfer',
      entityId: transferId,
      changes: {
        reason: rejectionReason,
      },
    });

    // Notify owner
    await notifyOwner({
      title: 'License Transfer Rejected',
      content: `License transfer ${transferId} has been rejected. Reason: ${rejectionReason}`,
    });

    return transfer;
  } catch (error) {
    console.error('[Transfer] Rejection error:', error);
    throw error;
  }
}

/**
 * Get all pending transfers
 */
export async function getPendingTransfers() {
  try {
    return await db.getPendingTransfers();
  } catch (error) {
    console.error('[Transfer] Fetch error:', error);
    throw error;
  }
}

/**
 * Get transfer details
 */
export async function getTransferDetails(transferId: number) {
  try {
    const transfer = await db.getTransferById(transferId);
    if (!transfer) {
      return null;
    }

    const license = await db.getLicenseById(transfer.licenseId);
    const fromUser = await db.getUserById(transfer.fromUserId);
    const toUser = await db.getUserById(transfer.toUserId);

    return {
      ...transfer,
      license,
      fromUser,
      toUser,
    };
  } catch (error) {
    console.error('[Transfer] Details error:', error);
    throw error;
  }
}

/**
 * Cancel a transfer request
 */
export async function cancelTransfer(transferId: number, cancelledBy: number) {
  try {
    const transfer = await db.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Only pending transfers can be cancelled');
    }

    // Update transfer status
    await db.updateTransferStatus(transferId, 'cancelled', cancelledBy);

    // Log audit
    await db.createAuditLog({
      userId: cancelledBy,
      action: 'CANCEL_LICENSE_TRANSFER',
      entityType: 'license_transfer',
      entityId: transferId,
      changes: {},
    });

    return transfer;
  } catch (error) {
    console.error('[Transfer] Cancellation error:', error);
    throw error;
  }
}
