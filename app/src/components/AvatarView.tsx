import type { AvatarConfig } from "../lib/avatar";
import { withDefaults, hasCustomAvatar } from "../lib/avatar";

// Flat, geometric avatar — background color, skin tone, hair color/style —
// consistent with the app's bold Archivo-black look rather than a
// photorealistic or cartoon face. Falls back to the plain initials tile
// (same look as before) when nobody has customized their avatar yet.
export function AvatarView({
  config,
  initials,
  size = 38,
}: {
  config?: AvatarConfig | null;
  initials: string;
  size?: number;
}) {
  const radius = size > 50 ? 18 : 11;

  if (!hasCustomAvatar(config)) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "#1B4C52",
          border: "1px solid rgba(243,234,218,.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: `900 ${Math.round(size * 0.37)}px/1 'Archivo Black',Archivo`,
          flex: "none",
        }}
      >
        {initials}
      </div>
    );
  }

  const { bg, skin, hair, hairStyle } = withDefaults(config);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ borderRadius: radius, flex: "none", display: "block" }}
    >
      <rect width="100" height="100" rx="26" fill={bg} />
      {hairStyle === "long" && (
        <path
          d="M20 46 Q20 84 31 92 L31 56 Q31 40 50 38 Q69 40 69 56 L69 92 Q80 84 80 46 Q80 19 50 19 Q20 19 20 46 Z"
          fill={hair}
        />
      )}
      <circle cx="50" cy="58" r="27" fill={skin} />
      {hairStyle !== "bald" && (
        <path d="M23 49 Q23 21 50 21 Q77 21 77 49 Q77 37 50 33 Q23 37 23 49 Z" fill={hair} />
      )}
    </svg>
  );
}
