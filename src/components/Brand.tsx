import { Link } from "@tanstack/react-router";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        ti3<span className="text-cyber">lab</span>
      </span>
    </Link>
  );
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16 2 L28 8 V17 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 17 V8 Z"
        stroke="var(--cyber)"
        strokeWidth="1.5"
        fill="oklch(0.78 0.17 232 / 0.06)"
      />
      <path
        d="M11 15 L15 19 L21 12"
        stroke="var(--cyber)"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      <path d="M16 2 V30" stroke="var(--cyber)" strokeWidth="0.5" strokeDasharray="1 3" opacity="0.4" />
    </svg>
  );
}
