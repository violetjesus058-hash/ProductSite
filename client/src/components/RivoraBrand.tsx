import type { SVGProps } from "react";

type RivoraBrandProps = SVGProps<SVGSVGElement> & { variant?: "wordmark" | "icon" };

export default function RivoraBrand({ variant = "wordmark", ...props }: RivoraBrandProps) {
  const isIcon = variant === "icon";
  return (
    <svg
      viewBox={isIcon ? "0 0 160 160" : "0 0 279 213"}
      role="img"
      aria-label="RIVORA Apparel & Lifestyle"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <rect width="100%" height="100%" fill="white" opacity=".94" />
      <g fill="#050505" stroke="#050505" strokeLinecap="round" strokeLinejoin="round">
        <path d="M31 18h75c27 0 43 13 43 33 0 16-10 27-27 31l38 42h-38l-31-38H75v38H31V18Zm44 28v17h29c8 0 12-3 12-9 0-5-4-8-12-8H75Z" stroke="none" />
        <path d="M73 71 52 91V55h21l19 36 27 30-17 20-29-1-25-29 16-16 20 21 16 0-20-25Z" fill="white" strokeWidth="4" />
        <path d="M76 78 65 61" fill="none" stroke="white" strokeWidth="3" />
        <circle cx="63" cy="60" r="5" fill="white" strokeWidth="3" />
      </g>
      {!isIcon && <>
        <text x="139.5" y="181" textAnchor="middle" fill="#050505" fontFamily="Arial, Helvetica, sans-serif" fontSize="27" fontWeight="800" letterSpacing="5">RIVORA</text>
        <path d="M34 190h29M216 190h29" stroke="#050505" strokeWidth="1" />
        <text x="139.5" y="204" textAnchor="middle" fill="#555" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.5" letterSpacing="2.5">APPAREL &amp; LIFESTYLE</text>
      </>}
    </svg>
  );
}
