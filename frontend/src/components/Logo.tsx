export default function Logo({ size = 28, rounded = 8 }: { size?: number; rounded?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="hf-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1FB1A0" />
          <stop offset="1" stopColor="#139384" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx={rounded * (512 / size) * 0.24} fill="url(#hf-logo-bg)" />
      <path
        d="M 110 358 C 180 358, 170 260, 238 250 C 300 241, 292 186, 342 176"
        fill="none"
        stroke="#FBFEFD"
        strokeWidth="46"
        strokeLinecap="round"
      />
      <circle cx="374" cy="162" r="30" fill="#FBFEFD" />
    </svg>
  );
}
