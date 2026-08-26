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
