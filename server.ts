import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { db } from "./src/db/index.ts";
import { transactions, users } from "./src/db/schema.ts";
import { eq, desc, and } from "drizzle-orm";
import Stripe from "stripe";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";

// Security & Validation Middlewares
import {
  authExponentialBackoffLimiter,
  publicEndpointLimiter,
  authenticatedUserLimiter,
  stripeOperationsLimiter,
  aiFeatureLimiter,
} from "./src/middleware/rateLimiter.ts";

import {
  validateBody,
  validateQuery,
} from "./src/middleware/validate.ts";

import {
  authSyncSchema,
  createTransactionSchema,
  updateUserProfileSchema,
  getTransactionsQuerySchema,
  createPaymentIntentSchema,
  confirmPaymentIntentSchema,
  verifySessionSchema,
  geminiInsightsSchema,
  scanReceiptSchema,
  monthlySummarySchema,
} from "./src/schemas/index.ts";

import { globalErrorHandler } from "./src/middleware/errorHandler.ts";
import { validateAndStoreUploadedFile } from "./src/middleware/upload.ts";

dotenv.config();

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;

  // Body parser with size limits
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 0. DATABASE STATUS ROUTE: Check PostgreSQL Cloud SQL status
  app.get("/api/db/status", publicEndpointLimiter, async (_req, res) => {
    try {
      await db.select().from(users).limit(1);
      res.json({
        status: "connected",
        database: "PostgreSQL (Cloud SQL)",
        instance: "ai-studio-c9c229b3",
        region: "asia-southeast1",
        connected: true,
      });
    } catch (err: any) {
      console.error("DB status check error:", err);
      res.status(500).json({ status: "error", error: err.message, connected: false });
    }
  });

  // 1. AUTHENTICATION ROUTE: Sync User (Stricter limit + Exponential Backoff + Strict Schema)
  app.post(
    "/api/auth/sync",
    authExponentialBackoffLimiter,
    requireAuth,
    validateBody(authSyncSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const dbUser = await getOrCreateUser(req.user.uid, req.user.email || "");
        res.json(dbUser);
      } catch (error) {
        next(error);
      }
    }
  );

  // 1b. BETTER AUTH API ROUTE: Handles all Better Auth endpoints (/api/auth/*)
  app.all("/api/auth/*", toNodeHandler(auth));

  // 1c. USER PROFILE ROUTES (PostgreSQL)
  app.get(
    "/api/user/profile",
    authenticatedUserLimiter,
    requireAuth,
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const dbUser = await getOrCreateUser(req.user.uid, req.user.email || "");
        res.json(dbUser);
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    "/api/user/profile",
    authenticatedUserLimiter,
    requireAuth,
    validateBody(updateUserProfileSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const { budget, balance, currency, currencySymbol } = req.body;
        
        await getOrCreateUser(req.user.uid, req.user.email || "");

        const updateData: any = {};
        if (typeof budget === "number") updateData.budget = budget;
        if (typeof balance === "number") updateData.balance = balance;
        if (typeof currency === "string") updateData.currency = currency;
        if (typeof currencySymbol === "string") updateData.currencySymbol = currencySymbol;

        const updated = await db
          .update(users)
          .set(updateData)
          .where(eq(users.uid, req.user.uid))
          .returning();

        res.json(updated[0]);
      } catch (error) {
        next(error);
      }
    }
  );

  // 2. AUTHENTICATED USER ROUTE: Get Transactions from PostgreSQL
  app.get(
    "/api/transactions",
    authenticatedUserLimiter,
    requireAuth,
    validateQuery(getTransactionsQuerySchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const dbUser = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (!dbUser.length) {
          return res.status(404).json({ error: "User profile not found" });
        }

        const userTransactions = await db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, dbUser[0].id))
          .orderBy(desc(transactions.createdAt));

        res.json(userTransactions);
      } catch (error) {
        next(error);
      }
    }
  );

  // 2b. CREATE TRANSACTION IN POSTGRESQL
  app.post(
    "/api/transactions",
    authenticatedUserLimiter,
    requireAuth,
    validateBody(createTransactionSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const dbUser = await getOrCreateUser(req.user.uid, req.user.email || "");

        const { type, amount, date, time, title, subtitle, note, category } = req.body;
        const normalizedType = type === "topup" ? "topup" : type;

        const newTx = await db
          .insert(transactions)
          .values({
            userId: dbUser.id,
            type: normalizedType,
            amount,
            date: date || new Date().toISOString().split("T")[0],
            time: time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            title: title || (normalizedType === "topup" ? "Account Top Up" : "Expense"),
            subtitle: subtitle || category || (note ? note : "Transaction"),
            note: note || "",
            category: category || subtitle || "General",
          })
          .returning();

        const currentBalance = dbUser.balance ?? 0;
        const balanceDelta = normalizedType === "topup" || normalizedType === "income" ? amount : -amount;
        const newBalance = currentBalance + balanceDelta;

        await db.update(users).set({ balance: newBalance }).where(eq(users.id, dbUser.id));

        res.json({ transaction: newTx[0], newBalance });
      } catch (error) {
        next(error);
      }
    }
  );

  // 2c. DELETE TRANSACTION FROM POSTGRESQL
  app.delete(
    "/api/transactions/:id",
    authenticatedUserLimiter,
    requireAuth,
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const dbUser = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
        if (!dbUser.length) {
          return res.status(404).json({ error: "User not found" });
        }

        const txId = parseInt(req.params.id, 10);
        if (isNaN(txId)) {
          return res.status(400).json({ error: "Invalid transaction ID" });
        }

        const deleted = await db
          .delete(transactions)
          .where(and(eq(transactions.id, txId), eq(transactions.userId, dbUser[0].id)))
          .returning();

        res.json({ success: true, deleted: deleted[0] });
      } catch (error) {
        next(error);
      }
    }
  );

  // 3. PUBLIC ENDPOINT: Get Stripe Config (Public Moderate Limiter)
  app.get("/api/stripe/config", publicEndpointLimiter, (_req, res) => {
    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || "";
    res.json({ publishableKey, hasSecretKey: Boolean(process.env.STRIPE_SECRET_KEY) });
  });

  // 4. STRIPE ROUTE: Create Payment Intent (Stripe Limiter + Strict Body Schema)
  app.post(
    "/api/stripe/create-payment-intent",
    stripeOperationsLimiter,
    requireAuth,
    validateBody(createPaymentIntentSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { amount, currency } = req.body;

        if (process.env.STRIPE_SECRET_KEY) {
          const stripe = getStripe();
          const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method_types: ["card"],
            metadata: {
              uid: req.user.uid,
              email: req.user.email || "",
              product: "Pro Upgrade - Expense Sheets & AI Forecasting",
            },
          });

          return res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            isDemoMode: false,
            amount,
            currency,
          });
        } else {
          const demoId = `demo_pi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          return res.json({
            clientSecret: `${demoId}_secret_demo`,
            paymentIntentId: demoId,
            isDemoMode: true,
            amount,
            currency,
            message: "Running in secure sandbox demo mode.",
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // 5. STRIPE ROUTE: Confirm Payment Intent (Stripe Limiter + Strict Body Schema)
  app.post(
    "/api/stripe/confirm-payment-intent",
    stripeOperationsLimiter,
    requireAuth,
    validateBody(confirmPaymentIntentSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { paymentIntentId } = req.body;
        let isSuccess = false;

        if (paymentIntentId.startsWith("demo_") || !process.env.STRIPE_SECRET_KEY) {
          isSuccess = true;
        } else {
          const stripe = getStripe();
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
            isSuccess = true;
          } else {
            return res.status(400).json({ error: "Payment was not completed successfully." });
          }
        }

        if (isSuccess) {
          await db
            .update(users)
            .set({ isPremium: true })
            .where(eq(users.uid, req.user.uid));

          return res.json({ success: true, message: "Payment confirmed! Account upgraded to Pro." });
        } else {
          return res.status(400).json({ error: "Payment verification failed." });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // 6. STRIPE ROUTE: Create Checkout Session
  app.post(
    "/api/stripe/create-checkout-session",
    stripeOperationsLimiter,
    requireAuth,
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const stripe = getStripe();
        const origin = req.headers.origin || `http://localhost:${PORT}`;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "inr",
                product_data: {
                  name: "Pro Upgrade (2-Month Pass) - Expense Sheets & AI Forecasting",
                  description: "One-time payment of ₹99 for 2-Month Pro Access to predictive graphs and Smart AI analytics",
                },
                unit_amount: 9900,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            uid: req.user.uid,
            email: req.user.email || "",
          },
          success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
          cancel_url: `${origin}/`,
        });

        res.json({ id: session.id, url: session.url });
      } catch (error) {
        next(error);
      }
    }
  );

  // 7. STRIPE ROUTE: Verify Checkout Session
  app.post(
    "/api/stripe/verify-session",
    stripeOperationsLimiter,
    requireAuth,
    validateBody(verifySessionSchema),
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { sessionId } = req.body;
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid") {
          await db
            .update(users)
            .set({ isPremium: true })
            .where(eq(users.uid, req.user.uid));

          res.json({ success: true, message: "Payment verified and account upgraded successfully!" });
        } else {
          res.status(400).json({ error: "Payment was not successful or is still pending." });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // 8. STRIPE ROUTE: Reset Premium
  app.post(
    "/api/stripe/reset-premium",
    authenticatedUserLimiter,
    requireAuth,
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        await db
          .update(users)
          .set({ isPremium: false })
          .where(eq(users.uid, req.user.uid));

        res.json({ success: true, message: "Premium status successfully reset to Basic!" });
      } catch (error) {
        next(error);
      }
    }
  );

  // 9. GEMINI AI ROUTE: Predictive Insights (Dedicated AI Rate Limiter + Zod Schema Validation)
  let aiClient: GoogleGenAI | null = null;
  function getGenAI(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  async function generateGeminiContent(options: { contents: any; responseMimeType?: string }) {
    const modelsToTry = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-pro-preview"];
    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await getGenAI().models.generateContent({
          model,
          contents: options.contents,
          config: options.responseMimeType ? { responseMimeType: options.responseMimeType } : undefined,
        });
        return response;
      } catch (err: any) {
        console.warn(`Gemini model ${model} call failed, trying next fallback:`, err?.message || err);
        lastError = err;
      }
    }
    throw lastError;
  }

  app.post(
    "/api/gemini/insights",
    aiFeatureLimiter,
    validateBody(geminiInsightsSchema),
    async (req, res, next) => {
      try {
        const { user, transactions, categories, recurring, forecast } = req.body;

        const prompt = `
          You are an advanced predictive personal finance assistant. Analyze the user's spending data and forecast for the current month.
          Provide actionable, highly personalized advice to help them stay under budget or manage their funds optimally.

          User Details:
          - Monthly Budget: ${user.monthlyBudget} ${user.currency}
          - Locale: ${user.locale}
          
          Forecast Results:
          - Current Spend to Date: ${forecast.currentSpend} ${user.currency}
          - Linear Spend Projection: ${forecast.linearProjection} ${user.currency}
          - Unbilled Recurring Bills/Subscriptions: ${forecast.unbilledRecurring} ${user.currency}
          - Projected Total Month-End Spend: ${forecast.projectedTotal} ${user.currency}
          - Days Elapsed in Month: ${forecast.daysElapsed} days
          - Days in Month: ${forecast.daysInMonth} days
          - Average Daily Spend so far: ${forecast.averageDailySpend} ${user.currency}

          Categories:
          ${JSON.stringify(categories?.map((c: any) => ({ id: c.id, name: c.name })) || [])}

          Spend per Category (Current vs Projected):
          - Current Spend Breakdown: ${JSON.stringify(forecast.breakdown?.categoryCurrent || {})}
          - Projected Spend Breakdown: ${JSON.stringify(forecast.breakdown?.categoryProjected || {})}

          Active Recurring Subscriptions:
          ${JSON.stringify(recurring?.filter((r: any) => r.isActive).map((r: any) => ({ label: r.label, amount: r.amount, frequency: r.frequency, nextDueDate: r.nextDueDate })) || [])}

          Recent Transactions:
          ${JSON.stringify(transactions?.slice(0, 15).map((t: any) => ({ amount: t.amount, categoryId: t.categoryId, occurredAt: t.occurredAt, note: t.note, source: t.source })) || [])}

          Format your response as a structured JSON object with the following schema:
          {
            "executiveSummary": "A concise, conversational executive summary (max 3 sentences) summarizing their financial position.",
            "isAtRisk": true/false (whether they are highly likely to exceed their budget),
            "topRecommendations": [
              "Specific recommendation 1 with concrete math",
              "Specific recommendation 2 with concrete math"
            ],
            "categorySpecificAlerts": [
              {
                "categoryName": "Category name",
                "message": "Specific warning or insight about this category's trajectory"
              }
            ],
            "subscriptionOptimization": "Suggestions on passive savings via their recurring expenses (e.g. identify overlapping/high costs or suggestions to optimize subscriptions)"
          }
        `;

        const response = await generateGeminiContent({
          contents: prompt,
          responseMimeType: "application/json",
        });

        const text = response.text;
        if (!text) {
          throw new Error("No response text returned from Gemini API");
        }

        res.json(JSON.parse(text));
      } catch (error) {
        next(error);
      }
    }
  );

  // 10. GEMINI AI ROUTE: Scan Receipt with Vision AI (AI Rate Limiter + Zod Schema Validation)
  app.post(
    "/api/scan-receipt",
    aiFeatureLimiter,
    validateBody(scanReceiptSchema),
    async (req, res, next) => {
      try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      let mimeType = "image/jpeg";
      const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }

      const prompt = `
        You are an expert AI financial receipt, clothing bill, and invoice scanner with high-precision OCR vision.
        Examine the receipt image in detail and extract the exact merchant/store name, ALL individual item descriptions and their prices, date, time, category, total amount, tax, and payment method.

        CRITICAL EXTRACTION RULES:
        1. Merchant Name: Store, brand or merchant name (e.g., ZARA, H&M, Reliance Trends, Nike, D-Mart, Apple, Petrol Station, Starbucks, Amazon, etc.).
        2. Category Selection:
           - "Shopping": For clothes, apparel, garments, shoes, fashion accessories, electronics, retail, general shopping.
           - "Food": For restaurants, cafes, groceries, food delivery, dining.
           - "Transport": For fuel, cab, train, flight, parking.
           - "Bills": For utilities, electricity, mobile recharge, internet.
           - "Travel": For hotel bookings, tours, travel.
           - "Other": For any other category.
        3. ALL Items List: Extract EVERY item name and its individual price accurately.
           - For CLOTHES / GARMENTS / APPAREL: Include exact descriptions (e.g. "Cotton T-Shirt", "Slim Fit Denim Jeans", "Over-sized Hoodie", "Leather Belt", "Sneakers", "Summer Dress", "Formal Blazer").
           - Extract unit or line-item price for every item listed.
        4. Amounts: Extract exact total amount paid, sum of individual item prices, and tax/VAT/GST.
        5. Date & Time: Extract transaction date strictly in YYYY-MM-DD format if visible on bill (or current date if not visible).

        Return a JSON object matching this schema EXACTLY (no markdown, pure JSON):
        {
          "merchant": "Store Name",
          "amount": 1250.00,
          "date": "YYYY-MM-DD",
          "time": "14:30",
          "category": "Shopping" | "Food" | "Transport" | "Bills" | "Travel" | "Other",
          "items": [
            { "name": "Item Description", "price": 450.00 }
          ],
          "tax": 50.00,
          "paymentMethod": "Card" | "UPI" | "Cash"
        }
      `;

      const response = await generateGeminiContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        responseMimeType: "application/json",
      });

      const text = response.text;
      if (text) {
        let cleanText = text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
        }

        let parsed: any = {};
        try {
          parsed = JSON.parse(cleanText);
        } catch (e) {
          console.warn("Failed to parse Gemini receipt JSON directly, attempting regex repair:", e);
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (err2) {
              console.error("Regex JSON extraction failed:", err2);
            }
          }
        }

        // Sanitize and ensure robust field detection
        const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
        const items = rawItems.map((it: any, index: number) => ({
          id: String(index + 1),
          name: typeof it.name === "string" && it.name.trim() ? it.name.trim() : `Item ${index + 1}`,
          price: typeof it.price === "number" && !isNaN(it.price) ? Math.abs(it.price) : (parseFloat(it.price) || 0)
        }));

        let amount = typeof parsed.amount === "number" && !isNaN(parsed.amount) ? Math.abs(parsed.amount) : (parseFloat(parsed.amount) || 0);

        // If total price was not detected but individual item prices exist, sum them up
        if (amount === 0 && items.length > 0) {
          amount = items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
        }

        // Validate date format (YYYY-MM-DD)
        let dateStr = typeof parsed.date === "string" ? parsed.date.trim() : "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const parsedTimestamp = Date.parse(dateStr);
          if (!isNaN(parsedTimestamp)) {
            dateStr = new Date(parsedTimestamp).toISOString().split("T")[0];
          } else {
            dateStr = new Date().toISOString().split("T")[0];
          }
        }

        const merchant = typeof parsed.merchant === "string" && parsed.merchant.trim() ? parsed.merchant.trim() : "Scanned Store";
        const category = typeof parsed.category === "string" && ["Shopping", "Food", "Transport", "Bills", "Travel", "Other"].includes(parsed.category.trim()) ? parsed.category.trim() : "Shopping";

        // Compute dynamic confidence score based on detection completeness
        let detectedCount = 0;
        if (parsed.merchant) detectedCount++;
        if (parsed.amount && parsed.amount > 0) detectedCount++;
        if (parsed.date) detectedCount++;
        if (items.length > 0) detectedCount++;
        const confidenceScore = Math.min(99.5, Math.max(65.0, 60.0 + detectedCount * 9.5));

        const receipt = {
          merchant,
          amount: Math.round(amount * 100) / 100,
          date: dateStr,
          time: typeof parsed.time === "string" ? parsed.time.trim() : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          category,
          items,
          tax: typeof parsed.tax === "number" ? parsed.tax : (parseFloat(parsed.tax) || 0),
          paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "Card / Digital",
          confidenceScore: Math.round(confidenceScore * 10) / 10
        };

        return res.json({ receipt });
      }
      return res.status(500).json({ error: "Could not parse receipt image" });
    } catch (error) {
      console.error("Server receipt scan error:", error);
      return res.status(500).json({ error: "Failed to scan receipt image using AI" });
    }
  });

  // 11. GEMINI AI ROUTE: Monthly End-of-Month Calculation & Summary (AI Rate Limiter + Zod Schema Validation)
  app.post(
    "/api/gemini/monthly-summary",
    aiFeatureLimiter,
    validateBody(monthlySummarySchema),
    async (req, res, next) => {
      try {
      const { month, year, budget, transactions, currencySymbol = "$" } = req.body;

      const totalSpent = (transactions || [])
        .filter((t: any) => t.type === "expense")
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      const categoryTotals: Record<string, number> = {};
      (transactions || [])
        .filter((t: any) => t.type === "expense")
        .forEach((t: any) => {
          const cat = t.category || "Other";
          categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
        });

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[month] || "Current Month";

      const prompt = `
        You are a smart financial advisor calculating the Monthly End-of-Month Summary.
        
        Details for ${monthName} ${year}:
        - Budget: ${currencySymbol}${budget}
        - Total Spent: ${currencySymbol}${totalSpent}
        - Category Breakdown: ${JSON.stringify(categoryTotals)}
        - Number of Transactions: ${transactions?.length || 0}

        Respond with a JSON object in this format:
        {
          "monthName": "${monthName}",
          "year": ${year},
          "totalSpent": ${totalSpent},
          "budget": ${budget},
          "savingsOrOverspend": ${Math.abs(budget - totalSpent)},
          "isUnderBudget": ${totalSpent <= budget},
          "topCategory": "${Object.entries(categoryTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || 'General'}",
          "aiSummary": "A warm, encouraging 3-sentence analysis of this month's spending and savings performance.",
          "suggestedNextMonthBudget": ${Math.round(totalSpent * 1.05) || budget},
          "insights": [
            "Insight 1 with exact numbers",
            "Insight 2 with exact numbers"
          ]
        }
      `;

      const response = await generateGeminiContent({
        contents: prompt,
        responseMimeType: "application/json",
      });

      const text = response.text;
      if (text) {
        return res.json(JSON.parse(text));
      }

      return res.status(500).json({ error: "Failed to generate monthly summary" });
    } catch (error) {
      next(error);
    }
  });

  // 10. FILE UPLOAD ENDPOINT: Secure file upload with Content & Magic Byte Inspection
  app.post(
    "/api/upload",
    authenticatedUserLimiter,
    requireAuth,
    async (req: AuthRequest, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { filename, contentType, fileDataBase64 } = req.body;
        if (!filename || !contentType || !fileDataBase64) {
          return res.status(400).json({ error: "Missing required upload fields (filename, contentType, fileDataBase64)" });
        }

        // Decode base64 buffer safely
        const rawBuffer = Buffer.from(fileDataBase64, "base64");

        // Validate content magic bytes, size limits, and non-executable storage path
        const storedFile = validateAndStoreUploadedFile(rawBuffer, filename, contentType);

        return res.json({
          success: true,
          message: "File uploaded and validated securely.",
          fileId: storedFile.fileId,
          filename: storedFile.originalName,
          contentType: storedFile.contentType,
          sizeBytes: storedFile.sizeBytes,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // 11. Centralized Leak-Proof Error Handling Middleware
  app.use(globalErrorHandler);

  // Vite middleware for development vs static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running securely on http://localhost:${PORT}`);
  });
}

startServer();
