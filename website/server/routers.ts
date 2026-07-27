import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ LICENSE ROUTES ============
  licenses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLicensesByUserId(ctx.user.id);
    }),

    detail: protectedProcedure
      .input(z.object({ licenseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const license = await db.getLicenseById(input.licenseId);
        if (!license || license.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return license;
      }),

    create: protectedProcedure
      .input(z.object({
        planType: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']),
        stripeSubscriptionId: z.string(),
        stripeCustomerId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const licenseKey = `LIC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const expiryDate = new Date();
        
        switch (input.planType) {
          case 'monthly':
            expiryDate.setMonth(expiryDate.getMonth() + 1);
            break;
          case 'quarterly':
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            break;
          case 'semi_annual':
            expiryDate.setMonth(expiryDate.getMonth() + 6);
            break;
          case 'annual':
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            break;
        }

        return await db.createLicense({
          userId: ctx.user.id,
          licenseKey,
          planType: input.planType,
          expiryDate,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeCustomerId: input.stripeCustomerId,
          status: 'active',
        });
      }),
  }),

  // ============ BOT INSTANCE ROUTES ============
  instances: router({
    list: protectedProcedure
      .input(z.object({ licenseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const license = await db.getLicenseById(input.licenseId);
        if (!license || license.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.getBotInstancesByLicenseId(input.licenseId);
      }),

    create: protectedProcedure
      .input(z.object({
        licenseId: z.number(),
        botToken: z.string(),
        serverId: z.string(),
        ownerId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const license = await db.getLicenseById(input.licenseId);
        if (!license || license.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        if (license.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'License is not active' });
        }

        return await db.createBotInstance({
          licenseId: input.licenseId,
          botToken: input.botToken,
          serverId: input.serverId,
          ownerId: input.ownerId,
          instanceStatus: 'pending',
        });
      }),
  }),

  // ============ PAYMENT ROUTES ============
  payments: router({
    createCheckout: protectedProcedure
      .input(z.object({
        planType: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCheckoutSession } = await import('./stripe-service');
        const checkoutUrl = await createCheckoutSession(
          ctx.user.id,
          ctx.user.email || '',
          ctx.user.name || 'Customer',
          input.planType,
          ctx.req.headers.origin || 'https://localhost:3000',
        );
        return { url: checkoutUrl };
      }),
  }),

  // ============ TRANSFER ROUTES ============
  transfers: router({
    request: protectedProcedure
      .input(z.object({
        licenseId: z.number(),
        toUserEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const license = await db.getLicenseById(input.licenseId);
        if (!license || license.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const toUser = await db.getUserByEmail(input.toUserEmail);
        if (!toUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        return await db.createLicenseTransfer({
          fromUserId: ctx.user.id,
          toUserId: toUser.id,
          licenseId: input.licenseId,
          status: 'pending',
        });
      }),
  }),

  // ============ ADMIN ROUTES ============
  admin: router({
    licenses: router({
      list: adminProcedure.query(async () => {
        return await db.getAllActiveLicenses();
      }),

      detail: adminProcedure
        .input(z.object({ licenseId: z.number() }))
        .query(async ({ input }) => {
          return await db.getLicenseById(input.licenseId);
        }),
    }),

    transfers: router({
      pending: adminProcedure.query(async () => {
        return await db.getPendingTransfers();
      }),

      approve: adminProcedure
        .input(z.object({ transferId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const transfer = await db.getTransferById(input.transferId);
          if (!transfer) {
            throw new TRPCError({ code: 'NOT_FOUND' });
          }

          const license = await db.getLicenseById(transfer.licenseId);
          if (!license) {
            throw new TRPCError({ code: 'NOT_FOUND' });
          }

          // Update license to new user
          await db.updateLicenseStatus(license.id, 'active');
          
          // Update transfer status
          return await db.updateTransferStatus(transfer.id, 'approved', ctx.user.id);
        }),

      reject: adminProcedure
        .input(z.object({ transferId: z.number(), reason: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const transfer = await db.getTransferById(input.transferId);
          if (!transfer) {
            throw new TRPCError({ code: 'NOT_FOUND' });
          }

          return await db.updateTransferStatus(transfer.id, 'rejected', ctx.user.id);
        }),
    }),

    auditLogs: router({
      list: adminProcedure.query(async () => {
        return await db.getAuditLogs(100);
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
