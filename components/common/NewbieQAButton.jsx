"use client";
import Link from "next/link";
import { HelpCircle } from "lucide-react";

export default function NewbieQAButton({ className = "" }) {
  return (
    <Link
      href="/qa"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow ${className}`}
      aria-label="前往新手生成 Q&A"
    >
      <HelpCircle size={16} />
      <span>新手生成 Q&A</span>
    </Link>
  );
}