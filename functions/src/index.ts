/**
 * Cloud Functions for Trained
 *
 * Handles team invitation emails via Brevo SMTP.
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {createTransport, Transporter} from "nodemailer";

setGlobalOptions({maxInstances: 10});

// Brevo SMTP credentials (same account as FIFO Ops / Home Digest)
const brevoSmtpUser = defineSecret("BREVO_SMTP_USER");
const brevoSmtpPass = defineSecret("BREVO_SMTP_PASS");

// Lazy transporter — created on first invocation when secrets are available
let transporter: Transporter | null = null;

function getTransporter(user: string, pass: string): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {user, pass},
    });
  }
  return transporter;
}

const APP_URL = "https://traind-platform.web.app";
const SENDER = "\"Trained\" <trained@fifo.systems>";
const REPLY_TO = "riaan@fifo.systems";

function buildInviteEmail(data: {
  organizationName: string;
  invitedByName: string;
  role: string;
  token: string;
  organizationId: string;
}): {subject: string; html: string} {
  const roleName = data.role === "ORG_ADMIN" ? "Admin" : "Trainer";
  const acceptUrl =
    `${APP_URL}/invite/accept?token=${data.token}&org=${data.organizationId}`;

  const subject =
    `You've been invited to join ${data.organizationName} on Trained`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f172a; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.05em;">TRAINED</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">
          You've been invited!
        </h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 8px;">
          <strong>${data.invitedByName}</strong> has invited you to join
          <strong>${data.organizationName}</strong> as a <strong>${roleName}</strong>.
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Trained is an interactive post-training engagement platform where you
          can create and run quizzes, game shows, and learning activities.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptUrl}"
             style="display: inline-block; background: #0ea5e9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
          This invitation expires in 7 days.
        </p>
      </div>
      <div style="background: #f3f4f6; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return {subject, html};
}

// Shared handler for both dev and prod triggers
async function handleInvitationCreated(
  event: Parameters<Parameters<typeof onDocumentCreated>[1]>[0]
): Promise<void> {
  const snapshot = event.data;
  if (!snapshot) {
    logger.error("No data in invitation document");
    return;
  }

  const invitation = snapshot.data();
  const inviteId = event.params.inviteId;

  if (!invitation.email || !invitation.token) {
    logger.error(`Invitation ${inviteId} missing email or token`);
    return;
  }

  const {subject, html} = buildInviteEmail({
    organizationName: invitation.organizationName || "an organization",
    invitedByName: invitation.invitedByName || "A team member",
    role: invitation.role || "TRAINER",
    token: invitation.token,
    organizationId: invitation.organizationId,
  });

  try {
    const mailer = getTransporter(
      brevoSmtpUser.value(),
      brevoSmtpPass.value()
    );
    await mailer.sendMail({
      from: SENDER,
      to: invitation.email,
      replyTo: REPLY_TO,
      subject,
      html,
    });
    logger.info(
      `Invite email sent for ${inviteId} to ${invitation.email}`
    );
  } catch (error) {
    logger.error(`Failed to send invite email for ${inviteId}:`, error);
    // Don't throw — invitation doc is still created, admin can resend
  }
}

// Dev environment trigger
export const onInvitationCreatedDev = onDocumentCreated(
  {
    document: "dev-organizations/{orgId}/invitations/{inviteId}",
    secrets: [brevoSmtpUser, brevoSmtpPass],
  },
  handleInvitationCreated
);

// Production environment trigger
export const onInvitationCreatedProd = onDocumentCreated(
  {
    document: "organizations/{orgId}/invitations/{inviteId}",
    secrets: [brevoSmtpUser, brevoSmtpPass],
  },
  handleInvitationCreated
);
