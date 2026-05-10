import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Restaurant App <no-reply@restaurant.com>',
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
    });
};

export const verifyEmailTemplate = (name: string, otp: string): string => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 30px;">
  <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #e65100;">🍽️ Restaurant App – Email Verification</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Use the OTP below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align:center; margin: 30px 0;">
      <span style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #e65100;">${otp}</span>
    </div>
    <p>If you didn't create an account, please ignore this email.</p>
    <p style="color:#888; font-size:12px;">© 2025 Restaurant App. All rights reserved.</p>
  </div>
</body>
</html>
`;

export const forgotPasswordTemplate = (name: string, otp: string): string => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 30px;">
  <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #e65100;">🔐 Password Reset – Restaurant App</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Use this OTP to reset your password. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align:center; margin: 30px 0;">
      <span style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #e65100;">${otp}</span>
    </div>
    <p>If you did not request a password reset, ignore this email.</p>
    <p style="color:#888; font-size:12px;">© 2025 Restaurant App. All rights reserved.</p>
  </div>
</body>
</html>
`;
