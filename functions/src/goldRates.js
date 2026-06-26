const SOURCE_URL = "https://api.kalamandirjewellers.com/api/goldRate/getAllApis";
const SOURCE_NAME = "kalamandirjewellers";
const TIME_ZONE = "Asia/Kolkata";

function normalizeRate(value, fieldName) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName} value.`);
  }

  return parsed;
}

function getIstDateString(input) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(input));
}

function selectSourceEntry(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Gold rate API returned no data.");
  }

  const activeEntry = entries.find((entry) => entry && entry.isActive);

  if (activeEntry) {
    return activeEntry;
  }

  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.date || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.date || 0).getTime();

    return rightTime - leftTime;
  })[0];
}

function parseSourcePayload(payload) {
  if (!payload || payload.isSuccess !== true) {
    throw new Error("Gold rate API request failed.");
  }

  return selectSourceEntry(payload.data);
}

function buildNormalizedRate(sourceEntry, fetchedAt = new Date()) {
  if (!sourceEntry.date) {
    throw new Error("Gold rate entry is missing date.");
  }

  if (sourceEntry.rate18K == null || sourceEntry.rate22K == null) {
    throw new Error("Gold rate entry is missing one or more rate values.");
  }

  const date = getIstDateString(sourceEntry.date);

  return {
    id: date,
    date,
    rate18K: normalizeRate(sourceEntry.rate18K, "rate18K"),
    rate22K: normalizeRate(sourceEntry.rate22K, "rate22K"),
    sourceDate: sourceEntry.date,
    sourceUpdatedAt: sourceEntry.updatedAt || null,
    sourceId: sourceEntry._id || null,
    fetchedAt: fetchedAt.toISOString(),
    currency: "INR",
    source: SOURCE_NAME,
    raw: sourceEntry
  };
}

module.exports = {
  SOURCE_NAME,
  SOURCE_URL,
  TIME_ZONE,
  buildNormalizedRate,
  getIstDateString,
  parseSourcePayload
};
