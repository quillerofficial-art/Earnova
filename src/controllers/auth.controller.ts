import { Request, Response } from 'express'
import { supabase, supabaseAdmin } from '../config/supabase'
import { generateReferralCode, } from '../utils/helpers'
import { generateOTP, storeOTP, verifyOTP} from '../utils/otpGenerator'
import { sendOTP } from '../utils/emailService'
import { OtpPurpose } from '../types/enums'
import { successResponse, errorResponse } from '../utils/response'
import logger from '../utils/logger'
import { sendPushNotification } from '../utils/notifications'


export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp, purpose } = req.body;
  const otpString = String(otp);  // ensure string
  const isValid = await verifyOTP(email, otpString, purpose);
  if (!isValid) return errorResponse(res, 'Invalid or expired OTP');


  // Mark email as verified for 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await supabaseAdmin
    .from('email_verifications')
    .upsert({ email, verified: true, expires_at: expiresAt.toISOString() });

  successResponse(res, { verified: true });
};

// Signup with invitation token
export const signup = async (req: Request, res: Response) => {
  const { email, password, name, upi_id, mobile_number, token } = req.body;

  // ✅ Mandatory Fields (Token hata diya)
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  let userId: string | null = null;
  
  // ✅ Default null values (Root user ke liye)
  let sponsorId: string | null = null;
  let parentId: string | null = null;
  let position: number | null = null;

  try {
    // 1️⃣ Email Verification Check
    const { data: verif, error: verifError } = await supabaseAdmin
      .from('email_verifications')
      .select('verified, expires_at')
      .eq('email', email)
      .single();

    if (verifError || !verif || !verif.verified || new Date(verif.expires_at) < new Date()) {
      return errorResponse(res, 'Email not verified. Please request OTP and verify first.');
    }

    // 2️⃣ Token Validation (Sirf tab jab token diya ho)
    if (token) {
      const { data: invToken, error: tokenError } = await supabaseAdmin
        .from('invitation_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !invToken) {
        return errorResponse(res, 'Invalid or expired invitation token');
      }

      // Check position vacancy
      const { data: parent, error: parentError } = await supabaseAdmin
        .from('users')
        .select('child_ids')
        .eq('id', invToken.parent_id)
        .single();

      if (parentError || !parent) {
        return res.status(400).json({ message: 'Parent node not found' });
      }

      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('parent_id', invToken.parent_id)
        .eq('position', invToken.position)
        .maybeSingle();
      if (existing) {
        return errorResponse(res, 'Position already occupied');
      }

      // Token data assign
      sponsorId = invToken.sponsor_id;
      parentId = invToken.parent_id;
      position = invToken.position;
    }
    // ✅ Agar token nahi diya, toh sponsorId/parentId/position null hi rahenge (Root User)

    // 3️⃣ Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return errorResponse(res, authError.message);
    }

    userId = authUser.user.id;

    // 4️⃣ Insert into public.users
    const referralCode = generateReferralCode();
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        name,
        email,
        upi_id: upi_id || null,
        mobile_number: mobile_number || null,
        referral_code: referralCode,
        sponsor_id: sponsorId,    // ✅ Nullable
        parent_id: parentId,      // ✅ Nullable
        position: position,       // ✅ Nullable
        level: 0,                 // ✅ Root ka level 0
        child_ids: [],
        total_downline: 0,
        subscription_status: false,
        is_deleted: false,
        streak: 0,
      });

    if (dbError) throw dbError;

    // 5️⃣ Parent Update & RPC (Sirf tab jab token diya ho)
    if (token && parentId) {
      // Update parent's child_ids
      const { data: parentData } = await supabaseAdmin
        .from('users')
        .select('child_ids')
        .eq('id', parentId)
        .single();
      let newChildIds = parentData?.child_ids || [];
      newChildIds.push(userId);
      await supabaseAdmin
        .from('users')
        .update({ child_ids: newChildIds })
        .eq('id', parentId);

      // Mark token as used
      await supabaseAdmin
        .from('invitation_tokens')
        .update({ used: true })
        .eq('token', token);

      // Recalculate downline for ancestors
      await supabaseAdmin.rpc('recalc_user_and_ancestors_v5', { target_id: userId });
    }

    // 6️⃣ Clean up email verification
    await supabaseAdmin.from('email_verifications').delete().eq('email', email);

    // 7️⃣ Welcome Notification
    await sendPushNotification(userId, '🎉 Welcome to the Poster family!', 
      `Welcome to the family! 🎉\n\n` +
      `Poster isn't just another social media app—it's a social communication platform that actually pays you for your daily creativity!\n\n` +
      `The formula is simple: Post daily, level up, and get paid every month.\n\n` +
      `💰 Level & Payout Breakdown:\n` +
      `• Level 1: Lifetime free subscription\n` +
      `• Level 2: ₹25/month\n` +
      `• Level 3: ₹125/month\n` +
      `• Level 4: ₹625/month\n` +
      `• Level 5: ₹3125/month\n\n` +
      `🚀 How to Level Up & Unlock Free Subscriptions?\n` +
      `There are 5 tasks in total. Complete each task to increase your level by 1!\n\n` +
      `🔹 Your First Mission (Task 1): Unlock Level 1 & Lifetime Free Access\n` +
      `▸ Goal: Refer 5 friends.\n` +
      `▸ Condition: They must post their very first post on the app.\n` +
      `▸ Deadline: Within 7 days of subscribing.\n` +
      `▸ Reward: Free Lifetime Subscription to Poster!\n\n` +
      `Ready to turn your posts into payouts? Start sharing and posting today! 🚀`
    );

    // In-app welcome notification
    const { data: notif, error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        admin_id: null,
        title: 'Welcome to the family! 🎉',
        message: `Poster isn't just another social media app—it’s a social communication platform that actually pays you for your daily creativity!\n\nThe formula is simple: Post daily, level up, and get paid every month.\n\n💰 The Level & Payout Breakdown\nLevel 1: Lifetime Free Subscription\nLevel 2: ₹25/month\nLevel 3: ₹125/month\nLevel 4: ₹625/month\nLevel 5: ₹3,125/month\n\n🚀 How to Level Up & Unlock Free Subscriptions?\nThere are 5 tasks in total. Every time you complete a task, your level increases by 1!\n\nYour First Mission (Task 1): Unlock Level 1 & Lifetime Free Access\nThe Goal: Refer 5 friends.\nThe Catch: Make sure they post their very first post on the app.\nThe Deadline: Complete this within your first 7 days of subscribing.\nThe Reward: Reaching Level 1 unlocks a Free Lifetime Subscription to the app!\n\nReady to turn your posts into payouts? Start sharing and posting today!`
      })
      .select()
      .single();

    if (!notifError && notif) {
      await supabaseAdmin
        .from('user_notifications')
        .insert({ user_id: userId, notification_id: notif.id });
    }

    successResponse(res, { message: 'User created successfully', userId });
  } catch (err) {
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    logger.error('Error in register:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error');
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' })
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return res.status(401).json({ message: error.message })
    }
    

    // Fetch user profile from public.users
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      return errorResponse(res, 'Failed to fetch user profile')
    }

    successResponse(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: userProfile,
    })
  } catch (err) {
    logger.error('Error in login:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Server error')
  }
}

// Forgot password (Supabase handles via email)
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body

  if (!email) {
    return errorResponse(res, 'Email required')
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.BASE_URL}/reset-password`,
    })

    if (error) {
      return errorResponse(res, error.message )
    }

    successResponse(res, { message: 'Password reset email sent' })
  } catch (err) {
    logger.error('Error in forgotPassword:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Server error')
  }
}

// Change password (requires current password for security)
export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return errorResponse(res, 'Current and new password required')
  }

  try {
    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user!.email,
      password: currentPassword,
    })
    if (signInError) {
      return errorResponse(res, 'Current password is incorrect')
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user!.id,
      { password: newPassword }
    )
    if (updateError) {
      return errorResponse(res, updateError.message )
    }

    successResponse(res, { message: 'Password changed successfully' })
  } catch (err) {
    logger.error('Error in changePassword:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Server error')
  }
}

// Referrer Info
export const getReferrerInfo = async (req: Request, res: Response) => {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    return errorResponse(res, 'Token required' )
  }

  try {
    const { data: invToken, error } = await supabaseAdmin
      .from('invitation_tokens')
      .select('sponsor_id')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !invToken) {
      return errorResponse(res, 'Invalid or expired invitation token' )
    }

    const { data: sponsor, error: sponsorError } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', invToken.sponsor_id)
      .single()

    if (sponsorError || !sponsor) {
      return errorResponse(res, 'Sponsor not found' )
    }

    successResponse(res, { referrer: sponsor })
  } catch (err) {
    logger.error('Error in getReferrerInfo:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Server error' )
  }
}

// Send OTP for signup or forgot password
export const sendOtp = async (req: Request, res: Response) => {
  const { email, purpose } = req.body;
  if (!email || !purpose) {
    return errorResponse(res, 'Email and purpose required' );
  }

  // Allowed purposes
  const allowedPurposes = [OtpPurpose.SIGNUP, OtpPurpose.FORGOT];
  if (!allowedPurposes.includes(purpose)) {
    return errorResponse(res, 'Invalid purpose. Must be "signup" or "forgot".' );
  }

  try {
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email);
    if (userError) throw userError;

    if (purpose === OtpPurpose.SIGNUP && users.length > 0) {
      return errorResponse(res, 'Email already registered' );
    }
    if (purpose === OtpPurpose.FORGOT && users.length === 0) {
      return errorResponse(res, 'Email not found' );
    }

    const otp = generateOTP();
    await storeOTP(email, otp, purpose);
    await sendOTP(email, otp, purpose);
    successResponse(res, { message: 'OTP sent successfully' });
  } catch (err: any) {
    logger.error('Error in sendOtp:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error');
  }
};

//logout
export const logout = async (req: Request, res: Response) => {
  try {
    // Supabase session is client-side, but you can:
    // 1. Add token to blacklist (if using JWT blacklist)
    // 2. Or just instruct client to delete token
    
    // For now, just return success
    successResponse(res, { message: 'Logged out successfully' })
  } catch (err) {
    logger.error('Error in logout:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error' )
  }
}

export const verifyToken = async (req: Request, res: Response) => {
  // Token already verified by authMiddleware
  successResponse(res, { valid: true, user: { id: req.user!.id, email: req.user!.email } });
};


// This endpoint is for resetting password using the token sent by Supabase (after user clicks the link in email)
export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return errorResponse(res, 'Token and new password required');
  }

  try {
    // Supabase Admin se user fetch using the access token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return errorResponse(res, 'Invalid or expired token');
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return errorResponse(res, updateError.message);
    }

    successResponse(res, { message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Reset password error:', err);
    errorResponse(res, 'Server error');
  }
};

// refresh token endpoint to get new access token using refresh token
export const refreshToken = async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) throw error;
    
    // ✅ Check if session exists
    if (!data.session) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err: any) {
    console.error('Refresh token error:', err);
    res.status(401).json({ message: err.message || 'Invalid or expired refresh token' });
  }
};

// Reset password using OTP (for forgot password flow)
export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return errorResponse(res, 'Email, OTP and new password are required');
  }

  if (newPassword.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters');
  }

  try {
    // ✅ 1. OTP Verify करो
    const isValid = await verifyOTP(email, otp, OtpPurpose.FORGOT);
    if (!isValid) {
      return errorResponse(res, 'Invalid or expired OTP');
    }

    // ✅ 2. User Fetch करो (Supabase Admin)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return errorResponse(res, 'User not found');
    }

    // ✅ 3. Password Update करो (Admin API)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      logger.error('Password update error:', updateError);
      return errorResponse(res, updateError.message);
    }

    // ✅ 4. OTP Cleanup (Already handled by verifyOTP, but extra safe)
    // verifyOTP already deletes the OTP from DB.

    successResponse(res, { message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Error in resetPasswordWithOtp:', err);
    errorResponse(res, 'Server error');
  }
};