import type { Metadata } from "next";
import "./globals.css";
import LayoutWrapper from "../components/LayoutWrapper";
import Script from "next/script";
import TokenRefresher from "../components/TokenRefresher";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "QuantAI — AI Investment Platform",
  description: "AI-powered investment research and portfolio management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 
        No bg color here — each page controls its own background.
        The old bg-[#0a0a0f] was bleeding into public pages (landing, login).
      */}
      <body>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <TokenRefresher />
        <LayoutWrapper><ErrorBoundary>
    {children}
  </ErrorBoundary></LayoutWrapper>
      </body>
    </html>
  );
}