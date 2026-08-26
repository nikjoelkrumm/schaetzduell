// Simple line icons for the tab bar — clean geometric strokes matching the
// Archivo/amber look, rather than the design prototype's plain colored
// placeholder shapes.

interface IconProps {
  color: string;
  size?: number;
}

export function HomeIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v8.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 19.5v-5h4v5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DuelIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 5 20 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <path d="M14.5 15.5 20 18l-2.2-5.7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 5 4 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <path d="M9.5 15.5 4 18l2.2-5.7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FriendsIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8.5" cy="8" r="3" stroke={color} strokeWidth={2} />
      <path d="M2.5 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx="16.5" cy="8.5" r="2.5" stroke={color} strokeWidth={1.8} />
      <path d="M15 13.7c2.7.2 4.7 2 4.7 4.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function ProfileIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth={2} />
      <path d="M4.5 19.2c0-3.9 3.4-6.4 7.5-6.4s7.5 2.5 7.5 6.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// ── Badge icons — one per achievement, replacing the plain colored dot/square
// the badge grid used to render. Each is a small filled glyph so it reads
// clearly at 16-18px inside the badge tile.

export function FlameIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5c1 2.4-.4 3.7-1.6 5-1.3 1.4-2.4 2.9-2.4 5a4 4 0 0 0 8 0c0-1.3-.5-2.2-1.1-3-.1 1.4-.7 2.1-1.4 2.6.3-1.7-.5-3-1.6-4.2-.3 1-.9 1.6-1.7 2-.2-1.5.5-3.3 1.8-4.2Z"
        fill={color}
      />
    </svg>
  );
}

export function CrownIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 8.5 7 12l5-7 5 7 4-3.5-1.6 9.5H4.6L3 8.5Z" fill={color} />
      <rect x="5" y="18" width="14" height="2.4" rx="1" fill={color} />
    </svg>
  );
}

export function TargetIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth={2} />
      <circle cx="12" cy="12" r="1.6" fill={color} />
    </svg>
  );
}

export function MedalIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 3 6 9l3.3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3l3 6-3.3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="14.5" r="6" stroke={color} strokeWidth={2} />
      <path d="m10 14.2 1.4 1.4L15 12" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoonIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill={color} />
    </svg>
  );
}

export function DiamondIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 9 12 2l8 7-8 13-8-13Z" fill={color} />
      <path d="M4 9h16M9 9 12 2l3 7M9 9l3 13 3-13" stroke="rgba(13,43,47,.35)" strokeWidth={1} />
    </svg>
  );
}

export function CompassIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <path d="m15 8-2 5.5L8 16l2-5.5L15 8Z" fill={color} />
    </svg>
  );
}

export function WhatsAppIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z"
        fill={color}
      />
      <path
        d="M8.7 7.6c.2-.5.5-.5.7-.5h.5c.2 0 .4 0 .5.4.2.4.6 1.5.7 1.6.1.1.1.3 0 .5-.1.2-.2.3-.3.4-.1.2-.3.3-.4.4-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.2.3-.2.5-.1l1.5.7c.2.1.4.2.4.3.1.2.1 1-.3 1.6s-1.6 1.2-2.4 1.2c-.7 0-2.2-.2-4.4-1.9-2.6-2-4-4.4-4.2-4.8-.2-.4-1-1.6-1-3s.8-2.1 1-2.4Z"
        fill="#0D2B2F"
      />
    </svg>
  );
}

export function ArrowUpBadgeIcon({ color, size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <path d="M12 16V8m0 0-3.2 3.2M12 8l3.2 3.2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
