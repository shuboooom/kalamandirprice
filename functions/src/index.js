const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  createHistoryHandler,
  createLatestHandler,
  createRefreshHandler,
  syncGoldRate
} = require("./handlers");

admin.initializeApp();

const db = admin.firestore();

exports.syncDailyGoldRate = onSchedule(
  {
    schedule: "20 11 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1"
  },
  async () => {
    const savedRate = await syncGoldRate({ db });
    logger.info("Gold rate synced successfully.", { date: savedRate.date });
  }
);

exports.getLatestGoldRate = onRequest(
  {
    region: "asia-south1"
  },
  createLatestHandler(db)
);

exports.getGoldRateHistory = onRequest(
  {
    region: "asia-south1"
  },
  createHistoryHandler(db)
);

exports.refreshTodayGoldRate = onRequest(
  {
    region: "asia-south1"
  },
  createRefreshHandler(db)
);
