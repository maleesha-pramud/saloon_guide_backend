import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter with improved timeout options
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Increase timeout settings to handle slow SMTP servers
  connectionTimeout: 30000, // 30 seconds (increased from 10)
  greetingTimeout: 30000,   // 30 seconds (increased from 10)
  socketTimeout: 60000,     // 60 seconds (increased from 15)
});

// Create a backup transporter with different settings as fallback
const backupTransporter = nodemailer.createTransport({
  host: process.env.BACKUP_EMAIL_HOST || process.env.EMAIL_HOST,
  port: parseInt(process.env.BACKUP_EMAIL_PORT || process.env.EMAIL_PORT || '587'),
  secure: (process.env.BACKUP_EMAIL_SECURE || process.env.EMAIL_SECURE) === 'true',
  auth: {
    user: process.env.BACKUP_EMAIL_USER || process.env.EMAIL_USER,
    pass: process.env.BACKUP_EMAIL_PASSWORD || process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
});

/**
 * Verify if the email transporter connection is working
 * @param useBackup Whether to use the backup transporter
 * @returns Promise resolving to boolean indicating if connection is successful
 */
export const verifyEmailConnection = async (useBackup = false): Promise<boolean> => {
  try {
    const currentTransporter = useBackup ? backupTransporter : transporter;
    const verification = await currentTransporter.verify();
    console.log(`Email service (${useBackup ? 'backup' : 'primary'}) is ready:`, verification);
    return verification;
  } catch (error: any) {
    console.error(`Email service (${useBackup ? 'backup' : 'primary'}) verification failed:`, error);
    // Detailed logging for SMTP connection errors
    if (error.code) {
      console.error(`SMTP error code: ${error.code}, command: ${error.command || 'N/A'}`);
    }

    // If primary connection failed, try backup unless we're already using backup
    if (!useBackup) {
      console.log('Attempting to verify backup email connection...');
      return verifyEmailConnection(true);
    }

    return false;
  }
};

/**
 * Send an email with retry functionality
 * @param mailOptions Email options
 * @param retries Number of retry attempts (default: 2)
 * @param useBackup Whether to use the backup transporter
 * @returns Promise resolving to boolean indicating success
 */
async function sendMailWithRetry(
  mailOptions: nodemailer.SendMailOptions,
  retries = 2,
  useBackup = false
): Promise<boolean> {
  try {
    const currentTransporter = useBackup ? backupTransporter : transporter;
    await currentTransporter.sendMail(mailOptions);
    console.log(`Email sent successfully using ${useBackup ? 'backup' : 'primary'} transporter`);
    return true;
  } catch (error: any) {
    console.error(`Error sending email (attempts left: ${retries}):`, error);

    // Log detailed SMTP error information
    if (error.code) {
      console.error(`SMTP error code: ${error.code}, command: ${error.command || 'N/A'}`);
    }

    if (retries > 0) {
      console.log(`Retrying email delivery in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
      return sendMailWithRetry(mailOptions, retries - 1, useBackup);
    } else if (!useBackup) {
      // Try backup transporter if primary failed after all retries
      console.log('Switching to backup email transporter...');
      return sendMailWithRetry(mailOptions, 2, true);
    }

    return false;
  }
}

/**
 * Send an email with the login token
 * @param to Recipient email address
 * @param name Recipient name
 * @param token Authentication token
 * @returns Promise resolving to boolean indicating success
 */
export const sendLoginToken = async (to: string, name: string, token: string): Promise<boolean> => {
  // Verify connection before attempting to send
  const isConnected = await verifyEmailConnection();
  if (!isConnected) {
    console.error('Failed to establish email service connection');
    return false;
  }

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Saloon Guide'}" <${process.env.EMAIL_FROM || 'noreply@saloonguide.com'}>`,
    to,
    subject: 'Welcome to Saloon Guide - Your Registration Token',
    html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Saloon Guide</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; color: #333;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <tr>
              <td align="center" bgcolor="#7952B3" style="padding: 30px 0;">
                <h1 style="color: white; margin: 0; padding: 0; font-weight: 600; letter-spacing: 1px;">Saloon Guide</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 16px;">Your Beauty Destination</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px 40px;">
                <h2 style="color: #333; margin: 0 0 20px 0; font-weight: 500;">Welcome, ${name}!</h2>
                <p style="font-size: 16px; line-height: 24px; margin-bottom: 25px;">Thank you for registering with Saloon Guide. We're excited to have you join our community.</p>
                <p style="font-size: 16px; line-height: 24px; margin-bottom: 25px;">Your account has been successfully created, and you can use the authentication token below to access all our services:</p>
                
                <div style="background-color: #f5f5f5; border-left: 4px solid #7952B3; padding: 15px; margin: 20px 0; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">
                  ${token}
                </div>
                
                <p style="font-size: 16px; line-height: 24px; margin-bottom: 10px;"><strong>Important:</strong></p>
                <ul style="padding-left: 20px; margin-bottom: 25px;">
                  <li style="margin-bottom: 8px;">This token is valid for 24 hours</li>
                  <li style="margin-bottom: 8px;">Keep this token confidential</li>
                  <li style="margin-bottom: 8px;">If you didn't register for an account, please contact our support team immediately</li>
                </ul>
                
                <p style="font-size: 16px; line-height: 24px;">Discover the best salons near you and book your appointments with ease!</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#f5f5f5" style="padding: 20px 40px; text-align: center; font-size: 14px; color: #666;">
                <p style="margin: 0 0 10px 0;">If you have any questions, please contact our support team:</p>
                <p style="margin: 0 0 20px 0;"><a href="mailto:support@saloonguide.com" style="color: #7952B3; text-decoration: none;">support@saloonguide.com</a></p>
                <p style="margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Saloon Guide. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
  };

  try {
    // Use the retry mechanism
    const result = await sendMailWithRetry(mailOptions);
    if (result) {
      console.log(`Email successfully sent to ${to}`);
    } else {
      console.error(`Failed to send email to ${to} after multiple attempts`);
    }
    return result;
  } catch (error) {
    console.error('Error in sendLoginToken:', error);
    return false;
  }
};
