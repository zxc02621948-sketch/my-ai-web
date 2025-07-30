// components/common/CopyButton.jsx
"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("❌ 複製失敗", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center text-xs text-gray-400 hover:text-white transition"
    >
      <Copy className="w-4 h-4 mr-1" />
      {copied ? "已複製" : "複製"}
    </button>
  );
};

export default CopyButton;
