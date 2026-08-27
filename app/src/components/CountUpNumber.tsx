import { useCountUp } from "../lib/useCountUp";

// Small wrapper so any plain integer stat (a total, a rank, an XP value)
// counts up on mount/change instead of just appearing — used at call sites
// where StatTile's ReactNode `value` is too generic to animate automatically.
export function CountUpNumber({ value, duration = 650 }: { value: number; duration?: number }) {
  const shown = useCountUp(value, duration);
  return <>{shown}</>;
}
