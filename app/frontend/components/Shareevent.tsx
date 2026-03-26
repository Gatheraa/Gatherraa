"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── QR Code generator (zero-dependency, inline) ──────────────────────────────
// Tiny QR encoder using the qrcode public API (cdn) via img src trick
// For production, swap with: npm install qrcode && import QRCode from "qrcode"

function useQRDataURL(text: string, size = 200): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    // Uses Google Chart API as a zero-dep fallback
    // Replace with local `qrcode` package in production
    const encoded = encodeURIComponent(text);
    setUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=ffffff&color=0f172a&margin=2`,
    );
  }, [text, size]);

  return url;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareEventProps {
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventUrl?: string;
  className?: string;
  onClose?: () => void;
}

type Tab = "link" | "qr" | "social";

// ─── Social platforms ─────────────────────────────────────────────────────────

const SOCIALS = [
  {
    id: "twitter",
    label: "Twitter / X",
    color: "#000000",
    bg: "#f7f7f7",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877f2",
    bg: "#e7f0fd",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.793-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0a66c2",
    bg: "#e8f0f9",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25d366",
    bg: "#e9faf0",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#26a5e4",
    bg: "#e5f5fd",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "email",
    label: "Email",
    color: "#6b7280",
    bg: "#f3f4f6",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`Join me at this event:\n\n${url}`)}`,
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShareEvent({
  eventTitle = "Design Systems Summit 2025",
  eventDate = "Saturday, Aug 23 · 10:00 AM",
  eventLocation = "San Francisco, CA",
  eventUrl = typeof window !== "undefined"
    ? window.location.href
    : "https://events.example.com/design-summit-2025",
  className = "",
  onClose,
}: ShareEventProps) {
  const [activeTab, setActiveTab] = useState<Tab>("link");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qrUrl = useQRDataURL(eventUrl, 220);

  const shareText = `${eventTitle} — ${eventDate}`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [eventUrl]);

  const openSocial = (platform: (typeof SOCIALS)[number]) => {
    const url = platform.getUrl(eventUrl, shareText);
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    setShared(platform.id);
    setTimeout(() => setShared(null), 2000);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "link",
      label: "Copy Link",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: "qr",
      label: "QR Code",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1zM11 13a1 1 0 112 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1zm4 0a1 1 0 10-2 0 1 1 0 002 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: "social",
      label: "Socials",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`
        w-full max-w-md mx-auto
        bg-white rounded-3xl shadow-2xl shadow-slate-200/80
        border border-slate-100 overflow-hidden
        font-[Georgia,_'Times_New_Roman',_serif]
        ${className}
      `}
    >
      {/* ── Header strip ── */}
      <div className="relative bg-slate-900 px-6 pt-6 pb-8">
        {/* close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* event meta */}
        <div className="flex items-start gap-4">
          {/* calendar icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-400 flex flex-col items-center justify-center shadow-lg">
            <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-900 leading-none">
              {eventDate.split(",")[0]?.slice(0, 3).toUpperCase() ?? "SAT"}
            </span>
            <span className="text-lg font-bold text-slate-900 leading-tight">
              {eventDate.match(/\d{1,2}/)?.[0] ?? "23"}
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="text-white text-lg font-bold leading-snug tracking-tight line-clamp-2">
              {eventTitle}
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-sans">{eventDate}</p>
            <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-xs font-sans">
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3 h-3 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M8 1.5a5 5 0 100 10A5 5 0 008 1.5zm-6.5 5a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm6.5-2a2 2 0 100 4 2 2 0 000-4z"
                  clipRule="evenodd"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3 h-3 flex-shrink-0 -ml-2.5"
              >
                <path
                  fillRule="evenodd"
                  d="M8 2a4 4 0 00-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 00-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                  clipRule="evenodd"
                />
              </svg>
              {eventLocation}
            </div>
          </div>
        </div>

        {/* share label */}
        <p className="mt-4 text-xs font-sans font-semibold uppercase tracking-widest text-slate-500">
          Share this event
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5
              py-3 text-xs font-sans font-semibold tracking-wide transition-all
              ${
                activeTab === t.id
                  ? "text-slate-900 border-b-2 border-slate-900 -mb-px bg-slate-50"
                  : "text-slate-400 hover:text-slate-600"
              }
            `}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      <div className="px-6 py-6">
        {/* LINK TAB */}
        {activeTab === "link" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 font-sans">
              Anyone with this link can view the event.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.636 3.5a.5.5 0 00-.5-.5H1.5A1.5 1.5 0 000 4.5v10A1.5 1.5 0 001.5 16h10a1.5 1.5 0 001.5-1.5V7.864a.5.5 0 00-1 0V14.5a.5.5 0 01-.5.5h-10a.5.5 0 01-.5-.5v-10a.5.5 0 01.5-.5h6.636a.5.5 0 00.5-.5z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M16 .5a.5.5 0 00-.5-.5h-5a.5.5 0 000 1h3.793L6.146 9.146a.5.5 0 10.708.708L15 1.707V5.5a.5.5 0 001 0v-5z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  ref={inputRef}
                  readOnly
                  value={eventUrl}
                  className="flex-1 bg-transparent text-xs text-slate-600 font-sans outline-none truncate min-w-0"
                />
              </div>
              <button
                onClick={copyLink}
                className={`
                  flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                  text-xs font-sans font-semibold transition-all duration-200
                  ${
                    copied
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }
                `}
              >
                {copied ? (
                  <>
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z" />
                      <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Native share (mobile) */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={() =>
                  navigator
                    .share({ title: eventTitle, url: eventUrl })
                    .catch(() => {})
                }
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-sans font-medium hover:bg-slate-50 transition-colors"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Share via device
              </button>
            )}
          </div>
        )}

        {/* QR TAB */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-slate-100 p-3 bg-white shadow-inner">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrl}
                  alt="QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              ) : (
                <div className="w-[200px] h-[200px] bg-slate-100 rounded-lg animate-pulse" />
              )}
            </div>
            <p className="text-sm text-slate-500 font-sans text-center max-w-xs">
              Scan this code with your phone camera to open the event page
              instantly.
            </p>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = qrUrl;
                a.download = `${eventTitle.replace(/\s+/g, "-")}-qr.png`;
                a.click();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-sans font-semibold hover:bg-slate-700 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Download QR
            </button>
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === "social" && (
          <div className="grid grid-cols-2 gap-2">
            {SOCIALS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => openSocial(platform)}
                style={{
                  background:
                    shared === platform.id ? platform.color : platform.bg,
                  color: shared === platform.id ? "#fff" : platform.color,
                  borderColor: `${platform.color}22`,
                }}
                className="
                  flex items-center gap-2.5 px-4 py-3 rounded-xl
                  border font-sans text-sm font-semibold
                  transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                "
              >
                {shared === platform.id ? (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  platform.icon
                )}
                <span className="truncate">{platform.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-6 pb-5 pt-1">
        <p className="text-center text-xs text-slate-300 font-sans">
          Help spread the word · every share counts 🎉
        </p>
      </div>
    </div>
  );
}
