import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { db, schema } from "@/db";
import { count } from "drizzle-orm";
import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: `"World Ark Missions" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export const auth = betterAuth({
  // BETTER_AUTH_URL locally; on Vercel fall back to the project's production domain.
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  user: {
    additionalFields: {
      passwordChangeRequired: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const result = await db.select({ value: count() }).from(schema.user);
          if (result[0].value > 0) {
            throw new Error("Signups are disabled");
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [
    nextCookies(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendEmail({
            to: user.email,
            subject: "Your Login Code – World Ark Missions",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;text-align:center;">
                <h2 style="color:#1e3a8a;margin-bottom:8px;">Login Code</h2>
                <p style="color:#475569;margin-bottom:24px;">
                  Use the following code to continue logging in. This code expires in 5 minutes.
                </p>
                <div style="background:#f1f5f9;padding:16px;border-radius:12px;font-size:24px;font-weight:900;letter-spacing:4px;color:#0f172a;margin-bottom:24px;">
                  ${otp}
                </div>
              </div>
            `,
          });
        },
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "forget-password") {
          await sendEmail({
            to: email,
            subject: "Your Password Reset Code – World Ark Missions",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;text-align:center;">
                <h2 style="color:#1e3a8a;margin-bottom:8px;">Password Reset Code</h2>
                <p style="color:#475569;margin-bottom:24px;">
                  Use the following code to reset your password. This code expires in 5 minutes.
                </p>
                <div style="background:#f1f5f9;padding:16px;border-radius:12px;font-size:24px;font-weight:900;letter-spacing:4px;color:#0f172a;margin-bottom:24px;">
                  ${otp}
                </div>
                <p style="color:#94a3b8;margin-top:24px;font-size:12px;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </div>
            `,
          });
        }
      },
    }),
  ],
});
