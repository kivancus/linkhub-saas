import express from 'express';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscriptionService';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// Initialize Stripe
const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || 'sk_test_dummy', {
  apiVersion: '2023-10-16',
});

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!sig || !webhookSecret) {
    console.error('Missing Stripe signature or webhook secret');
    res.status(400).send('Missing signature or webhook secret');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    await subscriptionService.processWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;