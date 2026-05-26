/**
 * GrowIQ brand assets — kept as a single source of truth so any change to the
 * logo only needs to happen here.
 *
 * <BrandIcon /> — square chart-bars-with-trend-line icon (scales from 16px favicon-style to 200px+).
 * <BrandWordmark /> — "Grow" (indigo) + "IQ" (mint green), matches the logo files.
 * <BrandLogo /> — convenience wrapper combining icon + wordmark horizontally.
 */
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  size?: number;
};

export function BrandIcon({ className, size = 40 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="GrowIQ"
      role="img"
    >
      {/* Rounded square background */}
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#5b54d6" />
      {/* Bars (lavender → white → green) */}
      <rect x="10" y="38" width="9" height="14" rx="2" fill="#c4b8e8" />
      <rect x="22" y="30" width="9" height="22" rx="2" fill="#c4b8e8" />
      <rect x="34" y="20" width="9" height="32" rx="2" fill="#ffffff" opacity="0.92" />
      <rect x="46" y="12" width="9" height="40" rx="2" fill="#5dd4a6" />
      {/* Trend line */}
      <path
        d="M14.5 42 L26.5 32 L38.5 22 L50.5 14"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />
      {/* Small node circles on the trend line */}
      <circle cx="50.5" cy="14" r="3" fill="none" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="56" cy="10" r="2.5" fill="#5dd4a6" stroke="#ffffff" strokeWidth="1.2" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight", className)}>
      <span className="text-[#4d46c4] dark:text-[#a89ff5]">Grow</span>
      <span className="text-[#3dbf8e] dark:text-[#5dd4a6]">IQ</span>
    </span>
  );
}

export function BrandLogo({
  className,
  iconSize = 36,
  wordmarkClassName,
}: {
  className?: string;
  iconSize?: number;
  wordmarkClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandIcon size={iconSize} className="shrink-0 drop-shadow-sm" />
      <BrandWordmark className={cn("text-xl", wordmarkClassName)} />
    </div>
  );
}
