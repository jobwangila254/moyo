const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'sendgrid',
  auth: {
    user: 'apikey',
    pass: process.env.EMAIL_API_KEY,
  },
});

exports.sendVerificationEmail = async (email, name, token) => {
  const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Campus Connect KE" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verify your .ac.ke email address - Campus Connect KE',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #007AFF, #5856D6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Connect KE</h1>
        </div>
        <div style="background: #f5f5f7; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1c1c1e; margin-top: 0;">Welcome, ${name}!</h2>
          <p style="color: #3a3a3c; font-size: 16px; line-height: 1.6;">
            Thank you for signing up. Please verify your <strong>.ac.ke</strong> email address to start connecting with fellow university students.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #007AFF; color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #8e8e93; font-size: 14px;">
            This link expires in 24 hours. If you did not create this account, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 20px 0;">
          <p style="color: #8e8e93; font-size: 12px;">
            &copy; ${new Date().getFullYear()} Campus Connect KE. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error.message);
    return false;
  }
};

exports.sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"Campus Connect KE" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Reset Your Password - Campus Connect KE',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #FF9500, #FF3B30); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
        </div>
        <div style="background: #f5f5f7; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #3a3a3c; font-size: 16px; line-height: 1.6;">
            You requested a password reset. Click the button below to set a new password.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #FF9500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #8e8e93; font-size: 14px;">
            This link expires in 1 hour. If you did not request this, please ignore this email.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Password reset email error:', error.message);
    return false;
  }
};
