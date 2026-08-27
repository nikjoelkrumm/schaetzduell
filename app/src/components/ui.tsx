import type { CSSProperties, ReactNode } from "react";

export function Eyebrow({
  children,
  color = "rgba(243,234,218,.45)",
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        font: "400 10px/1 'DM Mono',monospace",
        letterSpacing: ".16em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type BtnVariant = "amber" | "cream" | "outline" | "ghost" | "dashedGhost";

const variantStyle: Record<BtnVariant, CSSProperties> = {
  amber: { background: "#F0B429", color: "#0D2B2F" },
  cream: { background: "#F3EADA", color: "#0D2B2F" },
  outline: { background: "transparent", color: "#F3EADA", border: "1px solid rgba(243,234,218,.25)" },
  ghost: { background: "transparent", color: "rgba(243,234,218,.6)" },
  dashedGhost: { background: "transparent", color: "#F3EADA", border: "1px dashed rgba(243,234,218,.22)" },
};

export function Btn({
  children,
  onClick,
  variant = "amber",
  height = 54,
  disabled = false,
  style,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  height?: number;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="sd-tap"
      style={{
        border: "none",
        borderRadius: 14,
        height,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        font: "800 15.5px/1 Archivo,sans-serif",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...variantStyle[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "#12393E",
        border: "1px solid rgba(243,234,218,.12)",
        borderRadius: 15,
        padding: 15,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ font: "900 26px/1 'Archivo Black',Archivo", color: "#F0B429" }}>{value}</div>
      <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 6 }}>
        {label}
      </div>
    </Card>
  );
}

export function ProgressDots({ total, filled }: { total: number; filled: number }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "18px 0 20px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 34,
            height: 5,
            borderRadius: 3,
            background: i < filled ? "#F0B429" : "rgba(243,234,218,.2)",
          }}
        />
      ))}
    </div>
  );
}

export function BackRow({ label = "← Zurück", onClick }: { label?: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", padding: "8px 0", cursor: "pointer" }}
    >
      {label}
    </div>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ScreenColumn({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px", ...style }}>
      {children}
    </div>
  );
}
