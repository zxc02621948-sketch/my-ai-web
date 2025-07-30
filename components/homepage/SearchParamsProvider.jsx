"use client";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SearchParamsProvider({ onSearchChange }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const searchFromUrl = searchParams.get("q");
    if (searchFromUrl && typeof searchFromUrl === "string") {
      onSearchChange(searchFromUrl);
    }
  }, [searchParams, onSearchChange]);

  return null;
}
