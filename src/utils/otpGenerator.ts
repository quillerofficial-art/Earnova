import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';

export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const storeOTP = async (email: string, otp: string, purpose: string) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const { error } = await supabaseAdmin.from('otps').insert({
    email,
    otp_code: otp,
    purpose,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
};

export const verifyOTP = async (email: string, otp: string, purpose: string) => {
  const { data, error } = await supabaseAdmin
    .from('otps')
    .select('id, otp_code')
    .eq('email', email)
    .eq('purpose', purpose)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return false;
  const isValid = (data[0].otp_code === otp);
  if (isValid) {
    await supabaseAdmin.from('otps').delete().eq('id', data[0].id);
  }
  return isValid;
};