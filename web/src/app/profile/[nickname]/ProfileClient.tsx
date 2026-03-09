"use client";

import { useState } from "react";

interface ProfileClientProps {
  nickname: string;
}

export default function ProfileClient({ nickname }: ProfileClientProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/profile/${encodeURIComponent(nickname)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 border border-[#333333] text-gray-400 hover:border-[#555] hover:text-gray-200 rounded-full text-sm transition-colors"
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>복사됨</span>
        </>
      ) : (
        <>
          <span>🔗</span>
          <span>공유</span>
        </>
      )}
    </button>
  );
}
