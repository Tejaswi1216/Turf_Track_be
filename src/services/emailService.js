import nodemailer from 'nodemailer';
import { OTP_EXPIRY_SECONDS } from '../config/constants.js';

function getMailFrom() {
  const smtpUser = process.env.SMTP_USER;
  if (smtpUser) return smtpUser;

  const explicitFrom = process.env.MAIL_FROM || process.env.RESEND_FROM;
  if (explicitFrom) return explicitFrom;

  return `Turf Track <no-reply@${process.env.SUPABASE_URL?.replace(/^https?:\/\//, '') || 'local'}>`;
}

async function sendWithResend(toEmail, code) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const from = process.env.RESEND_FROM || getMailFrom();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: 'Your verification code',
      text: `Your OTP code: ${code}\n\nIt expires in ${Math.floor(OTP_EXPIRY_SECONDS / 60)} minutes.`,
      html: `<p>Your OTP code: <strong>${code}</strong></p><p>It expires in ${Math.floor(OTP_EXPIRY_SECONDS / 60)} minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend API error ${response.status}: ${details}`);
  }

  const result = await response.json().catch(() => ({}));
  console.log(`OTP email sent via Resend to ${toEmail} id=${result?.id || 'unknown'}`);
  return result;
}

function buildSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE).toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be set for SMTP delivery');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

async function sendWithSmtp(toEmail, code) {
  const transporter = buildSmtpTransport();
  const from = getMailFrom();

  try {
    await transporter.verify();
  } catch (err) {
    console.error('SMTP verify failed:', err);
    const message = String(err?.message || '');
    if (/535|authentication|auth|username and password/i.test(message)) {
      throw new Error('Gmail SMTP authentication failed. Replace SMTP_PASS with a valid Google App Password and restart the backend.');
    }
    throw err;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'Your verification code',
      text: `Your OTP code: ${code}`,
      html: `<p>Your OTP code: <strong>${code}</strong></p><p>It expires in ${Math.floor(OTP_EXPIRY_SECONDS / 60)} minutes.</p>`,
    });

    console.log(`OTP email sent via SMTP to ${toEmail} messageId=${info.messageId}`);
    return info;
  } catch (err) {
    console.error('SMTP sendMail failed:', err);
    const message = String(err?.message || '');
    if (/535|authentication|auth|username and password/i.test(message)) {
      throw new Error('Gmail SMTP authentication failed. Replace SMTP_PASS with a valid Google App Password and restart the backend.');
    }
    throw err;
  }
}

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(toEmail, code) {
  try {
    const provider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    if (provider === 'resend' && hasResend) {
      try {
        return await sendWithResend(toEmail, code);
      } catch (err) {
        const message = String(err?.message || err);
        const canFallback = hasSmtp && /validation_error|verify a domain|testing emails/i.test(message);
        if (canFallback) {
          console.warn('Resend rejected this recipient; falling back to SMTP.', message);
          return await sendWithSmtp(toEmail, code);
        }
        throw err;
      }
    }

    if (provider === 'smtp' || hasSmtp) {
      return await sendWithSmtp(toEmail, code);
    }

    if (hasResend) {
      return await sendWithResend(toEmail, code);
    }

    throw new Error('No email provider configured. Set SMTP_* or RESEND_API_KEY.');
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    throw err;
  }
}
