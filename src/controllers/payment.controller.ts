import { Request, Response } from 'express'
import Razorpay from 'razorpay'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import logger from '../utils/logger'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

// Create subscription order with plan
export const createSubscription = async (req: Request, res: Response) => {
  const { planId } = req.body
  if (!planId) {
    return res.status(400).json({ message: 'Plan ID required' })
  }

  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return res.status(400).json({ message: 'Invalid plan' })
    }

    const shortUserId = req.user!.id.replace(/-/g, '').substring(0, 10);
    const options = {
     amount: plan.amount * 100, // convert to paise
     currency: 'INR',
     receipt: `rcpt_${shortUserId}_${Date.now()}`,
     payment_capture: 1,
    }

    const order = await razorpay.orders.create(options)

    // Save order with plan info
    const { error } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: req.user!.id,
        razorpay_order_id: order.id,
        amount: order.amount,
        status: 'created',
        subscription_start: null, // will set on verification
        subscription_end: null,
        plan_id: plan.id, // we need to add this column first
      })

    if (error) throw error

    res.json({
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    logger.error('Error in createSubscription:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Error creating order' })
  }
}

// Verify payment (webhook)
export const verifyPayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')

   if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ message: 'Invalid signature' })
  }  
  const { data: existingTx } = await supabase
    .from('payment_transactions')
    .select('status')
    .eq('razorpay_order_id', razorpay_order_id)
    .single()

  if (existingTx?.status === 'paid') {
    return res.json({ status: 'ok', message: 'Already processed' })
  }

  try {
      // Get transaction and plan details
      const { data: transaction, error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          razorpay_payment_id,
          razorpay_signature,
          status: 'paid',
        })
        .eq('razorpay_order_id', razorpay_order_id)
        .select()
        .single()

      if (updateError || !transaction) throw updateError

      // Get plan
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('duration_months')
        .eq('id', transaction.plan_id)
        .single()

      const startDate = new Date()
      const endDate = new Date()
      
      const { data: user } = await supabase
      .from('users')
      .select('subscription_expiry')
      .eq('id', transaction.user_id)
      .single()

    let newExpiry = endDate
    if (user?.subscription_expiry && new Date(user.subscription_expiry) > startDate) {
      newExpiry = new Date(user.subscription_expiry)
      newExpiry.setMonth(newExpiry.getMonth() + (plan?.duration_months || 12))
    } else if (plan) {
      newExpiry.setMonth(newExpiry.getMonth() + plan.duration_months)
    } else {
      newExpiry.setFullYear(newExpiry.getFullYear() + 1)
    }

    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_status: true,
        subscription_expiry: newExpiry.toISOString(),
      })
      .eq('id', transaction.user_id)

    if (userError) throw userError

    await supabase
      .from('payment_transactions')
      .update({
        subscription_start: startDate.toISOString(),
        subscription_end: newExpiry.toISOString(),
      })
      .eq('id', transaction.id)

    res.json({ status: 'ok', message: 'Payment verified and subscription activated' })
    } catch (err) {
    logger.error('Error in verifyPayment:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Error updating subscription' })
  }
}

// Get payment status by order ID
export const getPaymentStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('status, razorpay_payment_id')
    .eq('razorpay_order_id', orderId)
    .single();
  
  if (error) return res.status(404).json({ message: 'Order not found' });
  res.json({ status: data.status, paymentId: data.razorpay_payment_id });
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.body; // raw string/buffer

    // ✅ Signature verify on raw body
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // ✅ Parse raw body after verification
    const payload = JSON.parse(rawBody.toString());

    if (payload.event === 'payment.captured') {
      const orderId = payload.payload.payment.entity.order_id;
      console.log('Webhook received for order:', orderId);
      await activateSubscription(orderId);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Webhook failed' });
  }
};

const activateSubscription = async (orderId: string) => {
  // 1. transaction fetch
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single();

  if (!transaction || transaction.status === 'paid') return;

  // 2. mark paid
  await supabase
    .from('payment_transactions')
    .update({ status: 'paid' })
    .eq('razorpay_order_id', orderId);

  // 3. get plan duration
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('duration_months')
    .eq('id', transaction.plan_id)
    .single();

  const startDate = new Date();
  const endDate = new Date();

  endDate.setMonth(endDate.getMonth() + (plan?.duration_months || 1));

  // 4. update user (🔥 MOST IMPORTANT)
  await supabase
    .from('users')
    .update({
      subscription_status: true,
      subscription_expiry: endDate.toISOString(),
    })
    .eq('id', transaction.user_id);

  // ✅ ADD THIS LINE – Recalculate downline for this user and all ancestors
  await supabase.rpc('recalc_user_and_ancestors_v5', { target_id: transaction.user_id });

  // 5. save subscription dates
  await supabase
    .from('payment_transactions')
    .update({
      subscription_start: startDate.toISOString(),
      subscription_end: endDate.toISOString(),
    })
    .eq('razorpay_order_id', orderId);
};