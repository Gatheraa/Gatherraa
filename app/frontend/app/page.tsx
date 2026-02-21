import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet/WalletButton";
import { WrongNetworkAlert } from "@/components/wallet/WrongNetworkAlert";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              className="dark:invert"
              src="/next.svg"
              alt="Gatherraa logo"
              width={80}
              height={16}
              priority
            />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Gatherraa
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/events"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Events
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Dashboard
            </Link>
            <WalletButton />
          </nav>
        </div>
      </header>

      {/* Wrong Network Alert Banner */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-4">
        <WrongNetworkAlert />
      </div>

      {/* Hero Content */}
      <main className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10 py-24 px-16 sm:items-start">
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Welcome to Gatherraa
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Track your contributions, earnings, and missions all in one place.
            </p>
          </div>
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-50"
              href="/events"
            >
              Browse Events
            </Link>
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-foreground px-5 text-foreground transition-colors hover:bg-[#f5f5f5] dark:hover:bg-[#1a1a1a] md:w-50"
              href="/dashboard"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
