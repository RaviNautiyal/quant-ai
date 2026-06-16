"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("email");
    if (stored) setEmail(stored);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    router.push("/login");
  };

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/analysis", label: "Analysis" },
    { href: "/optimize", label: "Optimize" },
    { href: "/news", label: "News" },
    { href: "/ai", label: "AI Advisor" },
  ];
  const publicPages = ["/", "/login", "/signup"];
  const isHidden =
    pathname === "/login" || pathname === "/signup";

  if (isHidden) return null;

  return (
    <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <span className="text-blue-600 font-bold text-lg">📈 InvestAI</span>
        <div className="hidden md:flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold transition ${
                pathname === link.href
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-blue-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {email && (
          <p className="text-sm text-gray-500 hidden md:block">{email}</p>
        )}
        <button
          onClick={handleLogout}
          className="text-sm bg-red-50 text-red-500 hover:bg-red-100 px-4 py-2 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}