"use client";

import Image from "next/image";
import { useState } from "react";

type FlagProps = {
  code: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { w: 20, h: 14, className: "w-5 h-3.5" },
  md: { w: 26, h: 18, className: "w-[26px] h-[18px]" },
  lg: { w: 54, h: 36, className: "w-[54px] h-9" },
};

export function Flag({ code, alt, size = "md", className = "" }: FlagProps) {
  const [failed, setFailed] = useState(false);
  const s = sizes[size];

  if (failed) {
    return (
      <span
        className={`inline-grid place-items-center rounded-sm bg-surface-2 border border-border text-[10px] text-text-muted ${s.className} ${className}`}
        aria-hidden
      >
        ▢
      </span>
    );
  }

  return (
    <Image
      src={`/flags/${code}.svg`}
      alt={alt}
      width={s.w}
      height={s.h}
      className={`rounded-sm object-cover border border-border ${s.className} ${className}`}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
