# CapitalControl

A high-fidelity expense tracking and financial management web application designed for professional-grade fiscal precision.

## Features

- **Dashboard** — Real-time overview with total income/expenses, current balance, month-over-month growth, spending breakdown donut chart, and recent activity
- **Transactions** — Full CRUD ledger with advanced filtering (time period, type, category, status), global search, and CSV export
- **Budget Planner** — Category-wise budget tracking with progress bars, over-budget percentage alerts, total summary stats, and estimated month-end surplus forecasting
- **Reports & Analytics** — Savings rate, cash at hand, operating margin, expense category breakdown (donut), and 6-month cash flow trends (line chart)
- **Responsive Design** — Fixed sidebar on desktop, collapsible drawer on mobile/tablet

## Tech Stack

- HTML5
- CSS3 (vanilla, no frameworks)
- JavaScript (vanilla ES6+)
- [Chart.js](https://www.chartjs.org/) for data visualization
- [Inter](https://rsms.me/inter/) font family
- localStorage for data persistence

## Getting Started

1. Clone or download the project
2. Open `index.html` in any modern browser — no build step or server required

Or serve locally for best experience:

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

## Usage

### Adding Data
- **Transactions**: Navigate to **Transactions** → click **Add Transaction** → fill in date, description, category, type (Income/Expenses), amount, and status
- **Budgets**: Navigate to **Budgets** → click the pencil icon on any category card → set the monthly budget amount

### Searching & Filtering
- Use the global search bar in the top bar to filter transactions across description, category, and date
- On the Transactions page, use dropdown filters for time period, type, category, and status

### Exporting
- On the Transactions page, click **Export CSV** to download the currently filtered transaction list

## Design System

| Token | Value |
|-------|-------|
| Body Background | `#f8fafc` |
| Surface / Cards | `#ffffff` |
| Primary Text | `#0f172a` |
| Borders | `#e2e8f0` |
| Success / Inflow | `#22c55e` |
| Danger / Outflow | `#ef4444` |
| Warning | `#f59e0b` |
| Font | Inter (sans-serif) |

Numerical values use `font-variant-numeric: tabular-nums` for precise digit alignment.

## Project Structure

```
index.html      — All markup (sidebar, topbar, pages, modal)
styles.css      — Full design system and layout
app.js          — Application logic, state management, charts
```

## License

MIT
