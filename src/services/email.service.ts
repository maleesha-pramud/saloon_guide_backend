import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

/**
 * Send an email with the login token
 * @param to Recipient email address
 * @param name Recipient name
 * @param token Authentication token
 * @returns Promise resolving to boolean indicating success
 */
export const sendLoginToken = async (to: string, name: string, token: string): Promise<boolean> => {
    try {
        await transporter.sendMail({
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
        });
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};
