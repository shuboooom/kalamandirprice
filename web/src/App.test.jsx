import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api", () => ({
  fetchLatestRate: vi.fn(),
  fetchRateHistory: vi.fn(),
  refreshTodayRate: vi.fn()
}));

import { fetchLatestRate, fetchRateHistory, refreshTodayRate } from "./api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the latest cards and history table", async () => {
    fetchLatestRate.mockResolvedValue({
      date: "2026-06-26",
      rate18K: 110550,
      rate22K: 130090,
      fetchedAt: "2026-06-26T06:00:00.000Z"
    });
    fetchRateHistory.mockResolvedValue([
      {
        date: "2026-06-26",
        rate18K: 110550,
        rate22K: 130090,
        fetchedAt: "2026-06-26T06:00:00.000Z"
      },
      {
        date: "2026-06-25",
        rate18K: 110100,
        rate22K: 129500,
        fetchedAt: "2026-06-25T06:00:00.000Z"
      }
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("18K Gold Rate")).toBeInTheDocument();
    });

    expect(screen.getByText("22K Gold Rate")).toBeInTheDocument();
    expect(screen.getByText("Price movement")).toBeInTheDocument();
    expect(screen.getByText("Saved rates")).toBeInTheDocument();
    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
    expect(screen.getByText("Refresh today's rate")).toBeInTheDocument();
  });

  it("shows the empty state when no history exists yet", async () => {
    fetchLatestRate.mockResolvedValue({
      date: "2026-06-26",
      rate18K: 110550,
      rate22K: 130090,
      fetchedAt: "2026-06-26T06:00:00.000Z"
    });
    fetchRateHistory.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/No saved rates are available yet/i)).toBeInTheDocument();
    });
  });

  it("shows the already latest message after refresh", async () => {
    fetchLatestRate.mockResolvedValue({
      date: "2026-06-26",
      rate18K: 110550,
      rate22K: 130090,
      fetchedAt: "2026-06-26T06:00:00.000Z"
    });
    fetchRateHistory.mockResolvedValue([
      {
        date: "2026-06-26",
        rate18K: 110550,
        rate22K: 130090,
        fetchedAt: "2026-06-26T06:00:00.000Z"
      }
    ]);
    refreshTodayRate.mockResolvedValue({
      message: "You are already seeing the latest saved data. This will update tomorrow.",
      data: {
        date: "2026-06-26",
        rate18K: 110550,
        rate22K: 130090,
        fetchedAt: "2026-06-26T06:00:00.000Z"
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Refresh today's rate")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Refresh today's rate"));

    await waitFor(() => {
      expect(
        screen.getByText("You are already seeing the latest saved data. This will update tomorrow.")
      ).toBeInTheDocument();
    });
  });
});
