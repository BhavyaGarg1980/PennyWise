import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import Login from "./Login";
import ChangePassword from "./ChangePassword";
import RecurringTransactions from "./components/RecurringTransactions";
import SavingsGoals from "./components/SavingsGoals";
import BudgetAlerts from "./components/BudgetAlerts";
import BillReminders from "./components/BillReminders";

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
  { label: "Budget Alerts", icon: "⚠" },
  { label: "Bill Reminders", icon: "⏰" },
  { label: "Recurring Transactions", icon: "↻" },
  { label: "Savings Goals", icon: "◎" },
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

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);


  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [wallets, setWallets] = useState([]);
const [showWalletModal, setShowWalletModal] = useState(false);

const [walletForm, setWalletForm] = useState({
  name: "",
  type: "bank",
  openingBalance: ""
});

  const monthlyData = useMemo(() => {
  const now = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const monthDate = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    let income = 0;
    let expense = 0;

    transactions.forEach((transaction) => {
      if (!transaction.date) return;

      const dateString = String(transaction.date).slice(0, 10);
      const transactionDate = new Date(`${dateString}T00:00:00`);

      if (Number.isNaN(transactionDate.getTime())) return;

      if (
        transactionDate.getFullYear() === monthDate.getFullYear() &&
        transactionDate.getMonth() === monthDate.getMonth()
      ) {
        const amount = Number(transaction.amount) || 0;

        if (transaction.type === "income") {
          income += amount;
        } else if (transaction.type === "expense") {
          expense += amount;
        }
      }
    });

    result.push({
      month: monthDate.toLocaleDateString("en-US", {
        month: "short",
      }),
      income,
      expense,
    });
  }

  return result;
}, [transactions]);

  const [activePage, setActivePage] = useState("Overview");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("This month");
  const [toast, setToast] = useState("");
  // Bumped by the new feature pages to refresh dashboard/transactions data.
  const [refreshToken, setRefreshToken] = useState(0);

  const [form, setForm] = useState({
    amount: "",
    categoryId: "",
    type: "expense",
    date: new Date().toISOString().slice(0, 10),
    paymentMode: "UPI",
    notes: "",
  });

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    setUser(null);
    throw new Error("Your session expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

async function handleAddWallet(event) {
  event.preventDefault();

  try {
    const newWallet = await apiRequest("/wallets", {
      method: "POST",
      body: JSON.stringify({
        name: walletForm.name,
        type: walletForm.type,
        openingBalance: Number(walletForm.openingBalance || 0)
      })
    });

    setWallets((previous) => [...previous, newWallet]);

    setWalletForm({
      name: "",
      type: "bank",
      openingBalance: ""
    });

    setShowWalletModal(false);
    notify("Wallet added successfully!");
  } catch (error) {
    notify(error.message);
  }
}


  async function saveBudget(categoryId, budgetLimit) {
  const updatedCategory = await apiRequest(
    `/categories/${categoryId}/budget`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ budgetLimit }),
    }
  );

  setCategories((previous) =>
    previous.map((category) =>
      category._id === updatedCategory._id
        ? updatedCategory
        : category
    )
  );
}

  function normalizeTransaction(item) {
    const category =
      item.categoryId && typeof item.categoryId === "object"
        ? item.categoryId
        : null;

    return {
      id: item._id,
      categoryId: category?._id || item.categoryId,
      category: category?.name || "Other",
      categoryIcon: category?.icon || "📌",
      categoryColor: category?.color || "#64748b",
      date: item.date
        ? new Date(item.date).toISOString().slice(0, 10)
        : "",
      amount: Number(item.amountCents || 0) / 100,
      type: item.type,
      paymentMode: item.paymentMode || "Other",
      notes: item.note || "",
      isRecurring: Boolean(item.isRecurring),
    };
  }

  // Check the existing login session.
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!cancelled) {
          setUser(response.ok ? data.user || null : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the logged-in user's categories and transactions.
  useEffect(() => {
    if (!user) {
      setCategories([]);
      setTransactions([]);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setDataLoading(true);

      try {
        const [categoryData, transactionData, walletData] = await Promise.all([
  apiRequest("/categories"),
  apiRequest("/transactions?limit=50&page=1"),
  apiRequest("/wallets"),
]);

        if (cancelled) return;

        const loadedCategories = Array.isArray(categoryData)
          ? categoryData
          : [];

        setCategories(loadedCategories);
        setWallets(Array.isArray(walletData) ? walletData : []);
        setTransactions(
          Array.isArray(transactionData.items)
            ? transactionData.items.map(normalizeTransaction)
            : []
        );

        setForm((current) => ({
          ...current,
          categoryId:
            current.categoryId ||
            loadedCategories.find(
              (item) =>
                item.name === "Food & Dining" ||
                item.name === "Other"
            )?._id ||
            loadedCategories[0]?._id ||
            "",
        }));
      } catch (error) {
        if (!cancelled) notify(error.message);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user, refreshToken]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const expense = transactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    return {
  income,
  expense,
  balance: income - expense,
  savings: income
    ? Math.round(((income - expense) / income) * 1000) / 10
    : 0,
};
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return transactions;

    return transactions.filter((item) =>
      [
        item.category,
        item.paymentMode,
        item.notes,
        item.type,
        item.date,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [transactions, search]);

  const recentTransactions = transactions.slice(0, 5);

  // Save transactions to MongoDB.
  async function addTransaction(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Please enter a valid amount.");
      return;
    }

    if (!form.date || !form.categoryId) {
      notify("Please select a date and category.");
      return;
    }

    try {
      const saved = await apiRequest("/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount,
          type: form.type,
          categoryId: form.categoryId,
          date: form.date,
          paymentMode: form.paymentMode,
          note: form.notes.trim(),
        }),
      });

      setTransactions((current) => [
        normalizeTransaction(saved),
        ...current,
      ]);

      setForm({
        amount: "",
        categoryId:
          categories.find(
            (item) =>
              item.name === "Food & Dining" ||
              item.name === "Other"
          )?._id ||
          categories[0]?._id ||
          "",
        type: "expense",
        date: new Date().toISOString().slice(0, 10),
        paymentMode: "UPI",
        notes: "",
      });

      setShowModal(false);
      setActivePage("Overview");
      notify("Transaction saved successfully!");
    } catch (error) {
      notify(error.message);
    }
  }

  // Delete transactions from MongoDB.
  async function deleteTransaction(id) {
    try {
      await apiRequest(`/transactions/${id}`, {
        method: "DELETE",
      });

      setTransactions((current) =>
        current.filter((item) => item.id !== id)
      );

      notify("Transaction deleted successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Clear the frontend session even if the request fails.
    }

    setUser(null);
    setCategories([]);
    setTransactions([]);
    setShowModal(false);
    setActivePage("Overview");
  }

  // Download the currently loaded transactions as CSV.
  function exportTransactions() {
    const rows = [
      [
        "Category",
        "Type",
        "Amount (INR)",
        "Date",
        "Payment Mode",
        "Notes",
      ],
      ...filteredTransactions.map((item) => [
        item.category,
        item.type,
        item.amount.toFixed(2),
        item.date,
        item.paymentMode,
        item.notes,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value ?? "").replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "pennywise-transactions.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    notify("CSV downloaded.");
  }

  if (authLoading) {
    return (
      <div className="app-loading">
        <p>Loading PennyWise...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          type="button"
          className="brand"
          onClick={() => setActivePage("Overview")}
        >
          <span className="brand-icon">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>PennyWise</strong>
            <small>PERSONAL FINANCE</small>
          </span>
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`nav-item ${
                activePage === item.label ? "active" : ""
              }`}
              onClick={() => setActivePage(item.label)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
              {activePage === item.label && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-sparkle">✧</span>
            <strong>Small steps add up.</strong>
            <p>
              Every mindful money decision brings you closer to your
              goals.
            </p>
          </div>

          <div className="profile">
            <div className="avatar">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </div>

            <div className="profile-info">
              <strong>{user.name || "My Account"}</strong>
              <span>{user.email || "Personal account"}</span>
            </div>

            <button
              type="button"
              className="profile-menu"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
            >
              ↪
            </button>
          </div>

          <div className="preview-label">CONNECTED · MONGODB</div>
        </div>

        <button
  type="button"
  onClick={() => setShowChangePassword(true)}
  style={{
    width: "100%",
    padding: "12px 16px",
    marginTop: "12px",
    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
    transition: "all 0.2s ease",
  }}
>
  🔒 Change Password
</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR MONEY, IN FOCUS</div>
            <h1>
              {activePage === "Overview"
                ? "Good money habits start here."
                : activePage}
            </h1>
            <p className="page-subtitle">
              {activePage === "Overview"
                ? "A clearer picture of your financial life."
                : "Manage your finances with confidence."}
            </p>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Icon>⌕</Icon>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transactions"
                aria-label="Search transactions"
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>

            <button
              type="button"
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => notify("You're all caught up!")}
            >
              ♧
              <span className="notification-dot" />
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => setShowModal(true)}
            >
              <span>＋</span> Add transaction
            </button>
          </div>
        </header>

        {dataLoading && (
          <div className="loading-message">
            Loading your transactions...
          </div>
        )}

        {activePage === "Overview" && (
          <>
            <section className="hero-banner">
              <div>
                <span className="hero-tag">
                  ✧ &nbsp; YOUR MONTH AT A GLANCE
                </span>
                <h2>Progress over perfection.</h2>
                <p>
                  Here's how your money is moving. Every small step
                  counts.
                </p>
              </div>
              <div className="hero-symbol" aria-hidden="true">
                ₹
              </div>
              <div className="hero-orb" />
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon pink">₹</span>
                  
                </div>
                <span className="stat-label">Total balance</span>
                <strong className="stat-value">
                  {money(totals.balance)}
                </strong>
                <span className="stat-note">
                  Income minus expenses
                </span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon green">↗</span>
                  
                </div>
                <span className="stat-label">Total income</span>
                <strong className="stat-value">
                  {money(totals.income)}
                </strong>
                <span className="stat-note">Money coming in</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon orange">↘</span>
                  <Donut
  percent={
    totals.income
      ? Math.min(
          100,
          Math.round(
            (totals.expense / totals.income) * 1000
          ) / 10
        )
      : 0
  }
  color="#ffb86b"
  label="Expense indicator"
/>
                </div>
                <span className="stat-label">Total expenses</span>
                <strong className="stat-value">
                  {money(totals.expense)}
                </strong>
                <span className="stat-note">Money going out</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon blue">✧</span>
                  <div className="savings-number">
                    {totals.savings}%
                  </div>
                </div>
                <span className="stat-label">Savings rate</span>
                <strong className="stat-value">
  {totals.savings.toFixed(1)}% of income retained
</strong>
                <span className="stat-note">Of your income</span>
              </article>
            </section>

<section className="panel wallets-panel">
  <div className="panel-header">
    <div>
      <h3>My Wallets</h3>
      <p>Manage all your money in one place.</p>
    </div>

    <button
      type="button"
      className="primary-button"
      onClick={() => setShowWalletModal(!showWalletModal)}
    >
      + Add Wallet
    </button>
  </div>

  {showWalletModal && (
    <form className="wallet-form" onSubmit={handleAddWallet}>
      <h4>Add a new wallet</h4>

      <label className="form-label">Wallet name</label>
      <input
        type="text"
        placeholder="e.g. HDFC Bank"
        value={walletForm.name}
        onChange={(event) =>
          setWalletForm({
            ...walletForm,
            name: event.target.value
          })
        }
        required
      />

      <label className="form-label">Wallet type</label>
      <select
        value={walletForm.type}
        onChange={(event) =>
          setWalletForm({
            ...walletForm,
            type: event.target.value
          })
        }
      >
        <option value="bank">Bank Account</option>
        <option value="cash">Cash</option>
        <option value="digital">Digital Wallet</option>
      </select>

      <label className="form-label">Opening balance (₹)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Enter opening balance"
        value={walletForm.openingBalance}
        onChange={(event) =>
          setWalletForm({
            ...walletForm,
            openingBalance: event.target.value
          })
        }
      />

      <div className="wallet-form-actions">
        <button type="submit" className="primary-button">
          Save Wallet
        </button>

        <button
          type="button"
          className="text-button"
          onClick={() => setShowWalletModal(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  )}

  <div className="wallet-grid">
    {wallets.length === 0 ? (
      <p className="wallet-empty">
        No wallets added yet. Click Add Wallet to get started.
      </p>
    ) : (
      wallets.map((wallet) => (
        <article className="wallet-card" key={wallet._id}>
          <div className="wallet-card-top">
            <span className="wallet-icon">
              {wallet.type === "bank"
                ? "🏦"
                : wallet.type === "cash"
                ? "💵"
                : "📱"}
            </span>

            <span className="wallet-type">
              {wallet.type}
            </span>
          </div>

          <h4>{wallet.name}</h4>

          <span className="wallet-balance-label">
            Available balance
          </span>

          <strong>
            {money(Number(wallet.balanceCents || 0) / 100)}
          </strong>
        </article>
      ))
    )}
  </div>
</section>
            <BudgetAlerts
              variant="compact"
              transactions={transactions}
              onOpenAlerts={() => setActivePage("Budget Alerts")}
            />

            <BillReminders
              variant="compact"
              onOpenBills={() => setActivePage("Bill Reminders")}
            />

            <section className="dashboard-grid">
              <article className="panel chart-panel">
                <div className="panel-header">
                  <div>
                    <h3>Income vs. expenses</h3>
                    <p>Your monthly cash flow</p>
                  </div>
                  <select
                    className="period-select"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    aria-label="Chart period"
                  >
                    <option>This month</option>
                    <option>Last 7 months</option>
                  </select>
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

                <AreaChart data={monthlyData} />
              </article>

              <article className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <h3>Recent transactions</h3>
                    <p>Your latest money moves</p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActivePage("Transactions")}
                  >
                    View all →
                  </button>
                </div>

                <TransactionList
                  transactions={recentTransactions}
                  categories={categories}
                  onDelete={deleteTransaction}
                />
              </article>

              <article className="panel budget-panel">
                <div className="panel-header">
                  <div>
                    <h3>Budget overview</h3>
                    <p>Keep your spending on track</p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActivePage("Budgets")}
                  >
                    View budgets →
                  </button>
                </div>

                <BudgetList
  transactions={transactions}
  categories={categories}
  onSaveBudget={saveBudget}
/>
              </article>

              <article className="panel card-panel">
                <div className="panel-header">
                  <div>
                    <h3>Your money card</h3>
                    <p>A snapshot of your finances</p>
                  </div>
                  <span className="card-menu">•••</span>
                </div>

                <div className="bank-card">
                  <div className="card-decoration decoration-one" />
                  <div className="card-decoration decoration-two" />

                  <div className="bank-card-top">
                    <span className="mini-card-icon">◈</span>
                    <span>PENNYWISE</span>
                  </div>

                  <span className="card-balance-label">
                    Available balance
                  </span>
                  <strong>{money(totals.balance)}</strong>

                  <div className="bank-card-bottom">
                    <span>•••• &nbsp; •••• &nbsp; •••• &nbsp; 2376</span>
                    <span className="card-circles">
                      <i />
                      <i />
                    </span>
                  </div>
                </div>

                <div className="card-footnote">
                  <span className="online-dot" />
                  Demo card · Not a real bank account
                </div>
              </article>

              <CategoryDonutChart
                transactions={transactions}
                categories={categories}
              />

              <MonthlyBarChart data={monthlyData} />
            </section>

            <footer className="footer">
              <span>✧ Made for mindful money habits.</span>
              <span>PennyWise · Personal finance, simplified.</span>
            </footer>
          </>
        )}

        {activePage === "Transactions" && (
          <section className="panel page-panel">
            <div className="panel-header page-panel-header">
              <div>
                <h2>All transactions</h2>
                <p>Your income and expenses in one place.</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={exportTransactions}
              >
                ↓ Export CSV
              </button>
            </div>

            <TransactionList
              transactions={filteredTransactions}
              categories={categories}
              onDelete={deleteTransaction}
              showAll
            />
          </section>
        )}

        {activePage === "Budgets" && (
  <section className="panel page-panel">
    <div className="panel-header page-panel-header">
      <div>
        <h2>Your monthly budgets</h2>
        <p>Track spending against your category limits.</p>
      </div>
    </div>

    <BudgetList
      transactions={transactions}
      categories={categories}
      onSaveBudget={saveBudget}
    />
  </section>
)}

        {activePage === "Budget Alerts" && (
          <section className="panel page-panel">
            <div className="panel-header page-panel-header">
              <div>
                <h2>Smart budget alerts</h2>
                <p>
                  Automatic warnings at 75%, 90% and 100% of every category
                  budget.
                </p>
              </div>
            </div>

            <BudgetAlerts variant="full" transactions={transactions} />
          </section>
        )}

        {activePage === "Bill Reminders" && (
          <section className="panel page-panel">
            <div className="panel-header page-panel-header">
              <div>
                <h2>Bill reminders</h2>
                <p>
                  Track recurring bills, see what's due soon and never miss a
                  payment.
                </p>
              </div>
            </div>

            <BillReminders variant="full" />
          </section>
        )}

        {activePage === "Reports & insights" && (
          <section className="reports-grid">
            <article className="panel report-summary">
              <span className="stat-icon green">↗</span>
              <span className="stat-label">Income</span>
              <strong className="stat-value">
                {money(totals.income)}
              </strong>
              <p>Total recorded income.</p>
            </article>

            <article className="panel report-summary">
              <span className="stat-icon orange">↘</span>
              <span className="stat-label">Expenses</span>
              <strong className="stat-value">
                {money(totals.expense)}
              </strong>
              <p>Total recorded expenses.</p>
            </article>

            <article className="panel report-summary">
              <span className="stat-icon purple">✧</span>
              <span className="stat-label">Net balance</span>
              <strong className="stat-value">
                {money(totals.balance)}
              </strong>
              <p>Income minus expenses.</p>
            </article>

            <article className="panel chart-panel full-report">
              <div className="panel-header">
                <div>
                  <h3>Income vs. expenses</h3>
                  <p>Monthly trend chart</p>
                </div>
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

              <AreaChart data={monthlyData} />
            </article>

            <CategoryDonutChart
              transactions={transactions}
              categories={categories}
            />

            <MonthlyBarChart data={monthlyData} />

            <div className="panel page-panel">
              <div className="panel-header">
                <div>
                  <h3>Export your report</h3>
                  <p>Download your transactions as a CSV file.</p>
                </div>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={exportTransactions}
              >
                ↓ Export CSV
              </button>
            </div>
          </section>
        )}

        {activePage === "Recurring Transactions" && (
          <RecurringTransactions
            notify={notify}
            onSessionExpired={() => setUser(null)}
            onDataChanged={() => setRefreshToken((value) => value + 1)}
          />
        )}

        {activePage === "Savings Goals" && (
          <SavingsGoals
            notify={notify}
            onSessionExpired={() => setUser(null)}
            onDataChanged={() => setRefreshToken((value) => value + 1)}
          />
        )}
      </main>

      {showModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">YOUR MONEY, YOUR WAY</span>
                <h2 id="modal-title">Add a transaction</h2>
                <p>Keep track of where your money goes.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={addTransaction}>
              <label className="form-label">Transaction type</label>

              <div className="type-toggle">
                <button
                  type="button"
                  className={
                    form.type === "expense"
                      ? "selected expense-selected"
                      : ""
                  }
                  onClick={() => {
                    const category = categories.find(
                      (item) => !incomeCategories.includes(item.name)
                    );

                    setForm((current) => ({
                      ...current,
                      type: "expense",
                      categoryId: category?._id || "",
                    }));
                  }}
                >
                  ↘ Expense
                </button>

                <button
                  type="button"
                  className={
                    form.type === "income"
                      ? "selected income-selected"
                      : ""
                  }
                  onClick={() => {
                    const category = categories.find(
                      (item) => item.name === "Salary"
                    );

                    setForm((current) => ({
                      ...current,
                      type: "income",
                      categoryId: category?._id || "",
                    }));
                  }}
                >
                  ↗ Income
                </button>
              </div>

              <label className="form-label" htmlFor="transaction-amount">
                Amount (₹)
              </label>

              <input
                id="transaction-amount"
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
              />

              <label className="form-label" htmlFor="transaction-category">
                Category
              </label>

              <select
                id="transaction-category"
                className="form-input"
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select a category
                </option>

                {categories
                  .filter((category) =>
                    form.type === "income"
                      ? incomeCategories.includes(category.name) ||
                        category.name === "Other"
                      : !incomeCategories.includes(category.name)
                  )
                  .map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.icon || "📌"} {category.name}
                    </option>
                  ))}
              </select>

              <label className="form-label" htmlFor="transaction-date">
                Date
              </label>

              <input
                id="transaction-date"
                className="form-input"
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                required
              />

              <label className="form-label" htmlFor="transaction-payment">
                Payment method
              </label>

              <select
                id="transaction-payment"
                className="form-input"
                value={form.paymentMode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    paymentMode: event.target.value,
                  }))
                }
              >
                {paymentModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>

              <label className="form-label" htmlFor="transaction-notes">
                Notes <span className="optional-label">(optional)</span>
              </label>

              <textarea
                id="transaction-notes"
                className="form-input form-textarea"
                placeholder="Add any additional details..."
                rows="3"
                maxLength={300}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />

              <button
                className="primary-button modal-submit"
                type="submit"
                disabled={dataLoading}
              >
                Save transaction <span>→</span>
              </button>

              <p className="modal-footnote">
                Your transaction will be saved to your account.
              </p>
            </form>
          </section>
        </div>
      )}

            {toast && <div className="toast-message">{toast}</div>}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
  );
}

export default App;