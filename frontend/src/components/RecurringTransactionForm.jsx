import { useState } from "react";
import {
  createRecurring,
  updateRecurring,
} from "../services/recurringTransactionsApi";

const today = () => new Date().toISOString().slice(0, 10);

function buildInitial(initial, categories) {
  if (initial) {
    return {
      title: initial.title || "",
      amount: String((initial.amountCents || 0) / 100),
      type: initial.type || "expense",
      categoryId: initial.categoryId?._id || initial.categoryId || "",
      walletId: initial.walletId?._id || initial.walletId || "",
      frequency: initial.frequency || "monthly",
      startDate: initial.startDate
        ? String(initial.startDate).slice(0, 10)
        : today(),
      endDate: initial.endDate ? String(initial.endDate).slice(0, 10) : "",
      note: initial.note || "",
    };
  }

  return {
    title: "",
    amount: "",
    type: "expense",
    categoryId: categories[0]?._id || "",
    walletId: "",
    frequency: "monthly",
    startDate: today(),
    endDate: "",
    note: "",
  };
}

// Modal form used to CREATE and EDIT recurring transactions.
// New, standalone component.
export default function RecurringTransactionForm({
  categories = [],
  wallets = [],
  initial = null,
  onClose,
  onSaved,
  notify,
}) {
  const [form, setForm] = useState(() => buildInitial(initial, categories));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const amount = Number(form.amount);

    if (!form.title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    if (!form.categoryId) {
      setError("Please choose a category.");
      return;
    }
    if (!form.startDate) {
      setError("Please choose a start date.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      amount,
      type: form.type,
      categoryId: form.categoryId,
      walletId: form.walletId || null,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
      note: form.note.trim(),
    };

    setSaving(true);
    try {
      const saved = initial
        ? await updateRecurring(initial._id, payload)
        : await createRecurring(payload);

      onSaved?.(saved, Boolean(initial));
      notify?.(
        initial
          ? "Recurring transaction updated."
          : "Recurring transaction created."
      );
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="rt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rt-form-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">AUTOMATE YOUR MONEY</span>
            <h2 id="rt-form-title">
              {initial ? "Edit recurring transaction" : "New recurring transaction"}
            </h2>
            <p>Set a schedule and PennyWise records it automatically.</p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-label">Type</label>
          <div className="type-toggle">
            <button
              type="button"
              className={form.type === "expense" ? "selected expense-selected" : ""}
              onClick={() => set("type", "expense")}
            >
              ↘ Expense
            </button>
            <button
              type="button"
              className={form.type === "income" ? "selected income-selected" : ""}
              onClick={() => set("type", "income")}
            >
              ↗ Income
            </button>
          </div>

          <div className="rt-form-grid">
            <div className="rt-field full">
              <label className="form-label" htmlFor="rt-title">
                Title
              </label>
              <input
                id="rt-title"
                className="form-input"
                type="text"
                placeholder="e.g. Monthly Rent"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                required
              />
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-amount">
                Amount (₹)
              </label>
              <input
                id="rt-amount"
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => set("amount", event.target.value)}
                required
              />
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-frequency">
                Frequency
              </label>
              <select
                id="rt-frequency"
                className="form-input"
                value={form.frequency}
                onChange={(event) => set("frequency", event.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-category">
                Category
              </label>
              <select
                id="rt-category"
                className="form-input"
                value={form.categoryId}
                onChange={(event) => set("categoryId", event.target.value)}
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-wallet">
                Wallet (optional)
              </label>
              <select
                id="rt-wallet"
                className="form-input"
                value={form.walletId}
                onChange={(event) => set("walletId", event.target.value)}
              >
                <option value="">No wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet._id} value={wallet._id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-start">
                Start date
              </label>
              <input
                id="rt-start"
                className="form-input"
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
                required
              />
            </div>

            <div className="rt-field">
              <label className="form-label" htmlFor="rt-end">
                End date (optional)
              </label>
              <input
                id="rt-end"
                className="form-input"
                type="date"
                value={form.endDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </div>

            <div className="rt-field full">
              <label className="form-label" htmlFor="rt-note">
                Notes (optional)
              </label>
              <input
                id="rt-note"
                className="form-input"
                type="text"
                placeholder="Add a short note"
                value={form.note}
                onChange={(event) => set("note", event.target.value)}
              />
            </div>
          </div>

          {error && <p className="rt-error">{error}</p>}

          <div className="rt-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving..." : initial ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
