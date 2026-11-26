// Shared, low-level API client for the new PennyWise features.
//
// It mirrors the existing App.jsx `apiRequest` behaviour:
//  - sends the HTTP-only auth cookie via `credentials: "include"`
//  - JSON-encodes bodies automatically
//  - throws a friendly Error on failure, and a 401-tagged error when the
//    session has expired so callers can ask the app to log the user out.
//
// This file is new and standalone; it does not modify any existing file.

const API_URL = "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const error = new Error("Your session expired. Please log in again.");
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export const fetchCategories = () => apiFetch("/categories");
export const fetchWallets = () => apiFetch("/wallets");

// Money helpers -----------------------------------------------------------
// Amounts are stored in the backend as integer paise (cents). These helpers
// keep the conversion in one place for the new components.

export const toRupees = (cents) => Number(cents || 0) / 100;

export const formatRupees = (cents) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(toRupees(cents));

export const formatDay = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
