import Stripe from 'stripe';
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';

// Initialize Stripe
const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || 'sk_test_dummy', {
  apiVersion: '2023-10-16',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

export class SubscriptionService {
  // Define subscription plans
  private readonly plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        'Basic bio page',
        '5 links maximum',
        '3 free themes',
        'Basic analytics'
      ],
      stripePriceId: ''
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 9.99,
      interval: 'month',
      features: [
        'Unlimited links',
        'All premium themes',
        'Custom colors',
        'Advanced analytics',
        'Custom domain support',
        'Priority support'
      ],
      stripePriceId: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] || 'price_pro_monthly'
    },
    {
      id: 'pro-yearly',
      name: 'Pro (Yearly)',
      price: 99.99,
      interval: 'year',
      features: [
        'Unlimited links',
        'All premium themes',
        'Custom colors',
        'Advanced analytics',
        'Custom domain support',
        'Priority support',
        '2 months free'
      ],
      stripePriceId: process.env['STRIPE_PRO_YEARLY_PRICE_ID'] || 'price_pro_yearly'
    }
  ];

  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlan(planId: string): SubscriptionPlan | null {
    return this.plans.find(plan => plan.id === planId) || null;
  }

  async createCheckoutSession(userId: string, planId: string, successUrl: string, cancelUrl: string) {
    const plan = this.getPlan(planId);
    if (!plan || plan.id === 'free') {
      throw new ValidationError('Invalid subscription plan', 'planId');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId,
        planId: planId
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planId: planId
        }
      }
    });

    return {
      sessionId: session.id,
      url: session.url
    };
  }

  async handleSuccessfulPayment(sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (!session.metadata?.['userId'] || !session.metadata?.['planId']) {
      throw new ValidationError('Missing session metadata');
    }

    const userId = session.metadata['userId'];
    const planId = session.metadata['planId'];
    const subscription = session.subscription as Stripe.Subscription;

    // Update user subscription in database
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        planId,
        updatedAt: new Date()
      },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        planId
      }
    });

    // Update user subscription tier
    const tierMap: { [key: string]: string } = {
      'pro': 'pro',
      'pro-yearly': 'pro'
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tierMap[planId] || 'free'
      }
    });

    return { success: true };
  }

  async cancelSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundError('No active subscription found');
    }

    // Cancel subscription in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update subscription status
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'cancel_at_period_end',
        updatedAt: new Date()
      }
    });

    return { success: true };
  }

  async reactivateSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundError('No subscription found');
    }

    // Reactivate subscription in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update subscription status
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'active',
        updatedAt: new Date()
      }
    });

    return { success: true };
  }

  async getUserSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      return {
        plan: this.getPlan('free'),
        status: 'free',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
      };
    }

    const plan = this.getPlan(subscription.planId);
    
    return {
      plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.status === 'cancel_at_period_end'
    };
  }

  async processWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionFromWebhook(subscription);
        break;
      
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await this.updateSubscriptionFromWebhook(sub);
        }
        break;
      
      case 'invoice.payment_failed':
        // Handle failed payments
        console.log('Payment failed for invoice:', event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async updateSubscriptionFromWebhook(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSubscription.id }
    });

    if (!subscription) {
      console.log('Subscription not found for webhook:', stripeSubscription.id);
      return;
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        updatedAt: new Date()
      }
    });

    // Update user tier based on subscription status
    const isActive = ['active', 'trialing'].includes(stripeSubscription.status);
    const tier = isActive ? 'pro' : 'free';

    await prisma.user.update({
      where: { id: subscription.userId },
      data: {
        subscriptionTier: tier
      }
    });
  }

  // Check if user has access to premium features
  async hasFeatureAccess(userId: string, _feature: 'premium_themes' | 'custom_colors' | 'unlimited_links' | 'advanced_analytics'): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return false;
    }

    // Free tier has limited access
    if (user.subscriptionTier === 'free') {
      return false;
    }

    // Pro tier has access to all features
    return user.subscriptionTier === 'pro';
  }
}