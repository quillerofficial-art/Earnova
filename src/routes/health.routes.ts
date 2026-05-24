import express from 'express'
import { supabase } from '../config/supabase'

const router = express.Router()

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true })
    
    if (error) {
      return res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      })
    }
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    res.status(503).json({ status: 'unhealthy', error: errorMessage })
  }
})

export default router