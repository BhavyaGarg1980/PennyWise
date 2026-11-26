import { useState } from "react";
import { createGoal, updateGoal } from "../services/savingsGoalsApi";

// Modal form used to CREATE and EDIT savings goals.
// New, standalone component.
export default function SavingsGoalForm({
  initial = null,
  onClose,
  onSaved,
  notify,
}) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    targetAmount: initial ? String((initial.targetAmountCents || 0) / 100) : "",
    targetDate: initial?.targetDate
      ? String(initial.targetDate).slice(0, 10)
      : "",
    description: initial?.description || "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const targetAmount = Number(form.targetAmount);

    if (!form.name.trim()) {
      setError("Please enter a goal name.");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Please enter a target amount greater than zero.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      targetAmount,
      targetDate: form.targetDate || null,
      description: form.description.trim(),
    };

    setSaving(true);
    try {
      const saved = initial
        ? await updateGoal(initial._id, payload)
        : await createGoal(payload);

      onSaved?.(saved, Boolean(initial));
      notify?.(initial ? "Savings goal updated." : "Savings goal created.");
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
        className="sg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-form-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SAVE WITH INTENT</span>
            <h2 id="sg-form-title">
              {initial ? "Edit savings goal" : "New savings goal"}
            </h2>
            <p>Give your savings a name and a target.</p>
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

        <form className="sg-form" onSubmit={handleSubmit}>
          <div className="rt-field">
            <label className="form-label" htmlFor="sg-name">
              Goal name
            </label>
            <input
              id="sg-name"
              className="form-input"
              type="text"
              placeholder="e.g. Buy a Laptop"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              required
            />
          </div>

          <div className="rt-field">
            <label className="form-label" htmlFor="sg-target">
              Target amount (₹)
            </label>
            <input
              id="sg-target"
              className="form-input"
              type="number"
              min="1"
              step="0.01"
              placeholder="80000"
              value={form.targetAmount}
              onChange={(event) => set("targetAmount", event.target.value)}
              required
            />
          </div>

          <div className="rt-field">
            <label className="form-label" htmlFor="sg-date">
              Target date (optional)
            </label>
            <input
              id="sg-date"
              className="form-input"
              type="date"
              value={form.targetDate}
              onChange={(event) => set("targetDate", event.target.value)}
            />
          </div>

          <div className="rt-field">
            <label className="form-label" htmlFor="sg-description">
              Description (optional)
            </label>
            <input
              id="sg-description"
              className="form-input"
              type="text"
              placeholder="Add a short note"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>

          {error && <p className="sg-error">{error}</p>}

          <div className="sg-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving..." : initial ? "Save changes" : "Create goal"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
