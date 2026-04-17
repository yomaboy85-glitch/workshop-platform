// src/lib/rpc.ts
// Type-safe wrappers for Supabase RPC functions

import { supabase } from './supabase';

interface ClaimTreasureResult {
  success: boolean;
  score?: number;
  score_id?: string;
  message?: string;
}

/**
 * Atomically claim a treasure (prevents duplicate claims via DB row lock)
 */
export async function claimTreasure(
  treasureId: string,
  userId: string,
  teamId: string | null
): Promise<{ data: ClaimTreasureResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('claim_treasure', {
    p_treasure_id: treasureId,
    p_user_id: userId,
    p_team_id: teamId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as ClaimTreasureResult, error: null };
}

/**
 * Safely increment a team's total_score
 */
export async function incrementTeamScore(teamId: string, delta: number): Promise<void> {
  const { data } = await supabase
    .from('teams')
    .select('total_score')
    .eq('id', teamId)
    .single();

  if (data) {
    await supabase
      .from('teams')
      .update({ total_score: Math.max(0, data.total_score + delta) })
      .eq('id', teamId);
  }
}
