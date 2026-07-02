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

// Add is_liked_by_user field to posts
export const addLikeStatusToPosts = async (
  posts: any[],
  userId: string
): Promise<any[]> => {
  if (!posts || posts.length === 0) return posts;

  // Fetch all likes by this user for these posts
  const postIds = posts.map(p => p.id);
  const { data: likes, error } = await supabaseAdmin
    .from('likes')
    .select('post_id')
    .in('post_id', postIds)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching like status:', error);
    return posts.map(p => ({ ...p, is_liked_by_user: false }));
  }

  const likedPostIds = new Set(likes?.map(l => l.post_id) || []);

  return posts.map(post => ({
    ...post,
    is_liked_by_user: likedPostIds.has(post.id),
  }));
};

// नया function – blocked users की list return करेगा
export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  // 1️⃣ मैंने किसको Block किया है?
  const { data: blockedByMe } = await supabaseAdmin
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);

  // 2️⃣ किसने मुझे Block किया है?
  const { data: blockedMe } = await supabaseAdmin
    .from('blocks')
    .select('blocker_id')
    .eq('blocked_id', userId);

  const ids = new Set<string>();
  (blockedByMe || []).forEach((b: any) => ids.add(b.blocked_id));
  (blockedMe || []).forEach((b: any) => ids.add(b.blocker_id));

  return Array.from(ids);
};