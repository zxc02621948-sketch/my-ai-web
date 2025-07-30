"use client";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SearchParamsVerify({ onTokenRead }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) onTokenRead(token);
  }, [token, onTokenRead]);

  return null;
}
