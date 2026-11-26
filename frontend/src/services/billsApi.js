// API helpers for the Bill Reminders feature.
// Reuses the shared apiFetch client (cookie auth, JSON, friendly errors).

import { apiFetch } from "./apiClient";

export const fetchBills = (view = "all") =>
  apiFetch(`/bills?view=${encodeURIComponent(view)}`);

export const createBill = (payload) =>
  apiFetch("/bills", { method: "POST", body: JSON.stringify(payload) });

export const updateBill = (id, payload) =>
  apiFetch(`/bills/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const setBillStatus = (id, status) =>
  apiFetch(`/bills/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const deleteBill = (id) =>
  apiFetch(`/bills/${id}`, { method: "DELETE" });
