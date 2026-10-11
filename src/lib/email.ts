import { sendEmail } from "@/lib/auth";

export interface StaffEmailOptions {
  to: string;
  name: string;
  username?: string;
  role: string;
  churchName?: string;
  branches?: string;
  loginUrl: string;
  temporaryPassword: string;
  isReset?: boolean;
}

/**
 * Send staff welcome / credentials email with portal URL and temporary password.
 */
export async function sendStaffWelcomeEmail({
  to,
  name,
  username,
  role,
  churchName = "World Ark Missions",
  branches,
  loginUrl,
  temporaryPassword,
  isReset = false,
}: StaffEmailOptions): Promise<void> {
  const displayChurch = churchName || "World Ark Missions";
  const displayBranches = branches || displayChurch;
  const displayUsername = username || to.split("@")[0];

  const subject = isReset
    ? `Your Staff Portal Password Has Been Reset – ${displayChurch}`
    : `Welcome to the Staff Portal – Your Login Credentials (${displayChurch})`;

  const headline = isReset ? "Password Reset Notice" : "Welcome to the Staff Portal";
  const introText = isReset
    ? `Your staff login password for <strong>${displayChurch}</strong> has been updated by an administrator.`
    : `Your staff account for <strong>${displayChurch}</strong> has been created. You have been granted access as a <strong>${role}</strong>.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-width: 100%; background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%); padding: 36px 32px 32px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 8px 18px; background-color: rgba(255, 255, 255, 0.15); border-radius: 9999px; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.25);">
                      <span style="color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
                        World Ark Missions Portal
                      </span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">
                      ${headline}
                    </h1>
                    <p style="margin: 8px 0 0; color: #cbd5e1; font-size: 14px; font-weight: 500;">
                      ${displayChurch}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #0f172a;">
                Hello ${name || displayUsername},
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">
                ${introText} You can now sign in to access your modules, attendance, schedules, and ministry resources.
              </p>

              <!-- Credentials Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
                <p style="margin: 0 0 16px; font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
                  Your Sign-in Credentials
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 36%; vertical-align: top;">Portal URL:</td>
                    <td style="padding: 8px 0; color: #1e3a8a; font-weight: 700; word-break: break-all;">
                      <a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Email Address:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">
                      ${to}
                    </td>
                  </tr>
                  ${username && username !== to ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Username:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">
                      ${username}
                    </td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Role:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">
                      <span style="display: inline-block; background-color: #ede9fe; color: #6d28d9; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">
                        ${role}
                      </span>
                    </td>
                  </tr>
                  ${displayBranches ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Sanctuary / Branch:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">
                      ${displayBranches}
                    </td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td style="padding: 12px 0 4px; color: #64748b; font-weight: 600; vertical-align: middle;">Default Password:</td>
                    <td style="padding: 12px 0 4px; vertical-align: middle;">
                      <div style="display: inline-block; background-color: #0f172a; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; font-weight: 700; letter-spacing: 2px; padding: 8px 14px; border-radius: 8px;">
                        ${temporaryPassword}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Primary Action Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); text-align: center;">
                      Log In to Staff Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12.5px; color: #92400e; line-height: 1.5;">
                  <strong>Important Security Step:</strong> You will be required to change this default password immediately after signing in for the first time. Please choose a strong, unique password.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If the button above does not work, copy and paste this link into your web browser:<br>
                <a href="${loginUrl}" style="color: #2563eb; word-break: break-all;">${loginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #475569;">
                World Ark Missions &bull; Church Management System
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                This automated message was sent to ${to}. If you were not expecting this, please notify your church administrator immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await sendEmail({
    to,
    subject,
    html,
  });
}
