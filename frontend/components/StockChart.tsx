"use client";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

export default function StockChart({ data }: any) {
  const chartData = {
    labels: data.dates,
    datasets: [
      {
        label: data.ticker + " Price",
        data: data.close_prices,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: "#94a3b8" },
      },
      tooltip: {
        backgroundColor: "#1a1a2e",
        titleColor: "#94a3b8",
        bodyColor: "#fff",
      },
    },
    scales: {
      x: {
        ticks: { color: "#4a5568", maxTicksLimit: 6 },
        grid: { color: "#1a1a2e" },
      },
      y: {
        ticks: { color: "#4a5568" },
        grid: { color: "#1a1a2e" },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}