/* ===== DATA ===== */
const CATEGORIES = ['Income', 'Groceries', 'Rent', 'Entertainment', 'Transport', 'Utilities', 'Miscellaneous']

const DEFAULT_TX = []
const DEFAULT_BUDGETS = []

/* clear prior leftover mock data so app starts clean */
if (!localStorage.getItem('cc_clean')) {
  localStorage.removeItem('cc_tx')
  localStorage.removeItem('cc_budgets')
  localStorage.setItem('cc_clean', '1')
}

/* ===== STATE ===== */
let transactions = load('cc_tx', DEFAULT_TX)
let budgets = load('cc_budgets', DEFAULT_BUDGETS)
let editingId = null
let editingBudgetCategory = null
let dashDonut = null
let pieChart = null
let lineChart = null

/* ===== UTILITY ===== */
function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function persist(key, data) { localStorage.setItem(key, JSON.stringify(data)) }
function persistAll() { persist('cc_tx', transactions); persist('cc_budgets', budgets) }

function fmt(n) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const [int, dec] = abs.toFixed(2).split('.')
  return sign + '₹' + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec
}
function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function monthLabel(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
function computeActual(cat) {
  return transactions.filter(t => t.category === cat && t.type === 'outflow').reduce((s, t) => s + t.amount, 0)
}
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function isInPeriod(dateStr, period) {
  if (period === 'all') return true
  return dateStr >= daysAgo(parseInt(period))
}

/* ===== ROUTING ===== */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'))
  const el = document.getElementById('page-' + page)
  const link = document.querySelector(`.nav-link[data-page="${page}"]`)
  if (el) el.classList.add('active')
  if (link) link.classList.add('active')
  if (page === 'dashboard') renderDashboard()
  if (page === 'transactions') renderTransactions()
  if (page === 'budgets') renderBudgets()
  if (page === 'reports') renderCharts()
}
document.querySelectorAll('.nav-link').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); closeSidebar() })
})

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebar-overlay').classList.remove('open')
}
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open')
  document.getElementById('sidebar-overlay').classList.toggle('open')
})
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar)

/* ===== DASHBOARD ===== */
function renderDashboard() {
  const q = document.getElementById('global-search').value.toLowerCase().trim()
  let filtered = transactions
  if (q) {
    filtered = transactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.date.includes(q)
    )
  }
  const inflow = filtered.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0)
  const outflow = filtered.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0)
  const balance = inflow - outflow
  document.getElementById('stat-income').textContent = fmt(inflow)
  document.getElementById('stat-expenses').textContent = fmt(outflow)
  document.getElementById('stat-balance').textContent = fmt(balance)
  document.getElementById('stat-balance').className = 'stat-value' + (balance < 0 ? ' text-danger' : '')

  /* MoM Growth */
  const monthMap = {}
  transactions.forEach(t => {
    const m = t.date.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = { inflow: 0, outflow: 0 }
    monthMap[m][t.type] += t.amount
  })
  const months = Object.keys(monthMap).sort()
  let growth = 0
  if (months.length >= 2) {
    const cur = monthMap[months[months.length - 1]]
    const prev = monthMap[months[months.length - 2]]
    const curBal = (cur.inflow || 0) - (cur.outflow || 0)
    const prevBal = (prev.inflow || 0) - (prev.outflow || 0)
    growth = prevBal !== 0 ? ((curBal - prevBal) / Math.abs(prevBal)) * 100 : 0
  }
  const growthEl = document.getElementById('stat-growth')
  growthEl.textContent = (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%'
  growthEl.className = 'stat-value ' + (growth >= 0 ? 'text-success' : 'text-danger')

  /* Recent Activity */
  const recent = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  document.querySelector('#dash-tx-table tbody').innerHTML = recent.length
    ? recent.map(t => `<tr>
        <td class="tabular">${t.date}</td>
        <td class="truncate">${esc(t.description)}</td>
        <td><span class="badge ${t.type === 'inflow' ? 'badge-green' : 'badge-gray'}">${t.category}</span></td>
        <td class="text-right tabular font-medium ${t.type === 'inflow' ? 'text-success' : ''}">${t.type === 'inflow' ? fmt(t.amount) : fmt(-t.amount)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="text-center empty-state">No transactions yet</td></tr>'

  /* Donut Chart */
  const catMap = {}
  filtered.filter(t => t.type === 'outflow').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount })
  const catData = Object.entries(catMap).map(([n, v]) => ({ name: n, value: Math.round(v * 100) / 100 }))
  const colors = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
  if (dashDonut) dashDonut.destroy()
  const ctx = document.getElementById('dash-donut')
  if (ctx) {
    dashDonut = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: catData.map(d => d.name),
        datasets: [{ data: catData.map(d => d.value), backgroundColor: colors.slice(0, catData.length), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { family: 'Inter', size: 11 } } } }
      }
    })
  }
}

/* ===== TRANSACTIONS ===== */
function renderTransactions() {
  const period = document.getElementById('filter-period').value
  const type = document.getElementById('filter-type').value
  const cat = document.getElementById('filter-category').value
  const status = document.getElementById('filter-status').value
  const q = document.getElementById('global-search').value.toLowerCase().trim()

  let list = [...transactions]
  if (period !== 'all') list = list.filter(t => isInPeriod(t.date, period))
  if (type !== 'all') list = list.filter(t => t.type === type)
  if (cat !== 'all') list = list.filter(t => t.category === cat)
  if (status !== 'all') list = list.filter(t => t.status === status)
  if (q) list = list.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.date.includes(q))
  list.sort((a, b) => b.date.localeCompare(a.date))

  const tbody = document.querySelector('#tx-table tbody')
  tbody.innerHTML = list.length
    ? list.map(t => `<tr>
        <td class="tabular">${fmtDate(t.date)}</td>
        <td class="truncate">${esc(t.description)}</td>
        <td><span class="badge ${t.type === 'inflow' ? 'badge-green' : 'badge-gray'}">${t.category}</span></td>
        <td><span class="badge ${t.type === 'inflow' ? 'badge-green' : 'badge-red'}">${t.type === 'inflow' ? 'Income' : 'Expenses'}</span></td>
        <td><span class="badge ${t.status === 'Completed' ? 'badge-green' : 'badge-amber'}">${t.status}</span></td>
        <td class="text-right tabular font-medium ${t.type === 'inflow' ? 'text-success' : ''}">${t.type === 'inflow' ? fmt(t.amount) : fmt(-t.amount)}</td>
        <td class="text-right">
          <button class="btn btn-ghost btn-sm" onclick="editTx('${t.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="deleteTx('${t.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="text-center empty-state">No transactions found</td></tr>'
}

document.getElementById('filter-period').addEventListener('change', renderTransactions)
document.getElementById('filter-type').addEventListener('change', renderTransactions)
document.getElementById('filter-category').addEventListener('change', renderTransactions)
document.getElementById('filter-status').addEventListener('change', renderTransactions)
document.getElementById('global-search').addEventListener('input', () => {
  const page = document.querySelector('.page.active')
  if (page) {
    if (page.id === 'page-transactions') renderTransactions()
    if (page.id === 'page-dashboard') renderDashboard()
  }
})

function populateCategorySelect(sel) {
  const sorted = [...CATEGORIES].sort((a, b) => a === 'Income' ? 1 : b === 'Income' ? -1 : 0)
  sel.innerHTML = sorted.map(c => `<option value="${c}">${c}</option>`).join('')
}
document.getElementById('filter-category').innerHTML = '<option value="all">All Categories</option>' + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')
document.getElementById('budget-category').innerHTML = CATEGORIES.filter(c => c !== 'Income').map(c => `<option value="${c}">${c}</option>`).join('')

/* ===== MODAL ===== */
function openModal(title, data, mode) {
  const txForm = document.getElementById('tx-form')
  const bgtForm = document.getElementById('budget-form')
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-overlay').style.display = 'flex'

  if (mode === 'budget') {
    txForm.style.display = 'none'
    bgtForm.style.display = 'block'
    bgtForm.reset()
    document.getElementById('budget-error').style.display = 'none'
    document.getElementById('budget-category').value = data?.category || ''
    document.getElementById('budget-amount').value = data?.allocated?.toString() || ''
    editingBudgetCategory = data?.category || null
    return
  }

  txForm.style.display = 'block'
  bgtForm.style.display = 'none'
  document.getElementById('tx-error').style.display = 'none'
  txForm.reset()
  document.getElementById('tx-date').value = data?.date || new Date().toISOString().slice(0, 10)
  document.getElementById('tx-desc').value = data?.description || ''
  populateCategorySelect(document.getElementById('tx-category'))
  if (data?.category) document.getElementById('tx-category').value = data.category
  document.getElementById('tx-type').value = data?.type || 'outflow'
  document.getElementById('tx-type').dispatchEvent(new Event('change'))
  document.getElementById('tx-amount').value = data?.amount?.toString() || ''
  document.getElementById('tx-status').value = data?.status || 'Completed'
  document.getElementById('modal-submit-btn').textContent = data ? 'Update Transaction' : 'Add Transaction'
  editingId = data?.id || null
  editingBudgetCategory = null
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none'
  editingId = null
  editingBudgetCategory = null
}
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal() })
document.getElementById('modal-close-btn').addEventListener('click', closeModal)
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal)
document.getElementById('modal-cancel-btn2').addEventListener('click', closeModal)

document.getElementById('add-tx-btn').addEventListener('click', () => openModal('Add Transaction'))
document.getElementById('tx-type').addEventListener('change', function() {
  const cat = document.getElementById('tx-category')
  if (this.value === 'inflow') {
    cat.innerHTML = '<option value="Income">Income</option>'
    cat.value = 'Income'
  } else {
    const expenseCats = CATEGORIES.filter(c => c !== 'Income')
    cat.innerHTML = expenseCats.map(c => `<option value="${c}">${c}</option>`).join('')
    if (cat.value === 'Income' || !cat.value) cat.value = 'Miscellaneous'
  }
})
window.editTx = function(id) {
  const t = transactions.find(x => x.id === id)
  if (t) openModal('Edit Transaction', t)
}
window.deleteTx = function(id) {
  if (!confirm('Delete this transaction?')) return
  transactions = transactions.filter(t => t.id !== id)
  persistAll(); renderTransactions(); renderDashboard(); renderBudgets()
}

document.getElementById('tx-form').addEventListener('submit', e => {
  e.preventDefault()
  const err = document.getElementById('tx-error')
  const desc = document.getElementById('tx-desc').value.trim()
  const amount = parseFloat(document.getElementById('tx-amount').value)
  if (!desc) { err.textContent = 'Description is required'; err.style.display = 'block'; return }
  if (!amount || amount <= 0) { err.textContent = 'Amount must be greater than 0'; err.style.display = 'block'; return }
  err.style.display = 'none'
  const data = {
    date: document.getElementById('tx-date').value,
    description: desc,
    category: document.getElementById('tx-category').value,
    type: document.getElementById('tx-type').value,
    status: document.getElementById('tx-status').value,
    amount: Math.round(amount * 100) / 100,
  }
  if (editingId) {
    transactions = transactions.map(t => t.id === editingId ? { ...t, ...data } : t)
  } else {
    transactions = [{ id: crypto.randomUUID(), ...data }, ...transactions]
  }
  persistAll()
  closeModal()
  renderTransactions()
  renderDashboard()
  renderBudgets()
  if (document.querySelector('.page.active')?.id === 'page-reports') renderCharts()
})

/* ===== BUDGET FORM ===== */
document.getElementById('budget-form').addEventListener('submit', e => {
  e.preventDefault()
  const err = document.getElementById('budget-error')
  const amt = parseFloat(document.getElementById('budget-amount').value)
  const cat = document.getElementById('budget-category').value
  if (isNaN(amt) || amt < 0) { err.textContent = 'Enter a valid amount'; err.style.display = 'block'; return }
  err.style.display = 'none'
  const val = Math.round(amt * 100) / 100
  const existing = budgets.find(x => x.category === cat)
  if (existing) {
    budgets = budgets.map(x => x.category === cat ? { ...x, allocated: val } : x)
  } else {
    budgets.push({ category: cat, allocated: val })
  }
  persistAll()
  closeModal()
  renderBudgets()
  renderDashboard()
})

/* ===== CSV EXPORT ===== */
document.getElementById('export-csv-btn').addEventListener('click', () => {
  const period = document.getElementById('filter-period').value
  let list = [...transactions]
  if (period !== 'all') list = list.filter(t => isInPeriod(t.date, period))
  list.sort((a, b) => b.date.localeCompare(a.date))
  const header = 'Date,Description,Category,Type,Status,Amount\n'
  const typeLabel = t => t.type === 'inflow' ? 'Income' : 'Expenses'
  const rows = list.map(t => `"${t.date}","${t.description}","${t.category}","${typeLabel(t)}","${t.status}",${t.type === 'inflow' ? t.amount : -t.amount}`).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'capitalcontrol_export.csv'; a.click()
  URL.revokeObjectURL(url)
})

/* ===== BUDGETS ===== */
function renderBudgets() {
  const cats = CATEGORIES.filter(c => c !== 'Income')

  const totalBudgeted = cats.reduce((s, cat) => s + ((budgets.find(b => b.category === cat) || { allocated: 0 }).allocated), 0)
  const totalSpent = cats.reduce((s, cat) => s + computeActual(cat), 0)
  const totalRemaining = totalBudgeted - totalSpent
  document.getElementById('budget-total-budgeted').textContent = fmt(totalBudgeted)
  document.getElementById('budget-total-spent').textContent = fmt(totalSpent)
  document.getElementById('budget-total-remaining').textContent = fmt(totalRemaining)
  document.getElementById('budget-total-remaining').className = 'stat-value ' + (totalRemaining >= 0 ? 'text-success' : 'text-danger')

  /* Month-end forecast: estimate surplus based on current daily spend rate */
  const now = new Date()
  const startOfMonth = now.toISOString().slice(0, 7) + '-01'
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const monthlyInflow = transactions.filter(t => t.type === 'inflow' && t.date >= startOfMonth).reduce((s, t) => s + t.amount, 0)
  const monthlyOutflow = transactions.filter(t => t.type === 'outflow' && t.date >= startOfMonth).reduce((s, t) => s + t.amount, 0)
  const dailyRate = dayOfMonth > 0 ? monthlyOutflow / dayOfMonth : 0
  const projectedOutflow = dailyRate * daysInMonth
  const surplus = monthlyInflow - projectedOutflow - (totalBudgeted - totalSpent)
  // surplus represents: current month inflow - projected full-month outflow - remaining budget = excess
  // simpler: projected end-of-month cash position vs total budget
  const forecast = monthlyInflow - projectedOutflow
  document.getElementById('budget-forecast').textContent = fmt(forecast)
  document.getElementById('budget-forecast').className = 'stat-value ' + (forecast >= 0 ? 'text-success' : 'text-danger')

  document.getElementById('budget-grid').innerHTML = cats.map(cat => {
    const b = budgets.find(x => x.category === cat) || { allocated: 0 }
    const actual = computeActual(cat)
    const pct = b.allocated > 0 ? Math.min((actual / b.allocated) * 100, 100) : 0
    const rem = b.allocated - actual
    const color = rem < 0 ? 'bg-danger' : rem < b.allocated * 0.15 && b.allocated > 0 ? 'bg-warning' : 'bg-success'
    const overPct = b.allocated > 0 && rem < 0 ? ((Math.abs(rem) / b.allocated) * 100).toFixed(0) : 0
    const warningLabel = overPct > 0 ? `Over-budget by ${overPct}%` : ''
    const label = rem >= 0 ? `${fmt(rem)} left` : `${fmt(Math.abs(rem))} over`
    const labelColor = rem < 0 ? 'text-danger' : rem < b.allocated * 0.15 && b.allocated > 0 ? 'text-warning' : 'text-success'
    return `<div class="card budget-card">
      <div class="card-body">
        <div class="budget-header">
          <h3>${cat}</h3>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="editBudget('${cat}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${b.allocated > 0 ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="deleteBudget('${cat}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>` : ''}
          </div>
        </div>
        <div class="budget-numbers">
          <div><p>Budgeted</p><p>${fmt(b.allocated)}</p></div>
          <div style="text-align:right"><p>Spent</p><p>${fmt(actual)}</p></div>
        </div>
        <div class="progress-bar"><div class="progress-fill ${color}" style="width:${pct}%"></div></div>
        <div class="budget-footer">
          <span>${pct.toFixed(1)}% used</span>
          <span class="${labelColor}" style="font-weight:500">${warningLabel || label}</span>
        </div>
        ${warningLabel ? `<div style="margin-top:8px;padding:6px 10px;border-radius:6px;background:#fef2f2;color:#dc2626;font-size:0.75rem;font-weight:500;text-align:center">${warningLabel} — consider adjusting this limit</div>` : ''}
      </div>
    </div>`
  }).join('')
}
window.editBudget = function(cat) {
  const b = budgets.find(x => x.category === cat) || { category: cat, allocated: 0 }
  openModal('Edit Budget', b, 'budget')
}
window.deleteBudget = function(cat) {
  if (!confirm(`Remove budget for ${cat}?`)) return
  budgets = budgets.filter(x => x.category !== cat)
  persistAll(); renderBudgets(); renderDashboard()
}

/* ===== REPORTS ===== */
function renderCharts() {
  const inflow = transactions.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0)
  const outflow = transactions.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0)
  const balance = inflow - outflow
  const savingsRate = inflow > 0 ? ((inflow - outflow) / inflow) * 100 : 0
  const margin = outflow > 0 ? ((inflow - outflow) / outflow) * 100 : (inflow > 0 ? 100 : 0)
  document.getElementById('rpt-count').textContent = transactions.length
  document.getElementById('rpt-savings-rate').textContent = savingsRate.toFixed(1) + '%'
  document.getElementById('rpt-savings-rate').className = 'stat-value ' + (savingsRate >= 0 ? 'text-success' : 'text-danger')
  document.getElementById('rpt-cash-hand').textContent = fmt(balance)
  document.getElementById('rpt-cash-hand').className = 'stat-value ' + (balance >= 0 ? 'text-success' : 'text-danger')
  document.getElementById('rpt-margin').textContent = margin.toFixed(1) + '%'
  document.getElementById('rpt-margin').className = 'stat-value ' + (margin >= 0 ? 'text-success' : 'text-danger')

  const catMap = {}
  transactions.filter(t => t.type === 'outflow').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount })
  const catData = Object.entries(catMap).map(([n, v]) => ({ name: n, value: Math.round(v * 100) / 100 }))

  const monthMap = {}
  transactions.forEach(t => {
    const m = monthLabel(t.date)
    if (!monthMap[m]) monthMap[m] = { month: m, inflow: 0, outflow: 0 }
    monthMap[m][t.type] += t.amount
  })
  const monthData = Object.values(monthMap).map(m => ({ ...m, inflow: Math.round(m.inflow * 100) / 100, outflow: Math.round(m.outflow * 100) / 100 }))

  const colors = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']

  if (pieChart) pieChart.destroy()
  if (lineChart) lineChart.destroy()

  const pieCtx = document.getElementById('pie-chart').getContext('2d')
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: catData.map(d => d.name),
      datasets: [{ data: catData.map(d => d.value), backgroundColor: colors.slice(0, catData.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { family: 'Inter', size: 12 } } }
      }
    }
  })

  const lineCtx = document.getElementById('line-chart').getContext('2d')
  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: monthData.map(d => d.month),
      datasets: [
        {
          label: 'Income',
          data: monthData.map(d => d.inflow),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#22c55e',
        },
        {
          label: 'Expenses',
          data: monthData.map(d => d.outflow),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#ef4444',
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
        y: { ticks: { font: { family: 'Inter' }, callback: v => '₹' + v } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { family: 'Inter', size: 12 } } }
      }
    }
  })
}

/* ===== HELPERS ===== */
function esc(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML
}

/* ===== INIT ===== */
function init() {
  persistAll()
  renderDashboard()
  renderTransactions()
  renderBudgets()
}
init()
