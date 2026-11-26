import { useCallback, useEffect, useMemo, useState } from "react";
import RecurringTransactionForm from "./RecurringTransactionForm";
import {
  listRecurring,
  setRecurringStatus,
  deleteRecurring,
  getRecurringHistory,
  runDueRecurring,
} from "../services/recurringTransactionsApi";
import {
  fetchCategories,
  fetchWallets,
  formatRupees,
  formatDay,
} from "../services/apiClient";
import "../styles/recurringTransactions.css";

const FREQUENCY_LABEL = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function nextDueLabel(item) {
  if (item.status === "paused") return "Paused";
  if (!item.nextDueDate) return "Schedule ended";
  return `Next due ${formatDay(item.nextDueDate)}`;
}

// Standalone "Recurring Transactions" page.
// Rendered by App.jsx only when the sidebar item is selected.
export default function RecurringTransactions({
  notify,
  onSessionExpired,
  onDataChanged,
}) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [running, setRunning] = useState(false);

  const guard = useCallback(
    (err) => {
      if (err?.status === 401) {
        onSessionExpired?.();
        return;
      }
      setError(err.message || "Something went wrong.");
    },
    [onSessionExpired]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [recurring, cats, walletsData] = await Promise.all([
        listRecurring(),
        fetchCategories().catch(() => []),
        fetchWallets().catch(() => []),
      ]);
      setItems(Array.isArray(recurring) ? recurring : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setWallets(Array.isArray(walletsData) ? walletsData : []);
    } catch (err) {
      guard(err);
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === "active");
    const paused = items.filter((item) => item.status === "paused");
    const monthlyExpense = active
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => {
        const factor =
          item.frequency === "daily"
            ? 30
            : item.frequency === "weekly"
            ? 4.345
            : 1;
        return sum + item.amountCents * factor;
      }, 0);

    const upcoming = active
      .filter((item) => item.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0];

    return {
      total: items.length,
      active: active.length,
      paused: paused.length,
      monthlyExpense,
      nextDue: upcoming?.nextDueDate || null,
      nextDueTitle: upcoming?.title || "",
    };
  }, [items]);

  async function handleSaved(saved, isEdit) {
    setItems((current) =>
      isEdit
        ? current.map((item) => (item._id === saved._id ? saved : item))
        : [saved, ...current]
    );
  }

  async function toggleStatus(item) {
    setBusyId(item._id);
    try {
      const next = item.status === "active" ? "paused" : "active";
      const updated = await setRecurringStatus(item._id, next);
      setItems((current) =>
        current.map((row) => (row._id === updated._id ? updated : row))
      );
      notify?.(
        next === "paused"
          ? `Paused “${updated.title}”.`
          : `Resumed “${updated.title}”.`
      );
      onDataChanged?.();
    } catch (err) {
      guard(err);
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete the recurring transaction “${item.title}”? Already-generated transactions are kept.`
    );
    if (!confirmed) return;

    setBusyId(item._id);
    try {
      await deleteRecurring(item._id);
      setItems((current) => current.filter((row) => row._id !== item._id));
      notify?.(`Deleted “${item.title}”.`);
    } catch (err) {
      guard(err);
    } finally {
      setBusyId("");
    }
  }

  async function openHistory(item) {
    setHistoryFor(item);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const data = await getRecurringHistory(item._id);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      guard(err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function processDueNow() {
    setRunning(true);
    setError("");
    try {
      const data = await runDueRecurring();
      const created = data?.result?.created ?? 0;
      notify?.(
        created > 0
          ? `Generated ${created} new transaction${created === 1 ? "" : "s"}.`
          : "No recurring transactions were due."
      );
      await load();
      onDataChanged?.();
    } catch (err) {
      guard(err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel page-panel rt-page">
      <div className="rt-toolbar">
        <div>
          <h2>Recurring transactions</h2>
          <p>Automate rent, salaries, subscriptions and more.</p>
        </div>
        <div className="rt-toolbar-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={processDueNow}
            disabled={running}
          >
            {running ? "Processing..." : "↻ Process due now"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New recurring
          </button>
        </div>
      </div>

      <div className="rt-stats">
        <div className="rt-stat">
          <span>Active</span>
          <strong>{stats.active}</strong>
          <small>{stats.paused} paused</small>
        </div>
        <div className="rt-stat">
          <span>Total rules</span>
          <strong>{stats.total}</strong>
          <small>Across all frequencies</small>
        </div>
        <div className="rt-stat">
          <span>Est. monthly expense</span>
          <strong>{formatRupees(Math.round(stats.monthlyExpense))}</strong>
          <small>Normalised from active rules</small>
        </div>
        <div className="rt-stat">
          <span>Next due</span>
          <strong>{stats.nextDue ? formatDay(stats.nextDue) : "—"}</strong>
          <small>{stats.nextDueTitle || "Nothing scheduled"}</small>
        </div>
      </div>

      {error && <p className="rt-error">{error}</p>}

      {loading ? (
        <div className="rt-list">
          <div className="rt-skeleton" />
          <div className="rt-skeleton" />
          <div className="rt-skeleton" />
        </div>
      ) : items.length === 0 ? (
        <div className="rt-empty">
          <strong>No recurring transactions yet</strong>
          <p>Create one to have PennyWise record it automatically.</p>
        </div>
      ) : (
        <div className="rt-list">
          {items.map((item) => {
            const category = item.categoryId;
            const wallet = item.walletId;
            const ended = !item.nextDueDate && item.status === "active";

            return (
              <article className="rt-item" key={item._id}>
                <div className="rt-item-icon">
                  {category?.icon || (item.type === "income" ? "↗" : "↘")}
                </div>

                <div className="rt-item-main">
                  <strong>{item.title}</strong>
                  <div className="rt-item-meta">
                    <span>{category?.name || "Uncategorised"}</span>
                    <span>{FREQUENCY_LABEL[item.frequency] || item.frequency}</span>
                    {wallet?.name && <span>💳 {wallet.name}</span>}
                    <span>{nextDueLabel(item)}</span>
                  </div>
                </div>

                <div className={`rt-item-amount ${item.type}`}>
                  {item.type === "income" ? "+" : "−"}
                  {formatRupees(item.amountCents)}
                </div>

                <div className="rt-item-badges" style={{ display: "flex", gap: 8 }}>
                  <span className={`rt-badge ${ended ? "ended" : item.status}`}>
                    {ended ? "ended" : item.status}
                  </span>
                  <span className="rt-badge freq">
                    {FREQUENCY_LABEL[item.frequency] || item.frequency}
                  </span>
                </div>

                <div className="rt-actions">
                  <button
                    type="button"
                    className="rt-action"
                    onClick={() => toggleStatus(item)}
                    disabled={busyId === item._id || ended}
                  >
                    {item.status === "active" ? "❚❚ Pause" : "▶ Resume"}
                  </button>
                  <button
                    type="button"
                    className="rt-action"
                    onClick={() => openHistory(item)}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    className="rt-action"
                    onClick={() => {
                      setEditing(item);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rt-action danger"
                    onClick={() => handleDelete(item)}
                    disabled={busyId === item._id}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <RecurringTransactionForm
          categories={categories}
          wallets={wallets}
          initial={editing}
          notify={notify}
          onSaved={handleSaved}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {historyFor && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryFor(null);
          }}
        >
          <section
            className="rt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rt-history-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">GENERATED HISTORY</span>
                <h2 id="rt-history-title">{historyFor.title}</h2>
                <p>Transactions automatically created by this rule.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setHistoryFor(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {historyLoading ? (
              <div className="rt-loading">Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="rt-empty">
                <strong>No transactions generated yet</strong>
                <p>The first occurrence is created once its due date arrives.</p>
              </div>
            ) : (
              <div className="rt-history">
                {historyItems.map((txn) => (
                  <div className="rt-history-item" key={txn._id}>
                    <div>
                      <strong>{formatRupees(txn.amountCents)}</strong>
                      <br />
                      <small>{txn.note || historyFor.title}</small>
                    </div>
                    <small>{formatDay(txn.date)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
