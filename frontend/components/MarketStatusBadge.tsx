// components/MarketStatusBadge.tsx
import { useMarketStatus } from "@/hooks/useMarketStatus";

export function MarketStatusBadge() {
  const status = useMarketStatus();

  if (!status) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
          ${status.is_live
            ? "bg-green-500/15 text-green-400 border border-green-500/30"
            : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
          }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status.is_live ? "bg-green-400 animate-pulse" : "bg-gray-400"
          }`}
        />
        {status.is_live ? "LIVE" : "CLOSED"}
      </span>
      {status.is_live && (
        <span className="text-xs text-gray-400 hidden sm:block">
          Closes 3:30 PM
        </span>
      )}
      {!status.is_live && (
        <span className="text-xs text-gray-400 hidden sm:block">
          Opens 9:15 AM
        </span>
      )}
    </div>
  );
}