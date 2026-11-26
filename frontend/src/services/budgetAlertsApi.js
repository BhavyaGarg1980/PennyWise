// API helpers for the Smart Budget Alerts feature.
// Reuses the shared apiFetch client (cookie auth, JSON, friendly errors).

import { apiFetch } from "./apiClient";

// Read-only view of the current period's alerts.
export const fetchBudgetAlerts = () => apiFetch("/budget-alerts");

// Recompute budget usage and persist any newly-crossed thresholds.
export const syncBudgetAlerts = () =>
  apiFetch("/budget-alerts/sync", { method: "POST" });
