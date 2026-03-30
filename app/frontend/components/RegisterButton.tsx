"use client";

import { useState, useCallback } from "react";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Wallet,
  PenLine,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistrationStep = "idle" | "connecting" | "signing" | "success" | "error";

interface RegisterButtonProps {
  /** Called after successful signing. Receives the mock signature. */
  onSuccess?: (signature: string) => void;
  /** Called when any step fails. */
  onError?: (error: Error) => void;
  /** Optional label override for the idle state */
  label?: string;
  /** Disable the button externally */
  disabled?: boolean;
}

// ─── Mock Web3 Helpers ────────────────────────────────────────────────────────

/** Simulates wallet connection (e.g. MetaMask prompt) */
async function mockConnectWallet(): Promise<string> {
  await new Promise((res) => setTimeout(res, 1400));
  // Simulate occasional connection failure
  if (Math.random() < 0.15) throw new Error("User rejected wallet connection.");
  return "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
}

/** Simulates message signing (e.g. eth_sign) */
async function mockSignMessage(
  address: string,
  message: string,
): Promise<string> {
  await new Promise((res) => setTimeout(res, 1600));
  // Simulate occasional signing failure
  if (Math.random() < 0.15)
    throw new Error("User rejected the signing request.");
  return `0xMOCK_SIG_${address.slice(2, 8)}_${Date.now().toString(16)}`;
}

// ─── Step Config ──────────────────────────────────────────────────────────────

const STEP_CONFIG: Record<
  RegistrationStep,
  { label: string; icon: React.ElementType | null; sublabel: string }
> = {
  idle: {
    label: "Register Now",
    icon: ArrowRight,
    sublabel: "Smart contract interaction required",
  },
  connecting: {
    label: "Connecting Wallet…",
    icon: Loader2,
    sublabel: "Approve the connection in your wallet",
  },
  signing: {
    label: "Waiting for Signature…",
    icon: PenLine,
    sublabel: "Sign the message in your wallet",
  },
  success: {
    label: "Registered!",
    icon: CheckCircle2,
    sublabel: "You're in — good luck on the mission",
  },
  error: {
    label: "Try Again",
    icon: XCircle,
    sublabel: "Something went wrong. Please retry.",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RegisterButton({
  onSuccess,
  onError,
  label,
  disabled = false,
}: RegisterButtonProps) {
  const [step, setStep] = useState<RegistrationStep>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const isLoading = step === "connecting" || step === "signing";
  const isSuccess = step === "success";
  const isError = step === "error";
  const isDisabled = disabled || isLoading || isSuccess;

  const handleClick = useCallback(async () => {
    // Reset error state for retry
    if (isError) {
      setErrorMsg(null);
      setStep("idle");
      return;
    }

    if (isDisabled) return;

    try {
      // ── Step 1: Connect ──────────────────────────────────────────
      setStep("connecting");
      const address = await mockConnectWallet();

      // ── Step 2: Sign ─────────────────────────────────────────────
      setStep("signing");
      const message = `Register for Gatherraa Mission\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      const sig = await mockSignMessage(address, message);

      // ── Step 3: Success ──────────────────────────────────────────
      setSignature(sig);
      setStep("success");
      onSuccess?.(sig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setErrorMsg(error.message);
      setStep("error");
      onError?.(error);
    }
  }, [isDisabled, isError, onSuccess, onError]);

  const config = STEP_CONFIG[step];
  const Icon = config.icon;

  // ── Derived button styles ──────────────────────────────────────────────────
  const buttonClasses = [
    "w-full font-bold py-3.5 px-4 rounded-xl",
    "flex items-center justify-center gap-2",
    "transform transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800",
    // State-specific styles
    isSuccess
      ? "bg-green-500 text-white cursor-default shadow-md shadow-green-500/20 focus:ring-green-400"
      : isError
        ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20 focus:ring-red-400"
        : isLoading
          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white cursor-not-allowed opacity-80"
          : disabled
            ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:-translate-y-0.5 shadow-md shadow-blue-500/30 focus:ring-blue-400",
  ].join(" ");

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isDisabled && !isError}
        aria-busy={isLoading}
        aria-live="polite"
        className={buttonClasses}
      >
        {/* Icon */}
        {Icon && (
          <Icon
            className={[
              "w-5 h-5 shrink-0",
              isLoading && step === "connecting" ? "animate-spin" : "",
              isLoading && step === "signing" ? "animate-pulse" : "",
            ].join(" ")}
          />
        )}

        {/* Label */}
        <span>{step === "idle" && label ? label : config.label}</span>
      </button>

      {/* Sub-label / Error message */}
      <p
        className={[
          "text-xs text-center transition-colors duration-200",
          isError
            ? "text-red-500 dark:text-red-400 font-medium"
            : "text-gray-400",
        ].join(" ")}
      >
        {isError ? (errorMsg ?? config.sublabel) : config.sublabel}
      </p>

      {/* Success: signature pill */}
      {isSuccess && signature && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 mt-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <p className="text-[10px] font-mono text-green-700 dark:text-green-400 truncate">
            {signature}
          </p>
        </div>
      )}
    </div>
  );
}
