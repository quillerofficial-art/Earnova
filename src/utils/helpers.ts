import { supabaseAdmin } from '../config/supabase';

export const generateReferralCode = (): string => {
  return 'ERN' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

export const isDescendant = async (ancestorId: string, userId: string): Promise<boolean> => {
  if (ancestorId === userId) return true;
  const { data, error } = await supabaseAdmin.rpc('is_descendant_v5', {
    ancestor_id: ancestorId,
    user_id: userId,
  });
  if (error) {
    console.error('Error checking descendant:', error);
    return false;
  }
  return data || false;
};

// नया function – ancestors की downline recalculate करेगा
export const recalcDownline = async (userId: string) => {
  await supabaseAdmin.rpc('recalc_user_and_ancestors_v5', { target_id: userId });
};