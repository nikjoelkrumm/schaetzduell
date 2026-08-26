export interface AvatarConfig {
  bg?: string;
  skin?: string;
  hair?: string;
  hairStyle?: "short" | "long" | "bald";
}

export const BG_SWATCHES = ["#1B4C52", "#F0B429", "#5FBF8B", "#4EA8DE", "#C77DFF", "#F27B9D", "#E2553C", "#12393E"];
export const SKIN_SWATCHES = ["#F3D2B0", "#E8B486", "#C68863", "#9C6240", "#6B4226", "#4A2C17"];
export const HAIR_SWATCHES = ["#2B1B12", "#5C3A21", "#8A5A2E", "#C99A3A", "#B0B0B0", "#E2553C", "#4EA8DE", "#0D2B2F"];

export const DEFAULT_AVATAR: Required<AvatarConfig> = {
  bg: BG_SWATCHES[0],
  skin: SKIN_SWATCHES[0],
  hair: HAIR_SWATCHES[0],
  hairStyle: "short",
};

export function withDefaults(config: AvatarConfig | null | undefined): Required<AvatarConfig> {
  return { ...DEFAULT_AVATAR, ...(config ?? {}) };
}

export function hasCustomAvatar(config: AvatarConfig | null | undefined): boolean {
  return Boolean(config && Object.keys(config).length > 0);
}
