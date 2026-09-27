import { ApiError, apiClient } from '@/services/apiClient'
import type { Subscription } from '@/services/subscription.service'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { toast } from '@/store/toastStore'

/**
 * Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
 * 1. POST /payments/orders creates an order for the plan (price comes from the server).
 * 2. Razorpay's checkout.js collects the payment.
 * 3. POST /payments/verify checks the signature and grants the plan. The server webhook covers payments
 *    where the browser closes before step 3.
 */
export type PaidPlan = 'single' | 'monthly'

interface Order {
  orderId: string
  amount: number
  currency: string
  keyId: string
  plan: PaidPlan
  planName: string
  prefill: { name: string; email: string }
}

interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let scriptPromise: Promise<void> | null = null

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Razorpay'))
    }
    document.body.appendChild(script)
  })
  return scriptPromise
}

/** Opens checkout for a plan. Resolves true when the payment was verified and the plan granted. */
export async function startCheckout(plan: PaidPlan): Promise<boolean> {
  let order: Order
  try {
    ;[order] = await Promise.all([apiClient.post<Order>('/payments/orders', { plan }), loadCheckout()])
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PAYMENTS_NOT_CONFIGURED') {
      toast.info('Payments are coming soon', 'Upgrades open shortly. Thanks for your patience.')
    } else {
      toast.error('Couldn’t start the payment', error instanceof Error ? error.message : 'Please try again.')
    }
    return false
  }
  if (!window.Razorpay) return false

  return new Promise<boolean>((resolve) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Clave',
      description: order.planName,
      prefill: order.prefill,
      theme: { color: '#087f5b' },
      handler: async (response: RazorpayResponse) => {
        try {
          const subscription = await apiClient.post<Subscription>('/payments/verify', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          useSubscriptionStore.getState().set(subscription)
          toast.success(
            plan === 'monthly' ? 'Welcome to Clave Pro' : 'Resume credit added',
            plan === 'monthly' ? 'Your personal job feed is being prepared.' : 'You can create one more resume.',
          )
          resolve(true)
        } catch {
          // The webhook still grants the plan if the payment went through; reload the plan shortly.
          toast.info('Payment received', 'We’re confirming it. Your plan updates in a moment.')
          setTimeout(() => void useSubscriptionStore.getState().load(true), 5000)
          resolve(false)
        }
      },
      modal: { ondismiss: () => resolve(false) },
    })
    checkout.on('payment.failed', (response) => {
      toast.error('Payment failed', response.error?.description ?? 'No money was taken. Please try again.')
    })
    checkout.open()
  })
}
