"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";

interface Props {
  data: any;
}

export default function AdvancedChart({ data }: Props) {
  const candleRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("candles");

  const chartOptions = {
    layout: {
      background: { type: ColorType.Solid, color: "#0d0d14" },
      textColor: "#94a3b8",
    },
    grid: {
      vertLines: { color: "#1a1a2e" },
      horzLines: { color: "#1a1a2e" },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: "#1a1a2e" },
    timeScale: { borderColor: "#1a1a2e", timeVisible: true },
  };

  useEffect(() => {
    if (!data || !candleRef.current) return;

    // Clear previous charts
    candleRef.current.innerHTML = "";

    // Main candlestick chart
    const mainChart = createChart(candleRef.current, {
      ...chartOptions,
      height: 350,
      width: candleRef.current.clientWidth,
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    candleSeries.setData(data.candles);
    mainChart.timeScale().fitContent();

    return () => {
      mainChart.remove();
    };
  }, [data, activeTab]);

  useEffect(() => {
    if (!data || activeTab !== "candles" || !volumeRef.current) return;

    volumeRef.current.innerHTML = "";

    const volChart = createChart(volumeRef.current, {
      ...chartOptions,
      height: 120,
      width: volumeRef.current.clientWidth,
    });

    const volSeries = volChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volSeries.setData(data.volumes);
    volChart.timeScale().fitContent();

    return () => volChart.remove();
  }, [data, activeTab]);

  useEffect(() => {
    if (!data || activeTab !== "rsi" || !rsiRef.current) return;

    rsiRef.current.innerHTML = "";

    const rsiChart = createChart(rsiRef.current, {
      ...chartOptions,
      height: 300,
      width: rsiRef.current.clientWidth,
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });

    rsiSeries.setData(data.rsi);
    rsiChart.timeScale().fitContent();

    return () => rsiChart.remove();
  }, [data, activeTab]);

  useEffect(() => {
    if (!data || activeTab !== "macd" || !macdRef.current) return;

    macdRef.current.innerHTML = "";

    const macdChart = createChart(macdRef.current, {
      ...chartOptions,
      height: 300,
      width: macdRef.current.clientWidth,
    });

    const macdSeries = macdChart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });

    const signalSeries = macdChart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
    });

    const histSeries = macdChart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceScaleId: "right",
    });

    macdSeries.setData(
      data.macd.map((d: any) => ({ time: d.time, value: d.macd }))
    );
    signalSeries.setData(
      data.macd.map((d: any) => ({ time: d.time, value: d.signal }))
    );
    histSeries.setData(
      data.macd.map((d: any) => ({
        time: d.time,
        value: d.histogram,
        color: d.histogram >= 0 ? "#26a69a" : "#ef5350",
      }))
    );

    macdChart.timeScale().fitContent();

    return () => macdChart.remove();
  }, [data, activeTab]);

  const tabs = [
    { key: "candles", label: "Candlestick + Volume" },
    { key: "rsi", label: "RSI (14)" },
    { key: "macd", label: "MACD" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-[#1a1a2e] text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {activeTab === "candles" && (
        <div className="space-y-2">
          <div ref={candleRef} className="w-full" />
          <div ref={volumeRef} className="w-full" />
        </div>
      )}

      {activeTab === "rsi" && (
        <div>
          <div className="flex gap-4 mb-3">
            <div className="text-xs text-gray-500">
              <span className="text-red-400 font-semibold">Overbought:</span> above 70
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-green-400 font-semibold">Oversold:</span> below 30
            </div>
          </div>
          <div ref={rsiRef} className="w-full" />
        </div>
      )}

      {activeTab === "macd" && (
        <div>
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-400" />
              <span className="text-xs text-gray-500">MACD</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-yellow-400" />
              <span className="text-xs text-gray-500">Signal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-400 opacity-60" />
              <span className="text-xs text-gray-500">Histogram</span>
            </div>
          </div>
          <div ref={macdRef} className="w-full" />
        </div>
      )}
    </div>
  );
}