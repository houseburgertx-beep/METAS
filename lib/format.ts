export const formatMoney = (value: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value: number) =>
  `${(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export const formatDateBR = (date: string) => {
  const [, month, day] = date.split("-").map(Number);
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${String(day).padStart(2, "0")} de ${months[month - 1]}`;
};

export const parseMoney = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

export const formatMoneyInput = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
