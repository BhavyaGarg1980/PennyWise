import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import Login from "./Login";
import ChangePassword from "./ChangePassword";

const API_URL = "http://localhost:5000/api";

const incomeCategories = ["Salary", "Freelance", "Investment"];

const paymentModes = [
  "UPI",
  "Cash",
  "Card",
  "Bank Transfer",
  "Other",
];

const navigation = [
  { label: "Overview", icon: "▦" },
  { label: "Transactions", icon: "⇄" },
  { label: "Budgets", icon: "▤" },
  { label: "Reports & insights", icon: "▥" },
];



const budgets = [
  { name: "Food & Dining", limit: 5000, emoji: "🍜" },
  { name: "Shopping", limit: 4000, emoji: "🛍️" },
  { name: "Transport", limit: 2000, emoji: "🚗" },
  { name: "Entertainment", limit: 1500, emoji: "🎬" },
];

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "";

  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const categoryEmoji = (name, categories = []) =>
  categories.find((category) => category.name === name)?.icon ||
  ({
    "Food & Dining": "🍜",
    Food: "🍜",
    Shopping: "🛍️",
    Transport: "🚗",
    Housing: "🏠",
    Health: "💊",
    Entertainment: "🎬",
    Salary: "💼",
    Education: "📚",
    Other: "📌",
  }[name] || "📌");

function Icon({ children, className = "" }) {
  return (
    <span className={`icon ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function Donut({ percent, color, label }) {
  const safePercent = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="donut"
      style={{
        "--progress": `${safePercent * 3.6}deg`,
        "--donut-color": color,
      }}
      aria-label={`${label}: ${safePercent}%`}
    >
      <span>{safePercent}%</span>
    </div>
  );
}

function AreaChart({ data }) {
  const width = 700;
  const height = 260;
  const left = 45;
  const right = 12;
  const top = 18;
  const bottom = 35;

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.income, item.expense]),
    1
  );

  const x = (index) =>
    left +
    (index * (width - left - right)) / Math.max(data.length - 1, 1);

  const y = (value) =>
    height -
    bottom -
    (value / maxValue) * (height - top - bottom);

  const makeLine = (key) =>
    data
      .map(
        (item, index) =>
          `${index === 0 ? "M" : "L"} ${x(index)} ${y(item[key])}`
      )
      .join(" ");

  const makeArea = (key) =>
    data.length > 1
      ? `${makeLine(key)} L ${x(data.length - 1)} ${
          height - bottom
        } L ${x(0)} ${height - bottom} Z`
      : "";

  return (
    <div className="chart-wrap">
      <svg
        className="area-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monthly income and expenses"
      >
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f36c9c" stopOpacity=".65" />
            <stop offset="100%" stopColor="#f36c9c" stopOpacity=".02" />
          </linearGradient>

          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9298ff" stopOpacity=".55" />
            <stop offset="100%" stopColor="#9298ff" stopOpacity=".02" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((step) => {
          const lineY =
            top + (step * (height - top - bottom)) / 4;

          return (
            <g key={step}>
              <line
                x1={left}
                y1={lineY}
                x2={width - right}
                y2={lineY}
                className="chart-grid"
              />

              <text x="0" y={lineY + 4} className="chart-label">
                {Math.round((maxValue * (4 - step)) / 4 / 1000)}k
              </text>
            </g>
          );
        })}

        <path d={makeArea("income")} fill="url(#incomeFill)" />

        <path
          d={makeLine("income")}
          fill="none"
          stroke="#f36c9c"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <path d={makeArea("expense")} fill="url(#expenseFill)" />

        <path
          d={makeLine("expense")}
          fill="none"
          stroke="#9298ff"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {data.map((item, index) => (
          <text
            key={item.month}
            x={x(index)}
            y={height - 7}
            textAnchor="middle"
            className="chart-label"
          >
            {item.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

function CategoryDonutChart({ transactions, categories }) {
  const colors = [
    "#f36c9c",
    "#9298ff",
    "#bb87ee",
    "#70d8a2",
    "#ffb86b",
    "#59c3e6",
    "#f08b70",
  ];

  const categoryTotals = transactions
    .filter((item) => item.type === "expense")
    .reduce((result, item) => {
      result[item.category] =
        (result[item.category] || 0) + item.amount;
      return result;
    }, {});

  const categoryList = Object.entries(categoryTotals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total = categoryList.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  let currentAngle = 0;

  const gradient = categoryList.length
    ? categoryList
        .map((item, index) => {
          const start = currentAngle;
          currentAngle += total ? (item.amount / total) * 360 : 0;

          return `${colors[index % colors.length]} ${start}deg ${currentAngle}deg`;
        })
        .join(", ")
    : "#353443 0deg 360deg";

  return (
    <article className="panel category-chart-panel">
      <div className="panel-header">
        <div>
          <h3>Where your money goes</h3>
          <p>Expense breakdown by category</p>
        </div>
        <span className="chart-period-label">YOUR DATA</span>
      </div>

      {!total ? (
        <div className="chart-empty">
          <span>✧</span>
          <p>Add an expense to see your spending breakdown.</p>
        </div>
      ) : (
        <>
          <div className="category-donut-layout">
            <div
              className="category-donut"
              style={{ "--category-gradient": gradient }}
            >
              <div className="category-donut-center">
                <span>Total expenses</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
          </div>

          <div className="category-legend">
            {categoryList.map((item, index) => (
              <div className="category-legend-item" key={item.name}>
                <span
                  className="category-color-dot"
                  style={{
                    backgroundColor: colors[index % colors.length],
                  }}
                />

                <span className="category-legend-name">
                  {categoryEmoji(item.name, categories)} {item.name}
                </span>

                <strong>{money(item.amount)}</strong>

                <span className="category-percent">
                  {Math.round((item.amount / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function MonthlyBarChart({ data }) {
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.income, item.expense]),
    1
  );

  return (
    <article className="panel monthly-bar-panel">
      <div className="panel-header">
        <div>
          <h3>Monthly comparison</h3>
          <p>Income versus expenses</p>
        </div>
        <span className="chart-period-label">MONTHLY</span>
      </div>

      <div className="chart-legend">
        <span>
          <i className="legend-dot pink-dot" />
          Income
        </span>
        <span>
          <i className="legend-dot blue-dot" />
          Expenses
        </span>
      </div>

      <div className="monthly-bar-chart">
        <div className="bar-y-axis">
          {[100, 75, 50, 25, 0].map((value) => (
            <span key={value}>{value}%</span>
          ))}
        </div>

        <div className="bar-chart-content">
          <div className="bar-grid-lines">
            {[0, 1, 2, 3, 4].map((line) => (
              <span key={line} />
            ))}
          </div>

          <div className="bar-months">
            {data.map((item) => (
              <div className="bar-month-group" key={item.month}>
                <div className="bar-pair">
                  <div
                    className="monthly-bar income-bar"
                    style={{
                      height: `${(item.income / maxValue) * 100}%`,
                    }}
                    title={`${item.month} income: ${money(item.income)}`}
                  />

                  <div
                    className="monthly-bar expense-bar"
                    style={{
                      height: `${(item.expense / maxValue) * 100}%`,
                    }}
                    title={`${item.month} expenses: ${money(item.expense)}`}
                  />
                </div>

                <span className="bar-month-label">{item.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function TransactionList({
  transactions,
  categories,
  onDelete,
  showAll = false,
}) {
  if (!transactions.length) {
    return (
      <div className="empty-state">
        <span>✧</span>
        <strong>No transactions found</strong>
        <p>Try another search or add a transaction.</p>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {transactions.map((item) => (
        <article className="transaction-row" key={item.id}>
          <div
            className={`transaction-icon ${
              item.type === "income" ? "income-bg" : "expense-bg"
            }`}
          >
            {item.categoryIcon || categoryEmoji(item.category, categories)}
          </div>

          <div className="transaction-description">
            <strong>{item.category}</strong>
            <span>{formatDate(item.date)}</span>

            {item.paymentMode && (
              <small className="transaction-payment">
                {item.paymentMode}
              </small>
            )}

            {item.notes && (
              <small className="transaction-payment">
                {item.notes}
              </small>
            )}
          </div>

          <div className="transaction-right">
            <strong
              className={item.type === "income" ? "income-text" : ""}
            >
              {item.type === "income" ? "+" : "−"}
              {money(item.amount)}
            </strong>

            {showAll && (
              <button
                type="button"
                className="delete-button"
                onClick={() => onDelete(item.id)}
                aria-label={`Delete ${item.category} transaction`}
                title="Delete transaction"
              >
                ×
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function BudgetList({ transactions, categories, onSaveBudget }) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showBudgetForm, setShowBudgetForm] = useState(false);

  // Automatically use the current month.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const colorClasses = ["pink", "blue", "purple", "green"];

  // Only count expenses from the current month.
  const monthlyTransactions = transactions.filter((item) => {
    if (item.type !== "expense" || !item.date) {
      return false;
    }

    return String(item.date).slice(0, 7) === currentMonth;
  });

  // Display categories that have a budget limit.
  const budgets = categories
    .filter((category) => Number(category.budgetLimitCents) > 0)
    .map((category) => {
      const categoryId = String(category._id || category.id);

      const spent = monthlyTransactions
        .filter((item) => {
          return (
            String(item.categoryId) === categoryId ||
            item.category === category.name
          );
        })
        .reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

      const limit = Number(category.budgetLimitCents) / 100;
      const percent = limit > 0
        ? Math.round((spent / limit) * 100)
        : 0;

      return {
        ...category,
        spent,
        limit,
        percent,
      };
    });

  // Open the form for creating a new budget.
  function startNewBudget() {
    setEditingId("");
    setSelectedCategory("");
    setBudgetAmount("");
    setError("");
    setShowBudgetForm(true);
  }

  // Open the form to edit an existing budget.
  function startEditing(category) {
    setEditingId(String(category._id || category.id));
    setSelectedCategory(String(category._id || category.id));
    setBudgetAmount(String(Number(category.budgetLimitCents) / 100));
    setError("");
    setShowBudgetForm(true);
  }

  // Close the form and reset its fields.
  function cancelBudgetForm() {
    setShowBudgetForm(false);
    setSelectedCategory("");
    setBudgetAmount("");
    setEditingId("");
    setError("");
  }

  // Save a new budget or update an existing one.
  async function handleSave(event) {
    event.preventDefault();

    const amount = Number(budgetAmount);

    if (!selectedCategory) {
      setError("Please select a category.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a budget amount greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await onSaveBudget(selectedCategory, amount);

      cancelBudgetForm();
    } catch (err) {
      setError(err.message || "Unable to save the budget.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="budget-list">
      {/* Set Budget button */}
      <div className="budget-controls">
        <button
          type="button"
          onClick={startNewBudget}
        >
          + Set Budget
        </button>
      </div>

      {/* Budget creation and editing form */}
      {showBudgetForm && (
        <form
          className="budget-form"
          onSubmit={handleSave}
        >
          <label>
            Select Category

            <select
              value={selectedCategory}
              onChange={(event) => {
                const categoryId = event.target.value;
                setSelectedCategory(categoryId);

                const category = categories.find(
                  (item) =>
                    String(item._id || item.id) === categoryId
                );

                if (
                  category &&
                  Number(category.budgetLimitCents) > 0
                ) {
                  setBudgetAmount(
                    String(
                      Number(category.budgetLimitCents) / 100
                    )
                  );

                  setEditingId(categoryId);
                } else {
                  setBudgetAmount("");
                  setEditingId("");
                }

                setError("");
              }}
              required
            >
              <option value="">Choose a category</option>

              {categories.map((category) => (
                <option
                  key={category._id || category.id}
                  value={String(category._id || category.id)}
                >
                  {category.icon || "📌"} {category.name}
                  {Number(category.budgetLimitCents) > 0
                    ? " (Budget set)"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Monthly Budget (₹)

            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Enter budget amount"
              value={budgetAmount}
              onChange={(event) =>
                setBudgetAmount(event.target.value)
              }
              required
            />
          </label>

          {error && (
            <p className="budget-warning" role="alert">
              {error}
            </p>
          )}

          <div className="budget-form-actions">
            <button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Budget"
                : "Save Budget"}
            </button>

            <button
              type="button"
              onClick={cancelBudgetForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {budgets.length === 0 && (
        <p>
          No budgets set yet. Select "+ Set Budget" to create
          your first category budget.
        </p>
      )}

      {/* Budget cards and progress bars */}
      {budgets.map((budget, index) => {
        const percent = budget.percent;
        const color = colorClasses[index % colorClasses.length];

        return (
          <article
            className="budget-item"
            key={budget._id || budget.id}
          >
            <div className="budget-heading">
              <span className={`budget-icon ${color}`}>
                {budget.icon || "📌"}
              </span>

              <div className="budget-name">
                <strong>{budget.name}</strong>

                <span>
                  {money(budget.spent)} of {money(budget.limit)}
                </span>
              </div>

              <strong className="budget-percent">
                {percent}%
              </strong>

              <button
                type="button"
                onClick={() => startEditing(budget)}
              >
                Edit
              </button>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-label={`${budget.name} budget`}
              aria-valuenow={Math.min(percent, 100)}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                className={`progress-fill ${color}`}
                style={{
                  width: `${Math.min(percent, 100)}%`,
                }}
              />
            </div>

            {percent >= 80 && percent <= 100 && (
              <p className="budget-warning">
                ⚠️ You've used {percent}% of this month's budget.
              </p>
            )}

            {percent > 100 && (
              <p className="budget-warning">
                ⚠️ Over budget by{" "}
                {money(budget.spent - budget.limit)}.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}