import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('RESEND_API_KEY is missing');
}

const resend = new Resend(apiKey);

export const sendOTP = async (email: string, otp: string, purpose: string) => {
  const subject = purpose === 'signup' ? 'PlusOne Signup OTP' : 'PlusOne Forgot Password OTP';
  const html = `<p>Your OTP for ${purpose} is: <b>${otp}</b>. It expires in 10 minutes.</p>`;

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject,
    html,
  });

  if (result.error) {
    console.error('Resend error:', result.error);
    throw new Error(result.error.message);
  }

  return result;
};