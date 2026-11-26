// API helpers for the Recurring Transactions feature.
// New, standalone file — safe to delete without touching the rest of the app.

import { apiFetch } from "./apiClient";

export const listRecurring = () => apiFetch("/recurring-transactions");

export const createRecurring = (payload) =>
  apiFetch("/recurring-transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateRecurring = (id, payload) =>
  apiFetch(`/recurring-transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const setRecurringStatus = (id, status) =>
  apiFetch(`/recurring-transactions/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const deleteRecurring = (id) =>
  apiFetch(`/recurring-transactions/${id}`, { method: "DELETE" });

export const getRecurringHistory = (id) =>
  apiFetch(`/recurring-transactions/${id}/history`);

export const runDueRecurring = () =>
  apiFetch("/recurring-transactions/run-due", { method: "POST" });
