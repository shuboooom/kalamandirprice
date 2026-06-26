export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

export function formatCompactCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

export function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short"
  }).format(new Date(`${value}T00:00:00`));
}

export function buildComparison(history, leftDate, rightDate) {
  const left = history.find((item) => item.date === leftDate) || null;
  const right = history.find((item) => item.date === rightDate) || null;

  if (!left || !right) {
    return null;
  }

  return {
    left,
    right,
    rate18KChange: right.rate18K - left.rate18K,
    rate22KChange: right.rate22K - left.rate22K
  };
}
