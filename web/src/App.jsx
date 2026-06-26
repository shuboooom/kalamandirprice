import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchLatestRate, fetchRateHistory, refreshTodayRate } from "./api";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDisplayDate,
  formatShortDate
} from "./formatters";

const FILTER_OPTIONS = [
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "previousMonth", label: "Previous Month" },
  { value: "last90", label: "Last 90 Days" },
  { value: "thisYear", label: "This Year" },
  { value: "all", label: "All Time" }
];

function filterHistory(history, filterValue) {
  if (filterValue === "all") {
    return history;
  }

  const today = new Date();
  const todayKey = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  ).getTime();

  return history.filter((entry) => {
    const entryDate = new Date(`${entry.date}T00:00:00Z`);
    const entryKey = entryDate.getTime();

    if (filterValue === "last7") {
      return todayKey - entryKey <= 6 * 24 * 60 * 60 * 1000;
    }

    if (filterValue === "last30") {
      return todayKey - entryKey <= 29 * 24 * 60 * 60 * 1000;
    }

    if (filterValue === "last90") {
      return todayKey - entryKey <= 89 * 24 * 60 * 60 * 1000;
    }

    if (filterValue === "thisMonth") {
      return (
        entryDate.getUTCFullYear() === today.getFullYear() &&
        entryDate.getUTCMonth() === today.getMonth()
      );
    }

    if (filterValue === "previousMonth") {
      const previousMonthDate = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1));
      return (
        entryDate.getUTCFullYear() === previousMonthDate.getUTCFullYear() &&
        entryDate.getUTCMonth() === previousMonthDate.getUTCMonth()
      );
    }

    if (filterValue === "thisYear") {
      return entryDate.getUTCFullYear() === today.getFullYear();
    }

    return true;
  });
}

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [dateFilter, setDateFilter] = useState("last7");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function updateViewport() {
      setIsMobile(window.innerWidth <= 640);
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const [latestResult, historyResult] = await Promise.all([
          fetchLatestRate(),
          fetchRateHistory()
        ]);

        if (!active) {
          return;
        }

        setLatest(latestResult);
        setHistory(historyResult);
        setError("");
        setRefreshMessage("");
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const filteredHistory = filterHistory(history, dateFilter);
  const chartData = [...filteredHistory].reverse();

  async function handleRefresh() {
    try {
      setRefreshing(true);
      const result = await refreshTodayRate();
      setLatest(result.data);

      const nextHistory = await fetchRateHistory();
      setHistory(nextHistory);
      setRefreshMessage(result.message);
    } catch (requestError) {
      setRefreshMessage("We could not refresh the rate right now. Please try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Kalamandir Gold Rate</p>
          <h1>See today&apos;s gold rate at a glance.</h1>
          <p className="subtitle">
            Check today&apos;s 18K and 22K prices and compare them with recent days in one simple
            page.
          </p>
        </div>
      </header>

      {loading ? <section className="panel">Loading today&apos;s gold rate…</section> : null}
      {error ? (
        <section className="panel error-state">
          We could not load the gold rate right now. Please try again in a moment.
        </section>
      ) : null}

      {!loading && !error && latest ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>18K Gold Rate</span>
              <strong>₹{formatCurrency(latest.rate18K)}</strong>
              <small>Updated for {formatDisplayDate(latest.date)}</small>
            </article>
            <article className="stat-card accent">
              <span>22K Gold Rate</span>
              <strong>₹{formatCurrency(latest.rate22K)}</strong>
              <small>Updated for {formatDisplayDate(latest.date)}</small>
            </article>
          </section>

          <section className="refresh-bar">
            <button className="refresh-button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Checking latest rate..." : "Refresh today's rate"}
            </button>
            <p>{refreshMessage || "Use refresh if today's rate has not appeared yet."}</p>
          </section>

          {history.length > 0 ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Price movement</h2>
                    <p>See how the gold rate has changed over time.</p>
                  </div>
                  <label className="filter-control">
                    <span>Show</span>
                    <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                      {FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {isMobile ? (
                  <div className="chart-note">
                    <span className="chart-chip">18K</span>
                    <span className="chart-chip accent-chip">22K</span>
                  </div>
                ) : null}

                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
                    <LineChart
                      data={chartData}
                      margin={{
                        top: 8,
                        right: isMobile ? 8 : 18,
                        left: isMobile ? -18 : 0,
                        bottom: isMobile ? 8 : 0
                      }}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke="#dbcdbd" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={isMobile ? formatShortDate : formatDisplayDate}
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                        minTickGap={isMobile ? 24 : 16}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          isMobile ? `₹${formatCompactCurrency(value)}` : `₹${formatCurrency(value)}`
                        }
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                        width={isMobile ? 64 : 100}
                      />
                      <Tooltip
                        formatter={(value) => [`₹${formatCurrency(value)}`, ""]}
                        labelFormatter={formatDisplayDate}
                      />
                      {!isMobile ? <Legend /> : null}
                      <Line
                        type="monotone"
                        dataKey="rate18K"
                        stroke="#8a5a2b"
                        strokeWidth={3}
                        dot={isMobile ? false : { r: 3 }}
                        activeDot={{ r: isMobile ? 5 : 6 }}
                        name="18K"
                      />
                      <Line
                        type="monotone"
                        dataKey="rate22K"
                        stroke="#c2a04c"
                        strokeWidth={3}
                        dot={isMobile ? false : { r: 3 }}
                        activeDot={{ r: isMobile ? 5 : 6 }}
                        name="22K"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Saved rates</h2>
                    <p>Latest saved rate appears first.</p>
                  </div>
                </div>

                <div className="table-wrap desktop-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>18K</th>
                        <th>22K</th>
                        <th>Saved time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((entry) => (
                        <tr key={entry.date}>
                          <td>{formatDisplayDate(entry.date)}</td>
                          <td>₹{formatCurrency(entry.rate18K)}</td>
                          <td>₹{formatCurrency(entry.rate22K)}</td>
                          <td>{new Date(entry.fetchedAt).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-rate-cards">
                  {filteredHistory.map((entry) => (
                    <article className="rate-history-card" key={`card-${entry.date}`}>
                      <div className="rate-history-top">
                        <strong>{formatDisplayDate(entry.date)}</strong>
                        <span>{new Date(entry.fetchedAt).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="rate-history-values">
                        <div>
                          <label>18K</label>
                          <p>₹{formatCurrency(entry.rate18K)}</p>
                        </div>
                        <div>
                          <label>22K</label>
                          <p>₹{formatCurrency(entry.rate22K)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="empty-filter-state">No saved rates match the selected date range.</p>
                ) : null}
              </section>
            </>
          ) : (
            <section className="panel empty-state">
              No saved rates are available yet. Today&apos;s rate will appear here as soon as it is
              saved.
            </section>
          )}
        </>
      ) : null}

      <footer className="page-footer">
        <p className="footer-note">
          Rates refresh after 11:15 AM IST. Today&apos;s saved rate stays visible until the next update.
        </p>
        <p className="footer-credit">
          Made with love by{" "}
          <a
            href="https://www.linkedin.com/in/shubhoooom/"
            target="_blank"
            rel="noreferrer"
          >
            Shubham Mourya
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
