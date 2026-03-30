"use client";

import { useState, useEffect } from 'react';
import { useInitiatePayment } from '../lib/react-query/hooks/payments/useInitiatePayment';
import { CreditCard, Loader2 } from 'lucide-react';

interface PaystackPaymentButtonProps {
  bookingId: string;
  amountKobo: number;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        onSuccess: (response: any) => void;
        onCancel: () => void;
      }) => {
        openIframe: () => void;
        close: () => void;
      };
    };
  }
}

export function PaystackPaymentButton({
  bookingId,
  amountKobo,
  onSuccess,
  onClose,
  className = '',
  disabled = false,
}: PaystackPaymentButtonProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const initiatePayment = useInitiatePayment();

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  
  // Mock user email - in a real app, this would come from auth context
  const userEmail = 'user@example.com';

  useEffect(() => {
    // Load Paystack script
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Paystack script');
      setScriptLoaded(false);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!scriptLoaded || !PAYSTACK_PUBLIC_KEY) {
      console.error('Paystack script not loaded or public key missing');
      return;
    }

    setIsLoading(true);

    try {
      const paymentData = await initiatePayment.mutateAsync({ bookingId });

      if (!window.PaystackPop) {
        throw new Error('PaystackPop not available');
      }

      const paystack = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: userEmail,
        amount: amountKobo,
        ref: paymentData.reference,
        onSuccess: (response: any) => {
          console.log('Payment successful:', response);
          onSuccess?.();
          setIsLoading(false);
        },
        onCancel: () => {
          console.log('Payment cancelled');
          onClose?.();
          setIsLoading(false);
        },
      });

      paystack.openIframe();
    } catch (error) {
      console.error('Payment initiation failed:', error);
      setIsLoading(false);
    }
  };

  const isButtonDisabled = disabled || isLoading || initiatePayment.isPending || !scriptLoaded;

  return (
    <button
      onClick={handlePayment}
      disabled={isButtonDisabled}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {isLoading || initiatePayment.isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          Pay Now
        </>
      )}
    </button>
  );
}

export default PaystackPaymentButton;
