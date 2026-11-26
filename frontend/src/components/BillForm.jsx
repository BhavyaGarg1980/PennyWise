import { useState } from "react";

const BILL_CATEGORIES = [
  "Electricity",
  "Mobile",
  "Internet",
  "House Rent",
  "Water",
  "Credit Card",
  "Other",
];

const BILL_FREQUENCIES = [
  ["none", "One-time"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["yearly", "Yearly"],
];

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function BillForm({ initial, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    category: initial?.category || "Electricity",
    amount: initial ? String(Number(initial.amountCents || 0) / 100) : "",
    dueDate: toInputDate(initial?.dueDate) || new Date().toISOString().slice(0, 10),
    reminderDate: toInputDate(initial?.reminderDate),
    frequency: initial?.frequency || "none",
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");

  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Bill name is required.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid bill amount.");
      return;
    }

    if (!form.dueDate) {
      setError("A due date is required.");
      return;
    }

    try {
      await onSubmit({
        name: form.name.trim(),
        category: form.category,
        amount,
        dueDate: form.dueDate,
        reminderDate: form.reminderDate || null,
        frequency: form.frequency,
        notes: form.notes.trim(),
      });
    } catch (err) {
      setError(err.message || "Unable to save the bill.");
    }
  }

  return (
    <form className="br-form" onSubmit={handleSubmit}>
      <div className="br-form-grid">
        <label className="br-field br-field-wide">
          <span>Bill name</span>
          <input
            type="text"
            value={form.name}
            onChange={update("name")}
            placeholder="e.g. Electricity Bill"
            maxLength={120}
          />
        </label>

        <label className="br-field">
          <span>Category</span>
          <select value={form.category} onChange={update("category")}>
            {BILL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="br-field">
          <span>Amount (₹)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={update("amount")}
            placeholder="0.00"
          />
        </label>

        <label className="br-field">
          <span>Due date</span>
          <input type="date" value={form.dueDate} onChange={update("dueDate")} />
        </label>

        <label className="br-field">
          <span>Reminder date</span>
          <input
            type="date"
            value={form.reminderDate}
            onChange={update("reminderDate")}
          />
        </label>

        <label className="br-field">
          <span>Repeat</span>
          <select value={form.frequency} onChange={update("frequency")}>
            {BILL_FREQUENCIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="br-field br-field-wide">
          <span>Notes</span>
          <input
            type="text"
            value={form.notes}
            onChange={update("notes")}
            placeholder="Optional note"
            maxLength={300}
          />
        </label>
      </div>

      {form.frequency !== "none" && (
        <p className="br-form-hint">
          Recurring bills automatically create the next reminder when you mark
          this one as paid.
        </p>
      )}

      {error && <p className="br-form-error">{error}</p>}

      <div className="br-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add bill"}
        </button>
      </div>
    </form>
  );
}
