"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiPost } from "@/lib/apiFetch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const features = {
  free: [
    { text: "5 AI queries per day",           included: true  },
    { text: "Basic portfolio (3 stocks)",      included: true  },
    { text: "Stock charts",                    included: true  },
    { text: "Market overview",                 included: true  },
    { text: "Watchlist",                       included: true  },
    { text: "Advanced candlestick charts",     included: false },
    { text: "Unlimited AI queries",            included: false },
    { text: "Stock screener",                  included: false },
    { text: "Price alerts",                    included: false },
    { text: "Portfolio optimizer",             included: false },
    { text: "Stock comparison",                included: false },
    { text: "News AI analysis",                included: false },
  ],
  pro: [
    { text: "Unlimited AI queries",            included: true },
    { text: "Unlimited portfolio stocks",      included: true },
    { text: "Advanced candlestick charts",     included: true },
    { text: "RSI + MACD indicators",           included: true },
    { text: "Stock screener",                  included: true },
    { text: "Price alerts",                    included: true },
    { text: "Portfolio optimizer",             included: true },
    { text: "Stock comparison",                included: true },
    { text: "News AI analysis",                included: true },
    { text: "Market overview",                 included: true },
    { text: "Priority support",                included: true },
    { text: "Early access to new features",    included: true },
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const [plan,        setPlan]        = useState("free");
  const [loading,     setLoading]     = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    try {
      const data = await apiFetch("/payments/plan");
      setPlan(data.plan);
    } catch (err) { console.error(err); }
    setPageLoading(false);
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Create order
      const order = await apiPost("/payments/create-order", {});

      // Open Razorpay — uses raw fetch for the verify callback since it runs
      // inside Razorpay's handler closure (no apiFetch needed there)
      const options = {
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        name:        "QuantAI Pro",
        description: "Monthly Subscription",
        order_id:    order.order_id,
        handler: async (response: any) => {
          const token = localStorage.getItem("token") || "";
          const verifyRes = await fetch(`${API}/payments/verify`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          });
          if (verifyRes.ok) {
            setPlan("pro");
            alert("🎉 Welcome to QuantAI Pro!");
          }
        },
        theme: { color: "#2563eb" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your Pro subscription?")) return;
    try {
      await apiPost("/payments/cancel", {});
      setPlan("free");
    } catch (err) { console.error(err); }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Choose Your Plan</h1>
        <p className="text-gray-500 mt-2">Upgrade to Pro for unlimited access to all features</p>
      </div>

      {/* Current Plan Banner */}
      {plan === "pro" && (
        <div className="bg-blue-600 bg-opacity-20 border border-blue-600 border-opacity-30 rounded-xl p-4 text-center">
          <p className="text-blue-400 font-semibold">✓ You are on the Pro plan — enjoy unlimited access!</p>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

        {/* Free Plan */}
        <div className={`bg-[#0d0d14] border rounded-xl p-5 md:p-6 ${
          plan === "free" ? "border-blue-600" : "border-[#1a1a2e]"
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 font-semibold">Free</p>
              <p className="text-3xl font-bold text-white mt-1">₹0</p>
              <p className="text-gray-600 text-sm">forever</p>
            </div>
            {plan === "free" && (
              <span className="bg-blue-600 bg-opacity-20 text-blue-400 text-xs px-3 py-1 rounded-full">
                Current Plan
              </span>
            )}
          </div>
          <ul className="mt-6 space-y-3">
            {features.free.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={f.included ? "text-green-400" : "text-gray-600"}>{f.included ? "✓" : "✗"}</span>
                <span className={f.included ? "text-gray-300" : "text-gray-600"}>{f.text}</span>
              </li>
            ))}
          </ul>
          <button disabled
            className="w-full mt-6 py-3 rounded-lg font-semibold text-sm bg-[#1a1a2e] text-gray-500 cursor-not-allowed">
            Current Plan
          </button>
        </div>

        {/* Pro Plan */}
        <div className={`bg-blue-600 rounded-xl p-5 md:p-6 relative overflow-hidden ${
          plan === "pro" ? "border-2 border-white border-opacity-20" : ""
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-blue-100 font-semibold">Pro</p>
              <p className="text-3xl font-bold text-white mt-1">₹499</p>
              <p className="text-blue-200 text-sm">per month</p>
            </div>
            <span className="bg-white bg-opacity-20 text-white text-xs px-3 py-1 rounded-full">
              {plan === "pro" ? "Active" : "Most Popular"}
            </span>
          </div>
          <ul className="mt-6 space-y-3 relative z-10">
            {features.pro.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-white">✓</span>
                <span className="text-blue-100">{f.text}</span>
              </li>
            ))}
          </ul>
          {plan === "pro" ? (
            <button onClick={handleCancel}
              className="w-full mt-6 py-3 rounded-lg font-semibold text-sm bg-white bg-opacity-10 text-white hover:bg-opacity-20 transition relative z-10">
              Cancel Subscription
            </button>
          ) : (
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full mt-6 py-3 rounded-lg font-semibold text-sm bg-white text-blue-600 hover:bg-blue-50 transition disabled:opacity-50 relative z-10">
              {loading ? "Processing..." : "Upgrade to Pro →"}
            </button>
          )}
        </div>

      </div>

      {/* FAQ */}
      <div className="bg-[#0d0d14] border border-[#1a1a2e] rounded-xl p-5 md:p-6">
        <h2 className="text-white font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: "Can I cancel anytime?",               a: "Yes. You can cancel your Pro subscription at any time. You will keep access until the end of the billing period." },
            { q: "Is my payment secure?",               a: "Yes. All payments are processed by Razorpay, a PCI-DSS compliant payment gateway." },
            { q: "What happens when I hit the free AI limit?", a: "Free users get 5 AI queries per day. The limit resets at midnight UTC. Upgrade to Pro for unlimited access." },
            { q: "Do you offer refunds?",               a: "We offer a 7-day money back guarantee if you are not satisfied with the Pro plan." },
          ].map((faq, i) => (
            <div key={i} className="border-b border-[#1a1a2e] pb-4 last:border-0">
              <p className="text-white font-semibold text-sm">{faq.q}</p>
              <p className="text-gray-500 text-sm mt-1">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}