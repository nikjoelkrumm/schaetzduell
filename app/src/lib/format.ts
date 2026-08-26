export function formatCountdown(untilIso: string): string {
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "abgelaufen";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `${days} T ${hours} Std`;
  const minutes = totalMinutes % 60;
  return `${hours} Std ${minutes} Min`;
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} T`;
}
