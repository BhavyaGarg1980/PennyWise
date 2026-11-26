import { useEffect, useState } from "react";
import {
  fetchBills,
  createBill,
  updateBill,
  setBillStatus,
  deleteBill,
} from "../services/billsApi";
import { formatRupees, formatDay } from "../services/apiClient";
import BillForm from "./BillForm";
import "../styles/billReminders.css";

const VIEWS = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["pending", "Pending"],
  ["paid", "Paid"],
  ["overdue", "Overdue"],
];

const CATEGORY_ICON = {
  Electricity: "⚡",
  Mobile: "📱",
  Internet: "🌐",
  "House Rent": "🏠",
  Water: "💧",
  "Credit Card": "💳",
  Other: "🧾",
};

function tone(bill) {
  if (bill.status === "paid") return "paid";
  if (bill.isOverdue) return "overdue";
  if (bill.isDueToday) return "today";
  if (bill.isDueSoon) return "soon";
  return "pending";
}

const TONE_LABEL = {
  paid: "Paid",
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  pending: "Pending",
};

function BillCard({ bill, busy, onTogglePaid, onEdit, onDelete }) {
  const state = tone(bill);

  return (
    <article className={`br-card br-card-${state}`}>
      <div className="br-card-main">
        <span className="br-card-icon" aria-hidden="true">
          {CATEGORY_ICON[bill.category] || "🧾"}
        </span>

        <div className="br-card-info">
          <div className="br-card-top">
            <h4>{bill.name}</h4>
            <span className={`br-badge br-badge-${state}`}>{TONE_LABEL[state]}</span>
          </div>
          <p className="br-card-meta">
            <span>{bill.category}</span>
            <span>·</span>
            <span>Due {formatDay(bill.dueDate)}</span>
            {bill.frequency !== "none" && (
              <>
                <span>·</span>
                <span className="br-repeat">↻ {bill.frequency}</span>
              </>
            )}
          </p>
          <p className={`br-reminder br-reminder-${state}`}>{bill.reminder}</p>
          {bill.notes && <p className="br-notes">{bill.notes}</p>}
        </div>

        <div className="br-card-amount">
          <strong>{formatRupees(bill.amountCents)}</strong>
          <span>{bill.status === "paid" ? "Paid" : "Amount due"}</span>
        </div>
      </div>

      <div className="br-card-actions">
        <button
          type="button"
          className={`br-action ${bill.status === "paid" ? "secondary-button" : "primary-button"}`}
          onClick={() => onTogglePaid(bill)}
          disabled={busy}
        >
          {bill.status === "paid" ? "Mark as Pending" : "Mark as Paid"}
        </button>
        <button
          type="button"
          className="br-icon-button"
          onClick={() => onEdit(bill)}
          disabled={busy}
        >
          Edit
        </button>
        <button
          type="button"
          className="br-icon-button br-danger"
          onClick={() => onDelete(bill)}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function CompactView({ data, onOpenBills }) {
  const reminders = [...data.bills]
    .filter((b) => b.reminderActive || b.isDueToday || b.isOverdue || b.isDueSoon)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 4);

  return (
    <section className="panel br-panel br-compact">
      <div className="panel-header">
        <div>
          <h3>Bill reminders</h3>
          <p>
            {formatRupees(data.summary.totalPendingCents)} pending ·{" "}
            {data.summary.overdueCount} overdue · {data.summary.dueTodayCount} due today
          </p>
        </div>
        <button type="button" className="text-button" onClick={onOpenBills}>
          View all →
        </button>
      </div>

      {reminders.length === 0 ? (
        <div className="br-empty br-empty-good">
          <span aria-hidden="true">✅</span>
          <div>
            <strong>No bills need attention</strong>
            <p>You're all caught up. Nothing is due soon.</p>
          </div>
        </div>
      ) : (
        <div className="br-compact-list">
          {reminders.map((bill) => {
            const state = tone(bill);
            return (
              <button
                type="button"
                key={bill._id}
                className={`br-compact-row br-row-${state}`}
                onClick={onOpenBills}
              >
                <span className={`br-dot br-dot-${state}`} aria-hidden="true" />
                <span className="br-compact-name">{bill.name}</span>
                <span className="br-compact-reminder">{bill.reminder}</span>
                <span className="br-compact-amount">{formatRupees(bill.amountCents)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function BillReminders({ variant = "full", onOpenBills }) {
  const [data, setData] = useState(null);
  const [view, setView] = useState(variant === "compact" ? "reminders" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError("");
        const result = await fetchBills(view);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load bills.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [view, reloadKey]);

  const refresh = () => setReloadKey((value) => value + 1);

  async function handleSubmit(values) {
    setSaving(true);
    try {
      if (editing) await updateBill(editing._id, values);
      else await createBill(values);
      setShowForm(false);
      setEditing(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePaid(bill) {
    setBusyId(bill._id);
    try {
      await setBillStatus(bill._id, bill.status === "paid" ? "pending" : "paid");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(bill) {
    if (!window.confirm(`Delete "${bill.name}"? This cannot be undone.`)) return;
    setBusyId(bill._id);
    try {
      await deleteBill(bill._id);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(bill) {
    setEditing(bill);
    setShowForm(true);
  }

  if (loading && !data) {
    return (
      <section className="panel br-panel">
        <div className="br-state">Loading your bills…</div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="panel br-panel">
        <div className="br-state br-state-error">{error}</div>
      </section>
    );
  }

  if (variant === "compact") {
    return <CompactView data={data} onOpenBills={onOpenBills} />;
  }

  const summary = data.summary;

  return (
    <div className="br-page">
      {error && <p className="br-inline-error">{error}</p>}

      <div className="br-summary">
        <article className="br-summary-card">
          <span>Total pending</span>
          <strong>{formatRupees(summary.totalPendingCents)}</strong>
          <small>{summary.pendingCount} unpaid bill{summary.pendingCount === 1 ? "" : "s"}</small>
        </article>
        <article className="br-summary-card br-warn">
          <span>Overdue</span>
          <strong>{summary.overdueCount}</strong>
          <small>Past the due date</small>
        </article>
        <article className="br-summary-card">
          <span>Due today</span>
          <strong>{summary.dueTodayCount}</strong>
          <small>{summary.dueSoonCount} due within 7 days</small>
        </article>
        <article className="br-summary-card">
          <span>This month</span>
          <strong>{formatRupees(summary.month.totalCents)}</strong>
          <small>
            {formatRupees(summary.month.paidCents)} paid ·{" "}
            {formatRupees(summary.month.pendingCents)} pending
          </small>
        </article>
      </div>

      <div className="br-toolbar">
        <div className="br-tabs">
          {VIEWS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`br-tab ${view === value ? "active" : ""}`}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={openCreate}>
          + Add bill
        </button>
      </div>

      {data.bills.length === 0 ? (
        <div className="br-empty">
          <span aria-hidden="true">🧾</span>
          <div>
            <strong>No bills here yet</strong>
            <p>
              Add your electricity, rent, internet or credit card bills and
              PennyWise will remind you before they're due.
            </p>
          </div>
        </div>
      ) : (
        <div className="br-list">
          {data.bills.map((bill) => (
            <BillCard
              key={bill._id}
              bill={bill}
              busy={busyId === bill._id}
              onTogglePaid={handleTogglePaid}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div className="br-modal-overlay" role="dialog" aria-modal="true">
          <div className="br-modal">
            <div className="br-modal-header">
              <h3>{editing ? "Edit bill" : "Add a bill"}</h3>
              <button
                type="button"
                className="br-modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <BillForm
              initial={editing}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
