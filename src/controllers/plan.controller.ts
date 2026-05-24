import { Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { SubscriptionPlan } from '../types'
import logger from '../utils/logger'

// Admin: Get all plans
export const getPlans = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_deleted', false) 
      .order('amount', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (err) {
    logger.error('Error in getPlans:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Failed to fetch plans' })
  }
}

// Admin: Create or update plan
export const upsertPlan = async (req: Request, res: Response) => {
  const { id, name, duration_months, amount, is_active } = req.body
  if (!name || !duration_months || !amount) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  try {
    let result
    if (id) {
      // Update
      result = await supabase
        .from('subscription_plans')
        .update({ name, duration_months, amount, is_active, updated_at: new Date() })
        .eq('id', id)
        .select()
        .single()
    } else {
      // Insert
      result = await supabase
        .from('subscription_plans')
        .insert({ name, duration_months, amount, is_active })
        .select()
        .single()
    }

    if (result.error) throw result.error
    res.json(result.data)
  } catch (err) {
    logger.error('Error in upsertPlan:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Failed to save plan' })
  }
}

// Admin: Delete plan
export const deletePlan = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_deleted: true })
      .eq('id', id)
    if (error) throw error
    res.json({ message: 'Plan deleted' })
  } catch (err) {
    logger.error('Error in deletePlan:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Failed to delete plan' })
  }
}