"use client";

import { FiList } from "react-icons/fi";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  RiDashboardLine,
  RiBriefcaseLine,
  RiBarChartLine,
  RiNewspaperLine,
  RiRobot2Line,
  RiStockLine,
  RiPieChartLine,
  RiEyeLine,
  RiLogoutBoxLine,
  RiNotification2Line,
  RiScales3Line,
  RiLineChartLine,
  RiGlobalLine,
  RiMenuLine,
  RiMoneyDollarCircleLine,
  RiCloseLine,
} from "react-icons/ri";

/* ─── Tokens ────────────────────────────────────────────────────── */
const CARD = "rgba(18,18,18,0.97)";
const BDR  = "#2c2c2c";
const T1   = "#f0f0ee";
const T2   = "#888884";
const T3   = "#444440";
const UP   = "#3dba6a";
const DN   = "#e05555";

/* ─── Nav groups ────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: RiDashboardLine  },
      { href: "/market",    label: "Market",    icon: RiGlobalLine     },
      { href: "/portfolio", label: "Portfolio", icon: RiBriefcaseLine  },
      { href: "/pnl", label: "P&L", icon: RiMoneyDollarCircleLine }
    ],
  },
  {
    label: "Monitor",
    links: [
      { href: "/watchlist", label: "Watchlist", icon: RiEyeLine           },
      { href: "/alerts",    label: "Alerts",    icon: RiNotification2Line },
      { href: "/charts",    label: "Charts",    icon: RiLineChartLine     },
    ],
  },
  {
    label: "Research",
    links: [
      { href: "/compare",  label: "Compare",   icon: RiScales3Line  },
      { href: "/analysis", label: "Analysis",  icon: RiBarChartLine },
      { href: "/optimize", label: "Optimizer", icon: RiPieChartLine },
      { href: "/screener", label: "Screener",  icon: RiStockLine    },
      { href: "/news",     label: "News",      icon: RiNewspaperLine},
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/ai",           label: "AI Advisor",   icon: RiRobot2Line },
      { href: "/transactions", label: "Transactions", icon: FiList       },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [email,  setEmail]  = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("email");
    if (stored) setEmail(stored);
  }, []);

  useEffect(() => { setIsOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    router.push("/login");
  };

  const isAuthPage = ["/login", "/signup", "/"].includes(pathname);
  if (isAuthPage) return null;

  const initials = email.charAt(0).toUpperCase() || "U";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');

        /* ── Link ── */
        .sb-link {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 400;
          color: ${T2};
          background: transparent;
          text-decoration: none;
          transition: color 0.15s, background 0.15s, border-color 0.15s, transform 0.15s;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
          border: 0.5px solid transparent;
          position: relative;
          overflow: hidden;
          white-space: nowrap;
        }
        .sb-link::before {
          content: '';
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%) scaleY(0);
          width: 2px; height: 60%;
          background: ${UP};
          border-radius: 0 2px 2px 0;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sb-link:hover {
          color: ${T1};
          background: rgba(255,255,255,0.04);
          border-color: ${BDR};
          transform: translateX(2px);
        }
        .sb-link.active {
          color: ${T1};
          background: rgba(61,186,106,0.08);
          border-color: rgba(61,186,106,0.18);
          font-weight: 500;
        }
        .sb-link.active::before { transform: translateY(-50%) scaleY(1); }
        .sb-link.active .sb-icon { color: ${UP}; }
        .sb-link:hover .sb-icon  { color: ${T1}; }

        .sb-icon {
          font-size: 15px;
          flex-shrink: 0;
          color: ${T3};
          transition: color 0.15s, transform 0.2s;
        }
        .sb-link:hover .sb-icon  { transform: scale(1.1); }
        .sb-link.active .sb-icon { transform: scale(1.1); }

        /* ── Group label ── */
        .sb-group-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.10em;
          color: ${T3};
          text-transform: uppercase;
          padding: 0 10px;
          margin: 10px 0 4px;
          font-family: 'DM Sans', sans-serif;
          user-select: none;
        }

        /* ── Logout ── */
        .sb-logout {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 400;
          color: ${T3};
          background: transparent;
          border: 0.5px solid transparent;
          cursor: pointer;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.15s, background 0.15s, border-color 0.15s, transform 0.15s;
          letter-spacing: 0.01em;
        }
        .sb-logout:hover {
          color: ${DN};
          background: rgba(224,85,85,0.06);
          border-color: rgba(224,85,85,0.16);
          transform: translateX(2px);
        }
        .sb-logout:hover .sb-logout-icon { color: ${DN}; transform: scale(1.1); }
        .sb-logout-icon { font-size: 15px; flex-shrink: 0; color: ${T3}; transition: color 0.15s, transform 0.2s; }

        /* ── Avatar pulse ring ── */
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(61,186,106,0.3); }
          70%  { box-shadow: 0 0 0 5px rgba(61,186,106,0); }
          100% { box-shadow: 0 0 0 0 rgba(61,186,106,0); }
        }
        .sb-avatar { animation: pulse-ring 3s ease-out infinite; }

        /* ── Logo mark spin on hover ── */
        @keyframes logo-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        .sb-logo-mark:hover svg { animation: logo-spin 0.6s ease-in-out; }

        /* ── Slide-in for links ── */
        @keyframes sb-fade-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .sb-nav-item {
          animation: sb-fade-in 0.25s ease-out both;
        }

        /* ── Active indicator glow ── */
        .sb-link.active {
          box-shadow: inset 0 0 12px rgba(61,186,106,0.04);
        }

        /* ── Divider ── */
        .sb-divider {
          height: 0.5px;
          background: linear-gradient(90deg, transparent, ${BDR}, transparent);
          margin: 6px 0;
        }

        /* ── Scrollbar ── */
        .sb-nav::-webkit-scrollbar       { width: 2px; }
        .sb-nav::-webkit-scrollbar-track { background: transparent; }
        .sb-nav::-webkit-scrollbar-thumb { background: ${BDR}; border-radius: 2px; }

        /* ── Hamburger ── */
        .sb-hamburger {
          position: fixed;
          top: 12px; left: 12px;
          z-index: 200;
          width: 36px; height: 36px;
          border-radius: 8px;
          background: ${CARD};
          border: 0.5px solid ${BDR};
          color: ${T2};
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          backdrop-filter: blur(8px);
          transition: border-color 0.15s, color 0.15s;
        }
        .sb-hamburger:hover { border-color: rgba(255,255,255,0.15); color: ${T1}; }

        .sb-close {
          background: transparent;
          border: none;
          color: ${T3};
          cursor: pointer;
          font-size: 17px;
          padding: 4px;
          border-radius: 6px;
          display: none;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .sb-close:hover { color: ${T1}; }

        @media (min-width: 769px) {
          .sb-hamburger { display: none !important; }
          .sb-close     { display: none !important; }
          .sb-aside     { transform: translateX(0) !important; }
        }
        @media (max-width: 768px) {
          .sb-hamburger { display: flex !important; }
          .sb-close     { display: flex !important; }
          .sb-aside {
            transform: translateX(-100%);
            box-shadow: 8px 0 40px rgba(0,0,0,0.6);
          }
          .sb-aside.open { transform: translateX(0); }
        }
      `}</style>

      {/* ── Hamburger ── */}
      <button className="sb-hamburger" onClick={() => setIsOpen(true)} aria-label="Open menu">
        <RiMenuLine />
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 149,
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`sb-aside${isOpen ? " open" : ""}`}
        style={{
          position: "fixed",
          left: 0, top: 0,
          height: "100dvh",
          width: 228,
          background: CARD,
          borderRight: `0.5px solid ${BDR}`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          zIndex: 150,
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          /* subtle gradient overlay */
          backgroundImage: "linear-gradient(180deg, rgba(61,186,106,0.025) 0%, transparent 30%, transparent 70%, rgba(61,186,106,0.015) 100%)",
        }}
      >

        {/* ── Logo ── */}
        <div style={{
          padding: "16px 14px 14px",
          borderBottom: `0.5px solid ${BDR}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div className="sb-logo-mark" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "default" }}>
            {/* Logo mark */}
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: T1,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.4)",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="15" cy="6" r="1.3" fill="#111111"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: T1, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
                QuantAI
              </div>
              <div style={{ fontSize: 9.5, color: T3, letterSpacing: "0.06em", marginTop: 1, textTransform: "uppercase" }}>
                Investment Platform
              </div>
            </div>
          </div>

          <button className="sb-close" onClick={() => setIsOpen(false)} aria-label="Close menu">
            <RiCloseLine />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav
          className="sb-nav"
          style={{
            flex: 1,
            padding: "6px 8px 8px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="sb-divider" />}
              <div className="sb-group-label">{group.label}</div>
              {group.links.map((link, li) => {
                const Icon     = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`sb-link sb-nav-item${isActive ? " active" : ""}`}
                    style={{ animationDelay: `${(gi * 3 + li) * 28}ms` }}
                  >
                    <Icon className="sb-icon" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── User section ── */}
        <div style={{
          padding: "10px 8px 12px",
          borderTop: `0.5px solid ${BDR}`,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          {/* User row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px 10px",
            borderRadius: 7,
            marginBottom: 2,
            background: "rgba(255,255,255,0.02)",
            border: `0.5px solid ${BDR}`,
          }}>
            {/* Avatar */}
            <div
              className="sb-avatar"
              style={{
                width: 27, height: 27, borderRadius: "50%",
                background: "rgba(61,186,106,0.10)",
                border: `0.5px solid rgba(61,186,106,0.25)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: UP, fontSize: 11, fontWeight: 600, flexShrink: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {initials}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{
                color: T2,
                fontSize: 11.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {email || "User"}
              </div>
              <div style={{ fontSize: 9.5, color: T3, marginTop: 1, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Investor
              </div>
            </div>
            {/* Online dot */}
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: UP, flexShrink: 0,
              boxShadow: `0 0 6px ${UP}`,
            }} />
          </div>

          {/* Logout */}
          <button className="sb-logout" onClick={handleLogout}>
            <RiLogoutBoxLine className="sb-logout-icon" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}