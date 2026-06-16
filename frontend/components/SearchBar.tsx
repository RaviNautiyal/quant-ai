"use client";

import { useState } from "react";

export default function SearchBar({ onSelect }: any) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async (value: string) => {
    setQuery(value);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    const res = await fetch(`http://127.0.0.1:8000/search/${value}`);
    const data = await res.json();

    setResults(data);
  };

  return (
    <div className="relative w-64">
      <input
        className="border p-3 rounded-lg w-full"
        placeholder="Search stock (Tesla)"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {results.length > 0 && (
        <div className="absolute bg-white border mt-1 w-full rounded shadow z-10">
          {results.map((stock, index) => (
            <div
              key={index}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                onSelect(stock.ticker);
                setQuery(stock.ticker);
                setResults([]);
              }}
            >
              {stock.name} ({stock.ticker})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}