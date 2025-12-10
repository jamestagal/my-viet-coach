import validator from 'validator';
import { PUBLIC_APP_NAME } from '$env/static/public';
import { SMTP_HOST, SMTP_PORT, SMTP_EMAIL } from '$env/static/private';
import nodemailer from 'nodemailer';

// For production - uncomment these imports when switching to Mailgun
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_EMAIL, MAILGUN_URL } from '$env/static/private';

// Nodemailer transporter for Mailpit (development)
const transporter = nodemailer.createTransport({
  host: 'localhost', // Hardcoded for testing
  port: 1025, // Hardcoded Mailpit default port
  secure: false,
  ignoreTLS: true, // Mailpit doesn't need TLS for local testing
  debug: true, // Enable debug output
  logger: true // Log to console
});

// PRODUCTION: Mailgun setup
const mailgun = new Mailgun(formData);
export const mg = mailgun.client({ 
  username: 'api', 
  key: MAILGUN_API_KEY, 
  url: MAILGUN_URL || 'https://api.mailgun.net/v3' 
});

export async function sendmail({ fromName = PUBLIC_APP_NAME, fromEmail = SMTP_EMAIL || 'noreply@example.com', toEmail, replyTo = null, subject, htmlMessage, attachment }) {
  // In development, be more lenient with email validation
  if (!fromEmail) {
    console.error(`Missing sender email. Using default noreply@example.com`);
    fromEmail = 'noreply@example.com';
  }

  try {
    const messageData = {
      from: `${fromName} <${fromEmail}>`,
      to: toEmail,
      subject: subject,
      html: htmlMessage,
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    // Add attachment if provided
    if (attachment) {
      messageData.attachments = [{
        content: attachment.data,
        filename: attachment.filename,
        contentType: attachment.contentType
      }];
    }
    
    console.log(`Attempting to send email via SMTP to ${toEmail}`);
    const result = await transporter.sendMail(messageData);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, message: 'Email sent successfully', messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, message: error.message };
  }
}

export const send = {
  emailChangeVerification: async ({ toEmail, newEmail, url }) => {
    console.log('[EMAIL CHANGE] Sending verification to:', toEmail, 'for new email:', newEmail);
    const subject = 'Email Change Verification'
    const htmlMessage = `
      <p>Hello,</p>
      <p>You are receiving this email because you have requested to change your email address.</p>
      <p>Please click the link below to change your email address to <strong>${newEmail}</strong>:</p>
      <a href="${url}">Accept Email Change</a>
      <p>If you did not request this change, please ignore this email.</p>
      `
    await sendmail({ toEmail, subject, htmlMessage })
  },
  emailVerification: async ({ toEmail, url }) => {
    console.log('[EMAIL VERIFICATION] Sending verification to:', toEmail, 'with URL:', url);
    const subject = 'Email Verification'
    const htmlMessage = `
      <p>Hello,</p>
      <p>Please click the link below to verify your email address for <strong>${PUBLIC_APP_NAME}</strong>:</p>
      <a href="${url}">Verify Email</a>
      <p>If you did not request this verification, please ignore this email.</p>
      `
    await sendmail({ toEmail, subject, htmlMessage })
  },
  otpVerification: async ({ toEmail, otp }) => {
    console.log('[OTP VERIFICATION] Sending OTP to:', toEmail, 'OTP:', otp);
    const subject = 'Verify your email address';
    const message = 'Here is your one-time verification code'
    const disclaimer = 'This code is only valid for 5 minutes since request'
    const whenRequested = 'Request was made on'
    const htmlMessage = `
        <!DOCTYPE html>
        <html lang="lv">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
        </head>
         <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
                  <tr>
                      <td align="center" style="padding: 40px 0;">
                          <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                              <tr>
                                  <td style="padding: 40px; text-align: center;">
                                      <p style="font-family: Arial, sans-serif; font-size: 16px; color: #374151; margin-bottom: 24px;">
                                          ${message}:
                                      </p>
                                      <div style="background-color: #f3f4f6;
                                                  padding: 16px 24px;
                                                  border-radius: 12px;
                                                  margin: 16px 0;
                                                  display: inline-block;">
                                          <span style="font-family: Arial, sans-serif;
                                                     font-size: 32px;
                                                     font-weight: 700;
                                                     letter-spacing: 0.1em;
                                                     color: #111827;">
                                              ${otp}
                                          </span>
                                      </div>
                                      <p style="font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; margin-top: 24px;">
                                          ${disclaimer}
                                      </p>
                                      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af; margin-top: 12px;">
                                          ${whenRequested}: ${new Date().toLocaleString('en-US', { 
                                              dateStyle: 'long',
                                              timeStyle: 'medium'
                                          })}
                                      </p>
                                  </td>
                              </tr>
                          </table>
                      </td>
                  </tr>
              </table>
        </html>
    `;
  
    try {
      console.log('About to send OTP email to:', toEmail);
      await sendmail({
        toEmail,
        subject: subject,
        htmlMessage: htmlMessage
      });
      console.log('OTP email sent successfully');
    } catch (error) {
      console.error('Failed to send OTP email:', error);
    }
  }
}