"use server";

import { sendEmail } from "@/lib/auth";

export async function sendPasswordResetConfirmation(email: string) {
  await sendEmail({
    to: email,
    subject: "Your password was recently changed – World Ark Missions",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;text-align:center;">
        <h2 style="color:#1e3a8a;margin-bottom:8px;">Password Reset Successful</h2>
        <p style="color:#475569;margin-bottom:24px;">
          Your password for World Ark Missions has been successfully updated.
        </p>
        <p style="color:#475569;margin-bottom:24px;">
          If you did not make this change, please contact your administrator immediately.
        </p>
      </div>
    `,
  });
}
