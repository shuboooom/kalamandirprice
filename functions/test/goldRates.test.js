const { buildNormalizedRate, parseSourcePayload } = require("../src/goldRates");
const {
  ensureLatestSnapshot,
  fetchLatestSourceRate,
  getHistoryDocuments,
  refreshTodaySnapshot,
  syncGoldRate
} = require("../src/handlers");

function createMockDb() {
  const storage = new Map();

  return {
    _storage: storage,
    batch() {
      const operations = [];

      return {
        set(ref, data) {
          operations.push({ ref, data });
        },
        async commit() {
          for (const operation of operations) {
            storage.set(operation.ref.path, operation.data);
          }
        }
      };
    },
    collection(name) {
      const base = {
        doc(id) {
          return {
            id,
            path: `${name}/${id}`,
            async get() {
              const value = storage.get(`${name}/${id}`);
              return {
                exists: value != null,
                data: () => value
              };
            }
          };
        },
        where(field, operator, value) {
          return createQuery(name, [{ field, operator, value }], null, null);
        },
        orderBy(field, direction) {
          return createQuery(name, [], field, direction);
        }
      };

      return base;
    }
  };

  function createQuery(name, filters, orderField, orderDirection) {
    return {
      where(field, operator, value) {
        return createQuery(name, [...filters, { field, operator, value }], orderField, orderDirection);
      },
      orderBy(field, direction) {
        return createQuery(name, filters, field, direction);
      },
      limit(limitValue) {
        return {
          async get() {
            const docs = [...storage.entries()]
              .filter(([path]) => path.startsWith(`${name}/`))
              .map(([path, data]) => ({ id: path.split("/")[1], data }));

            const filtered = docs.filter(({ data }) => {
              return filters.every(({ field, operator, value }) => {
                if (operator === ">=") {
                  return data[field] >= value;
                }

                if (operator === "<=") {
                  return data[field] <= value;
                }

                return true;
              });
            });

            const sorted = orderField
              ? filtered.sort((left, right) => {
                  if (left.data[orderField] === right.data[orderField]) {
                    return 0;
                  }

                  const comparison = left.data[orderField] > right.data[orderField] ? 1 : -1;
                  return orderDirection === "desc" ? comparison * -1 : comparison;
                })
              : filtered;

            const limited = sorted.slice(0, limitValue);

            return {
              empty: limited.length === 0,
              docs: limited.map(({ id, data }) => ({
                id,
                data: () => data
              }))
            };
          }
        };
      }
    };
  }
}

describe("gold rate parsing", () => {
  it("parses the current live payload shape", () => {
    const sourceEntry = parseSourcePayload({
      isSuccess: true,
      data: [
        {
          _id: "69059a0ad33400b4294502e8",
          date: "2026-06-26T00:00:00.000Z",
          rate18K: "110550",
          rate22K: "130090",
          isActive: true,
          updatedAt: "2026-06-26T04:46:51.209Z"
        }
      ]
    });

    const normalized = buildNormalizedRate(sourceEntry, new Date("2026-06-26T06:00:00.000Z"));

    expect(normalized).toMatchObject({
      id: "2026-06-26",
      date: "2026-06-26",
      rate18K: 110550,
      rate22K: 130090,
      sourceId: "69059a0ad33400b4294502e8"
    });
  });

  it("rejects empty payloads", () => {
    expect(() => parseSourcePayload({ isSuccess: true, data: [] })).toThrow(
      "Gold rate API returned no data."
    );
  });

  it("rejects missing rate values", () => {
    expect(() =>
      buildNormalizedRate({
        date: "2026-06-26T00:00:00.000Z",
        rate18K: null,
        rate22K: "130090"
      })
    ).toThrow("Gold rate entry is missing one or more rate values.");
  });
});

describe("gold rate sync", () => {
  it("stores one document per day and updates the same doc on reruns", async () => {
    const db = createMockDb();
    let current22K = "130090";

    const fetchImpl = async () => ({
      ok: true,
      async json() {
        return {
          isSuccess: true,
          data: [
            {
              _id: "source-id",
              date: "2026-06-26T00:00:00.000Z",
              rate18K: "110550",
              rate22K: current22K,
              isActive: true,
              updatedAt: "2026-06-26T04:46:51.209Z"
            }
          ]
        };
      }
    });

    await syncGoldRate({ db, fetchImpl });
    current22K = "130500";
    await syncGoldRate({ db, fetchImpl });

    const goldRatePaths = [...db._storage.keys()].filter((key) => key.startsWith("goldRates/"));
    expect(goldRatePaths).toEqual(["goldRates/2026-06-26"]);
    expect(db._storage.get("goldRates/2026-06-26").rate22K).toBe(130500);
    expect(db._storage.get("meta/latestGoldRate").rate22K).toBe(130500);
  });

  it("surfaces upstream HTTP failures", async () => {
    await expect(
      fetchLatestSourceRate(async () => ({
        ok: false,
        status: 503
      }))
    ).rejects.toThrow("Gold rate API returned 503.");
  });

  it("returns descending history with query filters", async () => {
    const db = createMockDb();

    db._storage.set("goldRates/2026-06-24", { date: "2026-06-24", rate22K: 129000 });
    db._storage.set("goldRates/2026-06-25", { date: "2026-06-25", rate22K: 129500 });
    db._storage.set("goldRates/2026-06-26", { date: "2026-06-26", rate22K: 130090 });

    const history = await getHistoryDocuments(db, {
      from: "2026-06-25",
      to: "2026-06-26",
      limit: "10"
    });

    expect(history.map((item) => item.date)).toEqual(["2026-06-26", "2026-06-25"]);
  });

  it("hydrates the cache when latest data is requested and firestore is empty", async () => {
    const db = createMockDb();

    const latest = await ensureLatestSnapshot(db, async () => ({
      ok: true,
      async json() {
        return {
          isSuccess: true,
          data: [
            {
              _id: "source-id",
              date: "2026-06-26T00:00:00.000Z",
              rate18K: "110550",
              rate22K: "130090",
              isActive: true,
              updatedAt: "2026-06-26T04:46:51.209Z"
            }
          ]
        };
      }
    }));

    expect(latest.date).toBe("2026-06-26");
    expect(db._storage.get("goldRates/2026-06-26").rate22K).toBe(130090);
    expect(db._storage.get("meta/latestGoldRate").rate18K).toBe(110550);
  });

  it("does not fetch again when today's rate is already saved", async () => {
    const db = createMockDb();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    db._storage.set("meta/latestGoldRate", {
      date: today,
      rate18K: 110550,
      rate22K: 130090
    });

    const result = await refreshTodaySnapshot(db, async () => {
      throw new Error("Should not fetch");
    });

    expect(result.status).toBe("already-fetched");
  });
});
