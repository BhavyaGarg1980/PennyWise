import { useEffect, useMemo, useState } from "react";
import { syncBudgetAlerts } from "../services/budgetAlertsApi";
import { formatRupees } from "../services/apiClient";
import "../styles/budgetAlerts.css";

// Severity order used for sorting (highest first).
const SEVERITY = { exceeded: 4, limit: 3, critical: 2, warning: 1, safe: 0 };

const LEVEL_LABEL = {
  safe: "On track",
  warning: "Warning",
  critical: "Critical",
  limit: "Limit reached",
  exceeded: "Exceeded",
};

const THRESHOLD_LABEL = {
  warning: "75% warning",
  critical: "90% critical",
  limit: "100% limit",
  exceeded: "Overspending",
};

function monthLabel(periodKey) {
  if (!periodKey) return "";
  const [year, month] = periodKey.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ProgressBar({ percent, level }) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={`ba-progress ba-level-${level}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="ba-progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function CategoryCard({ status }) {
  const over = status.remainingCents < 0;

  return (
    <article className={`ba-card ba-level-${status.level}`}>
      <div className="ba-card-head">
        <span
          className="ba-chip"
          style={{ background: status.categoryColor || "#64748b" }}
          aria-hidden="true"
        >
          {status.categoryIcon || "📌"}
        </span>
        <div className="ba-card-title">
          <h4>{status.categoryName}</h4>
          <span className={`ba-badge ba-badge-${status.level}`}>
            {LEVEL_LABEL[status.level]}
          </span>
        </div>
        <span className="ba-percent">{status.percent}%</span>
      </div>

      <ProgressBar percent={status.percent} level={status.level} />

      <div className="ba-metrics">
        <div>
          <span>Budget limit</span>
          <strong>{formatRupees(status.limitCents)}</strong>
        </div>
        <div>
          <span>Spent</span>
          <strong>{formatRupees(status.spentCents)}</strong>
        </div>
        <div>
          <span>{over ? "Over by" : "Remaining"}</span>
          <strong className={over ? "ba-over" : ""}>
            {formatRupees(Math.abs(status.remainingCents))}
          </strong>
        </div>
      </div>

      <p className={`ba-message ba-message-${status.level}`}>{status.message}</p>
    </article>
  );
}

function CompactView({ data, onOpenAlerts }) {
  const alerts = useMemo(
    () =>
      [...data.statuses]
        .filter((status) => status.level !== "safe")
        .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]),
    [data.statuses]
  );

  const top = alerts.slice(0, 3);

  return (
    <section className="panel ba-panel ba-compact">
      <div className="panel-header">
        <div>
          <h3>Budget alerts</h3>
          <p>{monthLabel(data.periodKey)} · {data.summary.tracked} budgeted categories</p>
        </div>
        <button type="button" className="text-button" onClick={onOpenAlerts}>
          View all →
        </button>
      </div>

      {top.length === 0 ? (
        <div className="ba-empty ba-empty-good">
          <span aria-hidden="true">✅</span>
          <div>
            <strong>All budgets on track</strong>
            <p>No category has crossed the 75% mark this month.</p>
          </div>
        </div>
      ) : (
        <div className="ba-compact-list">
          {top.map((status) => (
            <button
              type="button"
              key={status.categoryId}
              className={`ba-compact-row ba-level-${status.level}`}
              onClick={onOpenAlerts}
            >
              <span className={`ba-dot ba-dot-${status.level}`} aria-hidden="true" />
              <span className="ba-compact-name">{status.categoryName}</span>
              <span className="ba-compact-meta">
                {formatRupees(status.spentCents)} / {formatRupees(status.limitCents)}
              </span>
              <span className={`ba-badge ba-badge-${status.level}`}>
                {status.percent}%
              </span>
            </button>
          ))}
          {alerts.length > top.length && (
            <p className="ba-more">
              +{alerts.length - top.length} more alert
              {alerts.length - top.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function BudgetAlerts({
  transactions,
  variant = "full",
  onOpenAlerts,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Re-run whenever transactions change (add / edit / delete) so alerts are
  // always recalculated from the latest data.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError("");
        const result = await syncBudgetAlerts();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load budget alerts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [transactions]);

  if (loading) {
    return (
      <section className="panel ba-panel">
        <div className="ba-state">Checking your budgets…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel ba-panel">
        <div className="ba-state ba-state-error">{error}</div>
      </section>
    );
  }

  if (!data || data.statuses.length === 0) {
    return (
      <section className="panel ba-panel">
        <div className="panel-header">
          <div>
            <h3>Budget alerts</h3>
            <p>Smart thresholds at 75%, 90% and 100%</p>
          </div>
        </div>
        <div className="ba-empty">
          <span aria-hidden="true">▤</span>
          <div>
            <strong>No budgets set yet</strong>
            <p>
              Add a monthly limit to a category (for example Food) and PennyWise
              will alert you as you approach it.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return <CompactView data={data} onOpenAlerts={onOpenAlerts} />;
  }

  const sorted = [...data.statuses].sort(
    (a, b) => SEVERITY[b.level] - SEVERITY[a.level]
  );

  return (
    <section className="ba-page">
      <div className="ba-summary">
        <article className="ba-summary-card">
          <span>Total budget</span>
          <strong>{formatRupees(data.summary.totalLimitCents)}</strong>
        </article>
        <article className="ba-summary-card">
          <span>Total spent</span>
          <strong>{formatRupees(data.summary.totalSpentCents)}</strong>
        </article>
        <article className="ba-summary-card">
          <span>{data.summary.totalRemainingCents < 0 ? "Over budget" : "Remaining"}</span>
          <strong className={data.summary.totalRemainingCents < 0 ? "ba-over" : ""}>
            {formatRupees(Math.abs(data.summary.totalRemainingCents))}
          </strong>
        </article>
        <article className="ba-summary-card">
          <span>Active alerts</span>
          <strong>{data.summary.alertCount}</strong>
        </article>
      </div>

      <h3 className="ba-section-title">
        Category usage · {monthLabel(data.periodKey)}
      </h3>

      <div className="ba-grid">
        {sorted.map((status) => (
          <CategoryCard key={status.categoryId} status={status} />
        ))}
      </div>

      <h3 className="ba-section-title">Recorded alerts</h3>
      <p className="ba-hint">
        Each threshold is recorded once per budget period — duplicates are
        prevented automatically.
      </p>

      {data.alerts.length === 0 ? (
        <div className="ba-empty ba-empty-good">
          <span aria-hidden="true">✅</span>
          <div>
            <strong>No alerts recorded yet this month.</strong>
            <p>Categories below 75% usage stay quiet.</p>
          </div>
        </div>
      ) : (
        <ul className="ba-feed">
          {data.alerts.map((alert) => (
            <li key={alert._id} className={`ba-feed-row ba-level-${alert.threshold}`}>
              <span className={`ba-dot ba-dot-${alert.threshold}`} aria-hidden="true" />
              <div className="ba-feed-body">
                <strong>
                  {alert.categoryId?.name || "Category"} ·{" "}
                  <span className={`ba-badge ba-badge-${alert.threshold}`}>
                    {THRESHOLD_LABEL[alert.threshold]}
                  </span>
                </strong>
                <p>{alert.message}</p>
              </div>
              <span className="ba-feed-meta">
                {formatRupees(alert.spentCents)} / {formatRupees(alert.limitCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
