import * as db from './db';
import { storagePut, storageGet } from './storage';

export interface DocumentUploadInput {
  licenseId: number;
  userId: number;
  documentType: 'payment_proof' | 'transfer_agreement' | 'instance_log' | 'other';
  fileName: string;
  fileData: Buffer;
  mimeType: string;
}

/**
 * Upload document to S3 and store metadata in database
 */
export async function uploadDocument(input: DocumentUploadInput) {
  try {
    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (input.fileData.length > maxSize) {
      throw new Error('File size exceeds 50MB limit');
    }

    // Generate unique file key
    const s3Key = `documents/${input.licenseId}/${Date.now()}-${input.fileName}`;

    // Upload to S3
    const { url } = await storagePut(s3Key, input.fileData, input.mimeType);

    // Store metadata in database
    await db.createDocument({
      licenseId: input.licenseId,
      uploadedBy: input.userId,
      type: input.documentType,
      fileName: input.fileName,
      s3Key,
      fileSize: input.fileData.length,
      mimeType: input.mimeType,
    });

    // Get the created document
    const docs = await db.getDocumentsByLicenseId(input.licenseId);
    const document = docs[docs.length - 1];

    // Log audit
    await db.createAuditLog({
      userId: input.userId,
      action: 'UPLOAD_DOCUMENT',
      entityType: 'document',
      entityId: document?.id || 0,
      changes: {
        licenseId: input.licenseId,
        documentType: input.documentType,
        fileName: input.fileName,
      },
    });

    return document || {};
  } catch (error) {
    console.error('[Document] Upload error:', error);
    throw error;
  }
}

/**
 * Get presigned download URL for document
 */
export async function getDocumentDownloadUrl(
  documentId: number,
  userId: number
): Promise<string> {
  try {
    // Get document from license documents
    const licenses = await db.getAllActiveLicenses();
    let document: any = null;
    
    for (const license of licenses) {
      const docs = await db.getDocumentsByLicenseId(license.id);
      const found = docs.find(d => d.id === documentId);
      if (found) {
        document = found;
        break;
      }
    }

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to this document
    const license = await db.getLicenseById(document.licenseId);
    if (!license || license.userId !== userId) {
      throw new Error('Access denied');
    }

    // Get presigned URL (valid for 1 hour)
    const { url } = await storageGet(document.s3Key);

    // Log download in audit
    await db.createAuditLog({
      userId,
      action: 'DOWNLOAD_DOCUMENT',
      entityType: 'document',
      entityId: documentId,
      changes: {
        fileName: document.fileName,
      },
    });

    return url || '';
  } catch (error) {
    console.error('[Document] Download URL error:', error);
    throw error;
  }
}

/**
 * Get all documents for a license
 */
export async function getLicenseDocuments(licenseId: number) {
  try {
    const docs = await db.getDocumentsByLicenseId(licenseId);
    return docs || [];
  } catch (error) {
    console.error('[Document] Fetch error:', error);
    throw error;
  }
}

/**
 * Delete document
 */
export async function deleteDocument(documentId: number, userId: number) {
  try {
    // Get all documents and find the one
    const licenses = await db.getAllActiveLicenses();
    let document: any = null;
    
    for (const license of licenses) {
      const docs = await db.getDocumentsByLicenseId(license.id);
      const found = docs.find(d => d.id === documentId);
      if (found) {
        document = found;
        break;
      }
    }

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has permission
    const license = await db.getLicenseById(document.licenseId);
    if (!license || license.userId !== userId) {
      throw new Error('Access denied');
    }

    // Log audit
    await db.createAuditLog({
      userId,
      action: 'DELETE_DOCUMENT',
      entityType: 'document',
      entityId: documentId,
      changes: {
        fileName: document.fileName,
      },
    });

    return { success: true, documentId };
  } catch (error) {
    console.error('[Document] Delete error:', error);
    throw error;
  }
}

/**
 * Get document statistics
 */
export async function getDocumentStats() {
  try {
    // Get all documents from all licenses
    const licenses = await db.getAllActiveLicenses();
    const allDocuments: any[] = [];
    
    for (const license of licenses) {
      const docs = await db.getDocumentsByLicenseId(license.id);
      allDocuments.push(...docs);
    }
    
    const stats = {
      totalDocuments: allDocuments.length,
      byType: {
        payment_proof: 0,
        transfer_agreement: 0,
        instance_log: 0,
        other: 0,
      },
      totalSize: 0,
      averageSize: 0,
    };

    for (const doc of allDocuments) {
      const docType = doc.type as keyof typeof stats.byType;
      if (docType in stats.byType) {
        stats.byType[docType]++;
      }
      stats.totalSize += doc.fileSize || 0;
    }

    if (allDocuments.length > 0) {
      stats.averageSize = Math.round(stats.totalSize / allDocuments.length);
    }

    return stats;
  } catch (error) {
    console.error('[Document] Stats error:', error);
    throw error;
  }
}
