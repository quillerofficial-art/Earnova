import crypto from 'crypto';
import bcrypt from 'bcrypt'
import { supabase } from '../config/supabase';

export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const storeOTP = async (email: string, otp: string, purpose: string) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const hashedOtp = await bcrypt.hash(otp, 10)
   await supabase.from('otps').insert({
    email,
    otp_code: hashedOtp,
    purpose,
    expires_at: expiresAt.toISOString(),
  });
};

export const verifyOTP = async (email: string, otp: string, purpose: string) => {
  const { data, error } = await supabase
    .from('otps')
    .select('id, otp_code')
    .eq('email', email)
    .eq('purpose', purpose)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return false;
  }

   // ✅ Compare with hashed OTP
  const isValid = await bcrypt.compare(otp, data[0].otp_code)
  
  if (isValid) {
    await supabase.from('otps').delete().eq('id', data[0].id)
  }
  
  return isValid
}
