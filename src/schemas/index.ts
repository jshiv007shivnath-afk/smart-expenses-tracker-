import { z } from "zod";

// 1. Auth Sync Schema
export const authSyncSchema = z.object({}).strict();

// 2. Transaction Schemas
export const createTransactionSchema = z.object({
  amount: z.number().positive("Amount must be a positive number").max(1000000000, "Amount exceeds limit"),
  title: z.string().trim().max(255, "Title too long").optional(),
  subtitle: z.string().trim().max(255, "Subtitle too long").optional(),
  note: z.string().trim().max(500, "Note too long").optional(),
  type: z.enum(["expense", "income", "transfer", "send", "withdraw", "topup"]),
  category: z.string().trim().max(100, "Category name too long").optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  occurredAt: z.string().optional(),
});

export const updateUserProfileSchema = z.object({
  budget: z.number().nonnegative().optional(),
  balance: z.number().optional(),
  currency: z.string().max(10).optional(),
  currencySymbol: z.string().max(10).optional(),
});

export const getTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
}).strict();

// 3. Stripe Payment Intent Schemas
export const createPaymentIntentSchema = z.object({
  amount: z.number().int().min(100, "Amount must be at least ₹1.00 (100 paise)").max(10000000, "Amount exceeds maximum limit").optional().default(39900),
  currency: z.string().trim().toLowerCase().length(3, "Currency code must be 3 characters").optional().default("inr"),
}).strict();

export const confirmPaymentIntentSchema = z.object({
  paymentIntentId: z.string().trim().min(5).max(255).regex(/^(pi_|demo_pi_)[a-zA-Z0-9_]+$/, "Invalid PaymentIntent ID format"),
}).strict();

export const verifySessionSchema = z.object({
  sessionId: z.string().trim().min(5).max(255).regex(/^(cs_test_|cs_live_|demo_cs_)[a-zA-Z0-9_]+$/, "Invalid Checkout Session ID format"),
}).strict();

// 4. Smart AI Insights Schema
export const geminiInsightsSchema = z.object({
  user: z.object({
    monthlyBudget: z.number().nonnegative(),
    currency: z.string().trim().max(10),
    locale: z.string().trim().max(10),
  }),
  forecast: z.object({
    currentSpend: z.number(),
    linearProjection: z.number(),
    unbilledRecurring: z.number(),
    projectedTotal: z.number(),
    daysElapsed: z.number().int().min(0).max(31),
    daysInMonth: z.number().int().min(28).max(31),
    averageDailySpend: z.number(),
    breakdown: z.object({
      categoryCurrent: z.record(z.string(), z.number()).optional(),
      categoryProjected: z.record(z.string(), z.number()).optional(),
    }).optional(),
  }),
  categories: z.array(
    z.object({
      id: z.string().trim().max(100),
      name: z.string().trim().max(100),
    })
  ).max(100).optional(),
  recurring: z.array(
    z.object({
      label: z.string().trim().max(100),
      amount: z.number(),
      frequency: z.string().trim().max(50),
      isActive: z.boolean().optional(),
      nextDueDate: z.string().trim().max(50).optional(),
    })
  ).max(100).optional(),
  transactions: z.array(
    z.object({
      amount: z.number(),
      categoryId: z.string().trim().max(100).optional(),
      occurredAt: z.string().trim().max(100).optional(),
      note: z.string().trim().max(255).optional(),
      source: z.string().trim().max(50).optional(),
    })
  ).max(200).optional(),
}).strict();

// 5. Scan Receipt Schema
export const scanReceiptSchema = z.object({
  imageBase64: z.string().min(1, "Receipt image base64 data is required"),
}).strict();

// 6. Monthly Summary Schema
export const monthlySummarySchema = z.object({
  month: z.number().int().min(0).max(11),
  year: z.number().int().min(2000).max(2100),
  budget: z.number().nonnegative(),
  currencySymbol: z.string().trim().max(10).optional().default("$"),
  transactions: z.array(
    z.object({
      type: z.string().optional(),
      amount: z.union([z.number(), z.string()]),
      category: z.string().optional(),
    }).passthrough()
  ).max(500).optional(),
}).strict();

// 7. File Upload Verification Schema
export const fileUploadMetaSchema = z.object({
  filename: z.string().trim().min(1).max(255).regex(/^[a-zA-Z0-9_.-]+$/, "Filename contains forbidden characters"),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/csv"
  ], { message: "Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF, CSV" }),
  sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024, "File size must not exceed 5MB"),
}).strict();
