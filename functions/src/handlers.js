const { SOURCE_URL, buildNormalizedRate, getIstDateString, parseSourcePayload } = require("./goldRates");

const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 365;

function applyCors(response) {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");
}

function handleOptions(request, response) {
  if (request.method === "OPTIONS") {
    applyCors(response);
    response.status(204).send("");
    return true;
  }

  return false;
}

async function fetchLatestSourceRate(fetchImpl = fetch) {
  const upstreamResponse = await fetchImpl(SOURCE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    }
  });

  if (!upstreamResponse.ok) {
    throw new Error(`Gold rate API returned ${upstreamResponse.status}.`);
  }

  const payload = await upstreamResponse.json();
  const sourceEntry = parseSourcePayload(payload);

  return buildNormalizedRate(sourceEntry, new Date());
}

async function writeLatestDocuments(db, normalizedRate) {
  const batch = db.batch();
  const rateRef = db.collection("goldRates").doc(normalizedRate.id);
  const latestRef = db.collection("meta").doc("latestGoldRate");

  batch.set(rateRef, normalizedRate, { merge: true });
  batch.set(latestRef, normalizedRate, { merge: true });

  await batch.commit();

  return normalizedRate;
}

async function syncGoldRate({ db, fetchImpl = fetch }) {
  const normalizedRate = await fetchLatestSourceRate(fetchImpl);
  await writeLatestDocuments(db, normalizedRate);
  return normalizedRate;
}

async function getLatestDocument(db) {
  const latestRef = db.collection("meta").doc("latestGoldRate");
  const latestDoc = await latestRef.get();

  if (latestDoc.exists) {
    return latestDoc.data();
  }

  const snapshot = await db.collection("goldRates").orderBy("date", "desc").limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data();
}

async function ensureLatestSnapshot(db, fetchImpl = fetch) {
  const existingLatest = await getLatestDocument(db);

  if (existingLatest) {
    return existingLatest;
  }

  return syncGoldRate({ db, fetchImpl });
}

async function refreshTodaySnapshot(db, fetchImpl = fetch) {
  const existingLatest = await getLatestDocument(db);
  const todayInIst = getIstDateString(new Date());

  if (existingLatest && existingLatest.date === todayInIst) {
    return {
      status: "already-fetched",
      message: "You are already seeing the latest saved data. This will update tomorrow.",
      data: existingLatest
    };
  }

  const savedRate = await syncGoldRate({ db, fetchImpl });

  return {
    status: "fetched",
    message: "Today's gold rate has been refreshed.",
    data: savedRate
  };
}

function parseLimit(value) {
  const parsed = Number.parseInt(value ?? DEFAULT_LIMIT, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function validateDateQuery(date) {
  if (!date) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  return date;
}

async function getHistoryDocuments(db, query) {
  const from = validateDateQuery(query.from);
  const to = validateDateQuery(query.to);
  const limit = parseLimit(query.limit);

  if (from && to && from > to) {
    throw new Error("The from date must be earlier than or equal to the to date.");
  }

  let historyQuery = db.collection("goldRates").orderBy("date", "desc");

  if (from) {
    historyQuery = historyQuery.where("date", ">=", from);
  }

  if (to) {
    historyQuery = historyQuery.where("date", "<=", to);
  }

  const snapshot = await historyQuery.limit(limit).get();

  return snapshot.docs.map((doc) => doc.data());
}

function createLatestHandler(db, fetchImpl = fetch) {
  return async function getLatestGoldRate(request, response) {
    if (handleOptions(request, response)) {
      return;
    }

    applyCors(response);

    if (request.method !== "GET") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const latest = await ensureLatestSnapshot(db, fetchImpl);

      response.status(200).json({ data: latest });
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  };
}

function createHistoryHandler(db, fetchImpl = fetch) {
  return async function getGoldRateHistory(request, response) {
    if (handleOptions(request, response)) {
      return;
    }

    applyCors(response);

    if (request.method !== "GET") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      let history = await getHistoryDocuments(db, request.query || {});

      if (history.length === 0) {
        await ensureLatestSnapshot(db, fetchImpl);
        history = await getHistoryDocuments(db, request.query || {});
      }

      response.status(200).json({ data: history });
    } catch (error) {
      const status = /YYYY-MM-DD|from date/.test(error.message) ? 400 : 500;
      response.status(status).json({ error: error.message });
    }
  };
}

function createRefreshHandler(db, fetchImpl = fetch) {
  return async function refreshTodayGoldRate(request, response) {
    if (handleOptions(request, response)) {
      return;
    }

    applyCors(response);

    if (!["POST", "GET"].includes(request.method)) {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const result = await refreshTodaySnapshot(db, fetchImpl);
      response.status(200).json(result);
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  };
}

module.exports = {
  createHistoryHandler,
  createLatestHandler,
  createRefreshHandler,
  ensureLatestSnapshot,
  fetchLatestSourceRate,
  getHistoryDocuments,
  getLatestDocument,
  refreshTodaySnapshot,
  syncGoldRate,
  writeLatestDocuments
};
