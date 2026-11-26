import { formatRupees, formatDay } from "../services/apiClient";

// Presentational card for a single savings goal, including the progress bar.
// New, standalone component.
export default function SavingsGoalCard({
  goal,
  onAdd,
  onWithdraw,
  onEdit,
  onDelete,
  onHistory,
  busy = false,
}) {
  const percent = Math.max(0, goal.progressPercent || 0);
  // Cap the visual bar at 100% but keep the real percentage in the text.
  const barWidth = Math.min(100, percent);
  const isCompleted = goal.status === "completed";

  return (
    <article className="sg-card">
      <div className="sg-card-head">
        <div>
          <h3>{goal.name}</h3>
          {goal.description ? <p>{goal.description}</p> : null}
        </div>
        <span className={`sg-status ${goal.status}`}>{goal.status}</span>
      </div>

      <div className="sg-progress-row">
        <strong>{formatRupees(goal.currentAmountCents)}</strong>
        <span>of {formatRupees(goal.targetAmountCents)}</span>
      </div>

      <div className="sg-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`sg-bar-fill ${isCompleted ? "completed" : ""}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="sg-progress-meta">
        <span>{percent}% saved</span>
        <span>
          {goal.targetDate ? `Target ${formatDay(goal.targetDate)}` : "No deadline"}
        </span>
      </div>

      <div className="sg-actions">
        <button
          type="button"
          className="sg-action primary"
          onClick={() => onAdd(goal)}
          disabled={busy}
        >
          + Add money
        </button>
        <button
          type="button"
          className="sg-action"
          onClick={() => onWithdraw(goal)}
          disabled={busy || goal.currentAmountCents <= 0}
        >
          − Withdraw
        </button>
        <button type="button" className="sg-action" onClick={() => onHistory(goal)}>
          History
        </button>
        <button type="button" className="sg-action" onClick={() => onEdit(goal)}>
          Edit
        </button>
        <button
          type="button"
          className="sg-action danger"
          onClick={() => onDelete(goal)}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
