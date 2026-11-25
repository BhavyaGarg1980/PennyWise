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