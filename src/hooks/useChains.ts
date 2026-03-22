"use client";

import { useState, useEffect } from "react";
import type { ChainOption } from "@/types/pool";

export function useChains() {
  const [chains, setChains] = useState<ChainOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chains")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch chains");
        return res.json();
      })
      .then((data) => {
        setChains(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return { chains, isLoading, error };
}
