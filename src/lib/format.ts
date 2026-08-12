export const inr = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
};

export const maskAadhaar = (s?: string | null) => {
  if (!s) return "—";
  const digits = s.replace(/\D/g, "");
  if (digits.length < 4) return s;
  return "XXXX XXXX " + digits.slice(-4);
};

export const initials = (name?: string | null) => {
  if (!name) return "??";
  return name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
};
