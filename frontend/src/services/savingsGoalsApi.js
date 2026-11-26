// API helpers for the Savings Goals feature.
// New, standalone file — safe to delete without touching the rest of the app.

import { apiFetch } from "./apiClient";

export const listGoals = () => apiFetch("/savings-goals");

export const getGoalsSummary = () => apiFetch("/savings-goals/summary");

export const getGoalsActivity = () => apiFetch("/savings-goals/activity");

export const createGoal = (payload) =>
  apiFetch("/savings-goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateGoal = (id, payload) =>
  apiFetch(`/savings-goals/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteGoal = (id) =>
  apiFetch(`/savings-goals/${id}`, { method: "DELETE" });

export const getGoalContributions = (id) =>
  apiFetch(`/savings-goals/${id}/contributions`);

export const contributeToGoal = (id, payload) =>
  apiFetch(`/savings-goals/${id}/contribute`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
