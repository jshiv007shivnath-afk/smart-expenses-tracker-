import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../src/db/index.ts";
import * as schema from "../src/db/schema.ts";
import dotenv from "dotenv";

dotenv.config();

const hasGoogleOAuth = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "08c2d8b582beca8b9aeab75756421626ce8f8d39c6673b0b6a4a5bf58d91ed9e",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.APP_URL ||
    "https://ais-dev-x67aw75mcots4ivlitzxlz-1774014748.asia-southeast1.run.app",
  trustedOrigins: (request) => {
    const origins = [
      "https://*.run.app",
      "*.run.app",
      "https://*.aistudio.google.com",
      "https://ais-dev-x67aw75mcots4ivlitzxlz-1774014748.asia-southeast1.run.app",
      "https://ais-pre-x67aw75mcots4ivlitzxlz-1774014748.asia-southeast1.run.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
    ];
    if (request && request.headers) {
      const origin = request.headers.get("origin") || request.headers.get("referer");
      if (origin) {
        try {
          origins.push(new URL(origin).origin);
        } catch {}
      }
    }
    return origins;
  },
  advanced: {
    trustedProxyHeaders: true,
  },
  emailAndPassword: {
    enabled: true,
  },
  ...(hasGoogleOAuth
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        },
      }
    : {}),
});
