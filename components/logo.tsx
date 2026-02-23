export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle - subtle border */}
      <circle
        cx="60"
        cy="60"
        r="54"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
      />
      
      {/* Inner decorative arc */}
      <path
        d="M 30 60 Q 60 30, 90 60"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
        fill="none"
      />
      
      {/* Stylized "V" with serif details */}
      <path
        d="M 40 35 L 60 75 L 80 35"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="miter"
        fill="none"
      />
      
      {/* Serif accents - top left */}
      <line
        x1="37"
        y1="35"
        x2="43"
        y2="35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Serif accents - top right */}
      <line
        x1="77"
        y1="35"
        x2="83"
        y2="35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Bottom dot - lexicon symbol */}
      <circle
        cx="60"
        cy="85"
        r="2"
        fill="currentColor"
        opacity="0.6"
      />
      
      {/* Subtle baseline */}
      <line
        x1="45"
        y1="88"
        x2="75"
        y2="88"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
      />
    </svg>
  )
}
