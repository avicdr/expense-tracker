// Simple Expense Tracker
const STORAGE_KEY = 'expense-tracker:txns:v1';
let txns = [];
const txnForm = document.getElementById('txnForm');
const txnList = document.getElementById('txnList');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const netEl = document.getElementById('net');
const errorEl = document.getElementById('error');
const filterCat = document.getElementById('filterCat');
const pieCtx = document.getElementById('pieChart').getContext('2d');
let pieChart = null;

// Color palette for chart
const CHART_COLORS = {
  red: 'rgb(255, 99, 132)',
  orange: 'rgb(255, 159, 64)',
  yellow: 'rgb(255, 205, 86)',
  green: 'rgb(75, 192, 192)',
  blue: 'rgb(54, 162, 235)',
  purple: 'rgb(153, 102, 255)',
  grey: 'rgb(201, 203, 207)'
};
const categoryColorMap = {
  'Food': CHART_COLORS.red, 'Transport': CHART_COLORS.blue,
  'Entertainment': CHART_COLORS.yellow, 'Shopping': CHART_COLORS.green,
  'Bills': CHART_COLORS.orange, 'Salary': CHART_COLORS.purple,
  'Other': CHART_COLORS.grey
};

// initialize
function load() {
  try {
    txns = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) { txns = [] }
  renderFilterOptions();
  render();
}

function save() {
  if (txns.length > 500) txns = txns.slice(0, 500);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
  } catch (e) {
    alert("Storage limit exceeded! Please export or clear old transactions.");
  }
}


function uid() { return Math.random().toString(36).slice(2, 9) }

function validate(form) {
  const date = form.date.value;
  const desc = form.desc.value.trim();
  const amt = parseFloat(form.amount.value);
  if (!date) return 'Please choose a date.';
  if (!desc) return 'Please add a short description.';
  if (!form.amount.value) return 'Please enter an amount.';
  if (isNaN(amt) || amt <= 0) return 'Amount must be a positive number.';
  return null;
}

txnForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const err = validate(form);
  if (err) { showError(err); return }
  const data = new FormData(form);
  const type = data.get('type');
  const newTxn = {
    id: uid(),
    type,
    date: form.date.value,
    desc: form.desc.value.trim(),
    category: form.category.value,
    amount: Math.abs(parseFloat(form.amount.value)).toFixed(2)
  };
  txns.unshift(newTxn);
  save();
  form.reset();
  // default back to expense
  form.type[0].checked = true;
  hideError();
  renderFilterOptions();
  render();
});

function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
function hideError() { errorEl.style.display = 'none'; }

function formatCurrency(n) {
  // simple INR formatting
  const num = Number(n);
  return '₹' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render() {
  // apply filter
  const sel = filterCat.value || 'all';
  const filtered = sel === 'all' ? txns : txns.filter(t => t.category === sel);

  txnList.innerHTML = '';
  if (filtered.length === 0) { txnList.innerHTML = '<p style="color:var(--muted)">No transactions yet.</p>' }

  let totalIncome = 0; let totalExpense = 0;
  for (const t of filtered) {
    const el = document.createElement('div'); el.className = 'txn';
    const left = document.createElement('div'); left.className = 'left';
    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = t.category;
    const desc = document.createElement('div'); desc.className = 'desc'; desc.innerHTML = `<div style="font-weight:600">${escapeHtml(t.desc)}</div><div style='font-size:12px;color:var(--muted)'>${t.date}</div>`;
    left.appendChild(badge); left.appendChild(desc);

    const right = document.createElement('div'); right.style.display = 'flex'; right.style.alignItems = 'center'; right.style.gap = '12px';
    const amt = document.createElement('div'); amt.className = 'amount ' + (t.type === 'income' ? 'income' : 'expense'); amt.textContent = (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount);
    const actions = document.createElement('div'); actions.className = 'actions';
    const editBtn = document.createElement('button'); editBtn.className = 'btn small'; editBtn.textContent = 'Edit';
    const delBtn = document.createElement('button'); delBtn.className = 'btn small'; delBtn.textContent = 'Delete';
    editBtn.onclick = () => openEdit(t.id);
    delBtn.onclick = () => { if (confirm('Delete this transaction?')) { deleteTxn(t.id); } };
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    right.appendChild(amt); right.appendChild(actions);

    el.appendChild(left); el.appendChild(right);
    txnList.appendChild(el);

    if (t.type === 'income') totalIncome += Number(t.amount); else totalExpense += Number(t.amount);
  }

  totalIncomeEl.textContent = formatCurrency(totalIncome);
  totalExpenseEl.textContent = formatCurrency(totalExpense);
  netEl.textContent = formatCurrency(totalIncome - totalExpense);

  renderChart();
}

function deleteTxn(id) { txns = txns.filter(t => t.id !== id); save(); renderFilterOptions(); render(); }

function openEdit(id) {
  const t = txns.find(x => x.id === id); if (!t) return;
  // populate form with values for quick edit
  txnForm.date.value = t.date;
  txnForm.desc.value = t.desc;
  txnForm.category.value = t.category;
  txnForm.amount.value = t.amount;
  if (t.type === 'income') txnForm.type[1].checked = true; else txnForm.type[0].checked = true;
  // remove the original and let user re-add as updated
  txns = txns.filter(x => x.id !== id); save(); render();
}

function renderFilterOptions() {
  const cats = Array.from(new Set(txns.map(t => t.category)));
  // keep default options
  const existing = Array.from(filterCat.options).map(o => o.value);
  filterCat.innerHTML = '<option value="all">All categories</option>';
  const defaultCats = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Salary', 'Other'];
  const merged = Array.from(new Set([...defaultCats, ...cats]));
  for (const c of merged) {
    const o = document.createElement('option'); o.value = c; o.textContent = c; filterCat.appendChild(o);
  }
}

// Chart
function renderChart() {
  // only consider expenses
  const expenses = txns.filter(t => t.type === 'expense');
  const grouped = {};
  for (const e of expenses) { grouped[e.category] = (grouped[e.category] || 0) + Number(e.amount); }
  const labels = Object.keys(grouped);
  const data = Object.values(grouped).map(v => Number(v.toFixed(2)));
  if (pieChart) pieChart.destroy();

  const chartColors = labels.map(label => categoryColorMap[label] || CHART_COLORS.grey);
  // Get computed styles for colors because Chart.js canvas can't read CSS variables directly
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  const cardColor = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();

  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: chartColors,
        borderColor: cardColor,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: mutedColor, padding: 15, font: { size: 13 } } } }
    }
  });
}

// utils
function escapeHtml(str) { return str.replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

// export/import
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(txns, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'transactions.json'; a.click(); URL.revokeObjectURL(url);
});
document.getElementById('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader(); reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result); if (!Array.isArray(imported)) throw new Error('Invalid file');
      // simple merge: assign new ids to imported items to avoid conflicts
      const cleaned = imported.map(i => ({ id: uid(), type: i.type || 'expense', date: i.date || new Date().toISOString().slice(0, 10), desc: i.desc || 'Imported', category: i.category || 'Other', amount: Math.abs(Number(i.amount) || 0).toFixed(2) }));
      txns = cleaned.concat(txns);
      save(); renderFilterOptions(); render(); alert('Imported ' + cleaned.length + ' transactions.');
    } catch (err) { alert('Could not import: ' + err.message) }
  }; reader.readAsText(f);
  e.target.value = '';
});

// clear all
document.getElementById('clearAll').addEventListener('click', () => {
  if (confirm('Clear all transactions?')) { txns = []; save(); renderFilterOptions(); render(); }
});

// sample data and toggle
document.getElementById('addSample').addEventListener('click', () => {
  const sample = [
    { id: uid(), type: 'income', date: '2025-08-01', desc: 'Salary', category: 'Salary', amount: '50000.00' },
    { id: uid(), type: 'expense', date: '2025-08-02', desc: 'Groceries', category: 'Food', amount: '1200.00' },
    { id: uid(), type: 'expense', date: '2025-08-03', desc: 'Movie', category: 'Entertainment', amount: '350.00' },
    { id: uid(), type: 'expense', date: '2025-08-04', desc: 'Bus pass', category: 'Transport', amount: '300.00' },
  ];
  txns = sample.concat(txns); save(); renderFilterOptions(); render();
});
document.getElementById('toggleChart').addEventListener('click', () => {
  const canvas = document.getElementById('pieChart'); canvas.parentElement.style.display = canvas.parentElement.style.display === 'none' ? 'block' : 'none';
});

// filter change
filterCat.addEventListener('change', render);

// initialize date default to today
document.getElementById('date').value = new Date().toISOString().slice(0, 10);

load();