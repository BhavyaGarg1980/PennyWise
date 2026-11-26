import { useCallback, useEffect, useMemo, useState } from "react";
import SavingsGoalForm from "./SavingsGoalForm";
import SavingsGoalCard from "./SavingsGoalCard";
import {
  listGoals,
  getGoalsSummary,
  getGoalsActivity,
  deleteGoal,
  contributeToGoal,
  getGoalContributions,
} from "../services/savingsGoalsApi";
import {
  fetchWallets,
  formatRupees,
  formatDay,
} from "../services/apiClient";
import "../styles/savingsGoals.css";

// Standalone "Savings Goals" page.
// Rendered by App.jsx only when the sidebar item is selected.
export default function SavingsGoals({
  notify,
  onSessionExpired,
  onDataChanged,
}) {
  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [contributeTarget, setContributeTarget] = useState(null);
  const [contributeType, setContributeType] = useState("deposit");
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeWallet, setContributeWallet] = useState("");
  const [contributeNote, setContributeNote] = useState("");
  const [contributeError, setContributeError] = useState("");
  const [contributing, setContributing] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      const [goalList, summaryData, activityData, walletData] =
        await Promise.all([
          listGoals(),
          getGoalsSummary().catch(() => null),
          getGoalsActivity().catch(() => []),
          fetchWallets().catch(() => []),
        ]);

      setGoals(Array.isArray(goalList) ? goalList : []);
      setSummary(summaryData);
      setActivity(Array.isArray(activityData) ? activityData : []);
      setWallets(Array.isArray(walletData) ? walletData : []);
    } catch (err) {
      guard(err);
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const totalSaved =
      summary?.totalSavedCents ??
      goals.reduce((sum, goal) => sum + goal.currentAmountCents, 0);
    const activeCount =
      summary?.activeCount ??
      goals.filter((goal) => goal.status === "active").length;
    const completedCount =
      summary?.completedCount ??
      goals.filter((goal) => goal.status === "completed").length;

    return { totalSaved, activeCount, completedCount };
  }, [goals, summary]);

  function handleSaved(saved, isEdit) {
    setGoals((current) =>
      isEdit
        ? current.map((goal) => (goal._id === saved._id ? saved : goal))
        : [saved, ...current]
    );
    load();
  }

  async function handleDelete(goal) {
    const confirmed = window.confirm(
      `Delete the savings goal “${goal.name}” and its contribution history?`
    );
    if (!confirmed) return;

    setBusyId(goal._id);
    try {
      await deleteGoal(goal._id);
      setGoals((current) => current.filter((row) => row._id !== goal._id));
      notify?.(`Deleted “${goal.name}”.`);
      load();
      onDataChanged?.();
    } catch (err) {
      guard(err);
    } finally {
      setBusyId("");
    }
  }

  function openContribute(goal, type) {
    setContributeTarget(goal);
    setContributeType(type);
    setContributeAmount("");
    setContributeWallet("");
    setContributeNote("");
    setContributeError("");
  }

  async function submitContribution(event) {
    event.preventDefault();
    setContributeError("");

    const amount = Number(contributeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setContributeError("Please enter an amount greater than zero.");
      return;
    }

    setContributing(true);
    try {
      const data = await contributeToGoal(contributeTarget._id, {
        amount,
        type: contributeType,
        walletId: contributeWallet || null,
        note: contributeNote.trim(),
      });

      const updated = data?.goal;
      if (updated) {
        setGoals((current) =>
          current.map((goal) => (goal._id === updated._id ? updated : goal))
        );
      }

      notify?.(
        contributeType === "deposit"
          ? `Added ${formatRupees(Math.round(amount * 100))} to “${contributeTarget.name}”.`
          : `Withdrew ${formatRupees(Math.round(amount * 100))} from “${contributeTarget.name}”.`
      );

      setContributeTarget(null);
      load();
      onDataChanged?.();
    } catch (err) {
      if (err?.status === 401) {
        onSessionExpired?.();
        return;
      }
      setContributeError(err.message || "Something went wrong.");
    } finally {
      setContributing(false);
    }
  }

  async function openHistory(goal) {
    setHistoryFor(goal);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const data = await getGoalContributions(goal._id);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      guard(err);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <section className="panel page-panel sg-page">
      <div className="sg-toolbar">
        <div>
          <h2>Savings goals</h2>
          <p>Set targets and watch your progress grow.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New goal
        </button>
      </div>

      <div className="sg-stats">
        <div className="sg-stat">
          <span>Total saved</span>
          <strong>{formatRupees(totals.totalSaved)}</strong>
        </div>
        <div className="sg-stat">
          <span>Active goals</span>
          <strong>{totals.activeCount}</strong>
        </div>
        <div className="sg-stat">
          <span>Completed</span>
          <strong>{totals.completedCount}</strong>
        </div>
      </div>

      {error && <p className="sg-error">{error}</p>}

      {loading ? (
        <div className="sg-loading">Loading your goals...</div>
      ) : goals.length === 0 ? (
        <div className="sg-empty">
          <strong>No savings goals yet</strong>
          <p>Create your first goal to start tracking progress.</p>
        </div>
      ) : (
        <div className="sg-grid">
          {goals.map((goal) => (
            <SavingsGoalCard
              key={goal._id}
              goal={goal}
              busy={busyId === goal._id}
              onAdd={(row) => openContribute(row, "deposit")}
              onWithdraw={(row) => openContribute(row, "withdrawal")}
              onEdit={(row) => {
                setEditing(row);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onHistory={openHistory}
            />
          ))}
        </div>
      )}

      {activity.length > 0 && (
        <div className="panel page-panel">
          <div className="panel-header">
            <div>
              <h3>Recent activity</h3>
              <p>Your latest deposits and withdrawals.</p>
            </div>
          </div>

          <div className="sg-activity">
            {activity.slice(0, 8).map((entry) => (
              <div className="sg-activity-item" key={entry._id}>
                <div>
                  <strong>{entry.goalId?.name || "Goal"}</strong>
                  <br />
                  <small>
                    {entry.note || (entry.walletId?.name ? `via ${entry.walletId.name}` : "—")}
                    {" · "}
                    {formatDay(entry.date)}
                  </small>
                </div>
                <span className={`sg-activity-amount ${entry.type}`}>
                  {entry.type === "deposit" ? "+" : "−"}
                  {formatRupees(entry.amountCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <SavingsGoalForm
          initial={editing}
          notify={notify}
          onSaved={handleSaved}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {contributeTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContributeTarget(null);
          }}
        >
          <section
            className="sg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sg-contribute-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {contributeType === "deposit" ? "ADD TO GOAL" : "WITHDRAW FROM GOAL"}
                </span>
                <h2 id="sg-contribute-title">{contributeTarget.name}</h2>
                <p>
                  Saved so far: {formatRupees(contributeTarget.currentAmountCents)}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setContributeTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className="sg-form" onSubmit={submitContribution}>
              <div className="sg-type-toggle">
                <button
                  type="button"
                  className={contributeType === "deposit" ? "selected" : ""}
                  onClick={() => setContributeType("deposit")}
                >
                  + Deposit
                </button>
                <button
                  type="button"
                  className={contributeType === "withdrawal" ? "selected" : ""}
                  onClick={() => setContributeType("withdrawal")}
                >
                  − Withdraw
                </button>
              </div>

              <div className="rt-field">
                <label className="form-label" htmlFor="sg-amount">
                  Amount (₹)
                </label>
                <input
                  id="sg-amount"
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={contributeAmount}
                  onChange={(event) => setContributeAmount(event.target.value)}
                  required
                />
              </div>

              <div className="rt-field">
                <label className="form-label" htmlFor="sg-wallet">
                  Wallet (optional)
                </label>
                <select
                  id="sg-wallet"
                  className="form-input"
                  value={contributeWallet}
                  onChange={(event) => setContributeWallet(event.target.value)}
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
                <label className="form-label" htmlFor="sg-note">
                  Note (optional)
                </label>
                <input
                  id="sg-note"
                  className="form-input"
                  type="text"
                  placeholder="Add a short note"
                  value={contributeNote}
                  onChange={(event) => setContributeNote(event.target.value)}
                />
              </div>

              {contributeError && <p className="sg-error">{contributeError}</p>}

              <div className="sg-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setContributeTarget(null)}
                  disabled={contributing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={contributing}
                >
                  {contributing
                    ? "Saving..."
                    : contributeType === "deposit"
                    ? "Add money"
                    : "Withdraw"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {historyFor && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryFor(null);
          }}
        >
          <section
            className="sg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sg-history-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">CONTRIBUTION HISTORY</span>
                <h2 id="sg-history-title">{historyFor.name}</h2>
                <p>Every deposit and withdrawal for this goal.</p>
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
              <div className="sg-loading">Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="sg-empty">
                <strong>No contributions yet</strong>
                <p>Add money to this goal to see it here.</p>
              </div>
            ) : (
              <div className="sg-activity">
                {historyItems.map((entry) => (
                  <div className="sg-activity-item" key={entry._id}>
                    <div>
                      <strong>
                        {entry.type === "deposit" ? "Deposit" : "Withdrawal"}
                      </strong>
                      <br />
                      <small>
                        {entry.note || "—"} · {formatDay(entry.date)}
                      </small>
                    </div>
                    <span className={`sg-activity-amount ${entry.type}`}>
                      {entry.type === "deposit" ? "+" : "−"}
                      {formatRupees(entry.amountCents)}
                    </span>
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
