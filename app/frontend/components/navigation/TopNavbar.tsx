"use client";

import React, { useState, useEffect, useRef } from "react";
import { WalletButton } from "@/components/wallet/WalletButton";
import { WalletAddress } from "@/components/wallet/WalletAddress";
import { Search, Bell, ChevronDown, X, Menu, Sparkles } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string; description?: string }[];
}

// ── Nav data ───────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  {
    label: "Explore",
    children: [
      {
        label: "Discover Events",
        href: "/explore",
        description: "Find what's happening near you",
      },
      {
        label: "Categories",
        href: "/categories",
        description: "Browse by type",
      },
      {
        label: "Featured",
        href: "/featured",
        description: "Curated picks this week",
      },
    ],
  },
  {
    label: "Host",
    children: [
      {
        label: "Create Event",
        href: "/create",
        description: "Launch your gathering",
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        description: "Manage your events",
      },
      {
        label: "Analytics",
        href: "/analytics",
        description: "Track performance",
      },
    ],
  },
  { label: "Community", href: "/community" },
  { label: "Pricing", href: "/pricing" },
];

// ── Dropdown ───────────────────────────────────────────────────────────────────
interface DropdownProps {
  item: NavItem;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  item,
  isOpen,
  onToggle,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="nav-link group flex items-center gap-1"
      >
        {item.label}
        <ChevronDown
          size={14}
          className="transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown panel */}
      <div
        role="menu"
        aria-label={`${item.label} submenu`}
        className="dropdown-panel"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen
            ? "translateY(0) scale(1)"
            : "translateY(-8px) scale(0.97)",
          pointerEvents: isOpen ? "auto" : "none",
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        {item.children?.map((child) => (
          <a
            key={child.href}
            href={child.href}
            role="menuitem"
            className="dropdown-item"
            tabIndex={isOpen ? 0 : -1}
            onClick={onClose}
          >
            <span className="dropdown-item-label">{child.label}</span>
            {child.description && (
              <span className="dropdown-item-desc">{child.description}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const TopNavbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const toggleDropdown = (label: string) =>
    setOpenDropdown((prev) => (prev === label ? null : label));

  return (
    <>
      {/* ── Styles ──────────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg: #0a0a0f;
          --surface: rgba(255,255,255,0.04);
          --border: rgba(255,255,255,0.08);
          --border-hover: rgba(255,255,255,0.18);
          --text-primary: #f0eee8;
          --text-muted: rgba(240,238,232,0.5);
          --accent: #e8c547;
          --accent-dim: rgba(232,197,71,0.12);
          --accent-glow: rgba(232,197,71,0.25);
          --radius: 14px;
          --nav-h: 68px;
        }

        .gatheraa-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          height: var(--nav-h);
          font-family: 'DM Sans', sans-serif;
          transition: background 0.35s ease, backdrop-filter 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
        }

        .gatheraa-nav.scrolled {
          background: rgba(10,10,15,0.85);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }

        .nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 8px;
        }

        /* Logo */
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .logo-mark {
          width: 34px; height: 34px;
          background: var(--accent);
          border-radius: 10px;
          display: grid;
          place-items: center;
          box-shadow: 0 0 18px var(--accent-glow);
          transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease;
        }
        .nav-logo:hover .logo-mark {
          transform: scale(1.08) rotate(-4deg);
          box-shadow: 0 0 28px var(--accent-glow);
        }
        .logo-wordmark {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 1.3rem;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .logo-wordmark span {
          color: var(--accent);
        }

        /* Desktop nav links */
        .nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
          margin-left: 28px;
        }

        .nav-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
          text-decoration: none;
          padding: 8px 13px;
          border-radius: 9px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease;
          position: relative;
          white-space: nowrap;
        }
        .nav-link:hover, .nav-link:focus-visible {
          color: var(--text-primary);
          background: var(--surface);
          outline: none;
        }
        .nav-link:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        /* Dropdown panel */
        .dropdown-panel {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform-origin: top center;
          translate: -50% 0;
          min-width: 240px;
          background: rgba(14,14,20,0.95);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 8px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
          transition: opacity 0.22s ease, transform 0.22s cubic-bezier(.22,1,.36,1), visibility 0s;
        }

        .dropdown-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 13px;
          border-radius: 9px;
          text-decoration: none;
          transition: background 0.18s ease;
        }
        .dropdown-item:hover, .dropdown-item:focus-visible {
          background: var(--accent-dim);
          outline: none;
        }
        .dropdown-item:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }
        .dropdown-item-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }
        .dropdown-item:hover .dropdown-item-label {
          color: var(--accent);
        }
        .dropdown-item-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Spacer */
        .nav-spacer { flex: 1; }

        /* Icon buttons */
        .icon-btn {
          width: 38px; height: 38px;
          display: grid; place-items: center;
          border-radius: 10px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.2s, background 0.2s, border-color 0.2s;
          position: relative;
          flex-shrink: 0;
        }
        .icon-btn:hover, .icon-btn:focus-visible {
          color: var(--text-primary);
          background: var(--surface);
          border-color: var(--border);
          outline: none;
        }
        .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* Notification dot */
        .notif-dot {
          position: absolute;
          top: 8px; right: 8px;
          width: 7px; height: 7px;
          background: var(--accent);
          border-radius: 50%;
          border: 1.5px solid var(--bg);
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
          50% { box-shadow: 0 0 0 5px transparent; }
        }

        /* Search overlay */
        .search-overlay {
          position: absolute;
          top: 50%;
          right: 24px;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(14,14,20,0.97);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius);
          padding: 8px 14px;
          width: 300px;
          transition: opacity 0.2s ease, transform 0.25s cubic-bezier(.22,1,.36,1);
        }
        .search-overlay input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem;
        }
        .search-overlay input::placeholder { color: var(--text-muted); }

        /* Wallet area */
        .wallet-area {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 8px;
        }

        /* Hamburger */
        .hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          width: 38px; height: 38px;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          background: transparent;
          border: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          flex-shrink: 0;
        }
        .hamburger:hover { background: var(--surface); border-color: var(--border-hover); }
        .hamburger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* ── Mobile overlay ─────────────────────────────────────────────── */
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          top: var(--nav-h);
          z-index: 999;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        .mobile-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .mobile-menu {
          position: fixed;
          top: var(--nav-h);
          left: 0; right: 0;
          background: rgba(10,10,15,0.98);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border-bottom: 1px solid var(--border);
          z-index: 1000;
          padding: 16px 20px 28px;
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.38s cubic-bezier(.22,1,.36,1), opacity 0.3s ease;
          display: none;
        }
        .mobile-menu.open {
          transform: translateY(0);
          opacity: 1;
        }

        .mobile-nav-item {
          border-bottom: 1px solid var(--border);
        }
        .mobile-nav-item:last-of-type { border-bottom: none; }

        .mobile-nav-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 15px 4px;
          color: var(--text-primary);
          text-decoration: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .mobile-nav-link:hover { color: var(--accent); }

        .mobile-dropdown {
          overflow: hidden;
          transition: max-height 0.35s cubic-bezier(.22,1,.36,1), opacity 0.3s ease;
          max-height: 0;
          opacity: 0;
        }
        .mobile-dropdown.open {
          max-height: 300px;
          opacity: 1;
        }
        .mobile-sub-link {
          display: block;
          padding: 11px 14px;
          margin: 3px 0;
          border-radius: 9px;
          color: var(--text-muted);
          font-size: 0.875rem;
          text-decoration: none;
          transition: color 0.2s, background 0.2s;
        }
        .mobile-sub-link:hover { color: var(--accent); background: var(--accent-dim); }

        .mobile-wallet {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Responsive ─────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .nav-links, .icon-btn.search-btn, .icon-btn.bell-btn { display: none; }
          .hamburger { display: flex; }
          .mobile-menu, .mobile-overlay { display: block; }
          .wallet-area { display: none; }
        }

        @media (max-width: 480px) {
          .nav-inner { padding: 0 16px; }
        }
      `}</style>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header
        className={`gatheraa-nav${scrolled ? " scrolled" : ""}`}
        role="banner"
      >
        <nav className="nav-inner" aria-label="Main navigation">
          {/* Logo */}
          <a href="/" className="nav-logo" aria-label="Gatheraa home">
            <div className="logo-mark" aria-hidden="true">
              <Sparkles size={16} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span className="logo-wordmark">
              Gather<span>aa</span>
            </span>
          </a>

          {/* Desktop links */}
          <div
            className="nav-links"
            role="menubar"
            aria-label="Site navigation"
          >
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <Dropdown
                  key={item.label}
                  item={item}
                  isOpen={openDropdown === item.label}
                  onToggle={() => toggleDropdown(item.label)}
                  onClose={() => setOpenDropdown(null)}
                />
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="nav-link"
                  role="menuitem"
                >
                  {item.label}
                </a>
              ),
            )}
          </div>

          <div className="nav-spacer" aria-hidden="true" />

          {/* Search */}
          {searchOpen ? (
            <div className="search-overlay" role="search">
              <Search size={15} color="var(--text-muted)" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search events, hosts…"
                aria-label="Search"
                onBlur={() => setSearchOpen(false)}
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              />
              <button
                className="icon-btn"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                style={{ width: 28, height: 28 }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              className="icon-btn search-btn"
              aria-label="Open search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
            </button>
          )}

          {/* Notifications */}
          <button className="icon-btn bell-btn" aria-label="Notifications">
            <Bell size={17} />
            <span className="notif-dot" aria-hidden="true" />
          </button>

          {/* Wallet */}
          <div className="wallet-area">
            <WalletAddress />
            <WalletButton />
          </div>

          {/* Hamburger */}
          <button
            className="hamburger"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X size={18} color="var(--text-primary)" />
            ) : (
              <Menu size={18} color="var(--text-primary)" />
            )}
          </button>
        </nav>
      </header>

      {/* ── Mobile overlay backdrop ────────────────────────────────────── */}
      <div
        className={`mobile-overlay${mobileOpen ? " open" : ""}`}
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Mobile menu ───────────────────────────────────────────────── */}
      <div
        id="mobile-menu"
        className={`mobile-menu${mobileOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => (
          <div key={item.label} className="mobile-nav-item">
            {item.children ? (
              <>
                <button
                  className="mobile-nav-link"
                  aria-expanded={mobileExpanded === item.label}
                  onClick={() =>
                    setMobileExpanded((v) =>
                      v === item.label ? null : item.label,
                    )
                  }
                >
                  {item.label}
                  <ChevronDown
                    size={16}
                    style={{
                      transition: "transform 0.3s ease",
                      transform:
                        mobileExpanded === item.label
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      color: "var(--text-muted)",
                    }}
                  />
                </button>
                <div
                  className={`mobile-dropdown${mobileExpanded === item.label ? " open" : ""}`}
                >
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      href={child.href}
                      className="mobile-sub-link"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <a
                href={item.href}
                className="mobile-nav-link"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            )}
          </div>
        ))}

        <div className="mobile-wallet">
          <WalletAddress />
          <WalletButton />
        </div>
      </div>
    </>
  );
};

export default TopNavbar;
