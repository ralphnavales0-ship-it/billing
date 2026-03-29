/* ================================================================
   San Alfonso Homes — HOA Billing & Payment System
   script.js | All Application Logic

   TABLE OF CONTENTS
   -----------------
    1.  App State           — global variables
    2.  Data / Defaults     — default accounts & billing records
    3.  LocalStorage        — LS(), LSset(), getAccounts(), getBills(), saveBills()
    4.  Page Navigation     — showPage, showDashTab, showAdminTab, goToDashboard
    5.  Modal System        — openModal, closeModal, backdrop/ESC listeners
    6.  Authentication      — doLogin, doAdminLogin, doLogout
    7.  Resident Dashboard  — renderOverviewBills, renderMyBills, renderHistory, getBadge
    8.  Billing Filter      — filterBills
    9.  Payment Flow        — startPayment, viewReceipt, selectMethod, processPayment
   10.  Admin — Residents   — saveResident, deleteResident, searchResidents
   11.  Admin — Billing     — saveBilling, openEditBilling, saveEditBilling, deleteEditRow
   12.  Admin — Payments    — verifyPayment, confirmVerify, renderAdminRecentPayments
   13.  Admin — Dropdown    — populateBillingDropdown
   14.  Admin — Announcements — publishAnnouncement, deleteAnn
   15.  Utilities           — toggleSidebar, showToast
   16.  Initialization      — DOMContentLoaded
   ================================================================ */


/* ================================================================
   1. APP STATE
   ================================================================ */

var loggedIn              = false;   /* true when any user is logged in       */
var isAdmin               = false;   /* true when the logged-in user is admin */
var curUser               = null;    /* current resident account object       */
var rcpCounter            = 2504;    /* auto-incrementing receipt number      */
var pendingBillForPayment = null;    /* billing item being paid               */


/* ================================================================
   2. DATA / DEFAULTS
   ================================================================ */

var DEFAULT_ACCOUNTS = [
  { username:'juan',  password:'juan123',  name:'Juan Dela Cruz', unit:'Block 3, Unit 12', email:'juan@email.com',  phone:'0917-XXX-1234' },
  { username:'maria', password:'maria123', name:'Maria Santos',   unit:'Block 1, Unit 05', email:'maria@email.com', phone:'0918-XXX-5678' },
  { username:'pedro', password:'pedro123', name:'Pedro Reyes',    unit:'Block 2, Unit 08', email:'pedro@email.com', phone:'0919-XXX-9012' },
  { username:'ana',   password:'ana123',   name:'Ana Gonzales',   unit:'Block 4, Unit 02', email:'ana@email.com',   phone:'0920-XXX-3456' }
];

var DEFAULT_BILLS = {
  juan: [
    { period:'March 2025',    desc:'Monthly HOA Dues', amount:1500, dueDate:'March 31, 2025', status:'unpaid'  },
    { period:'February 2025', desc:'Monthly HOA Dues', amount:1500, dueDate:'Feb 28, 2025',   status:'paid'    },
    { period:'January 2025',  desc:'Monthly HOA Dues', amount:1500, dueDate:'Jan 31, 2025',   status:'paid'    },
    { period:'October 2024',  desc:'Monthly HOA Dues', amount:1650, dueDate:'Oct 31, 2024',   status:'overdue' }
  ],
  maria: [
    { period:'March 2025',    desc:'Monthly HOA Dues', amount:1500, dueDate:'March 31, 2025', status:'paid' },
    { period:'February 2025', desc:'Monthly HOA Dues', amount:1500, dueDate:'Feb 28, 2025',   status:'paid' }
  ],
  pedro: [
    { period:'March 2025',    desc:'Monthly HOA Dues', amount:1500, dueDate:'March 31, 2025', status:'paid' },
    { period:'February 2025', desc:'Monthly HOA Dues', amount:1500, dueDate:'Feb 28, 2025',   status:'paid' }
  ],
  ana: [
    { period:'March 2025',    desc:'Monthly HOA Dues', amount:1500, dueDate:'March 31, 2025', status:'unpaid' },
    { period:'February 2025', desc:'Monthly HOA Dues', amount:1500, dueDate:'Feb 28, 2025',   status:'paid'   }
  ]
};

var MONTHS_LONG  = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];


/* ================================================================
   3. LOCALSTORAGE HELPERS
   ================================================================ */

function LS(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

function LSset(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage write failed:', e); }
}

/* Returns all resident accounts; seeds defaults on first run */
function getAccounts() {
  var saved = LS('sah_accounts', null);
  if (!saved) { LSset('sah_accounts', DEFAULT_ACCOUNTS); return DEFAULT_ACCOUNTS.slice(); }
  return saved;
}

/* Returns billing records for a resident username */
function getBills(username) {
  var all = LS('sah_bills', {});
  return all[username] || DEFAULT_BILLS[username] || [];
}

/* Saves billing records for a resident username */
function saveBillsForUser(username, bills) {
  var all = LS('sah_bills', {});
  all[username] = bills;
  LSset('sah_bills', all);
}


/* ================================================================
   4. PAGE NAVIGATION
   ================================================================ */

function showPage(id) {
  // Prevent logged-in users from being sent back to login prompt pages
  if (id === 'billing') {
    if (isAdmin) {
      showPage('admin');
      showAdminTab('billing');
      return;
    }
    if (loggedIn) {
      showPage('dashboard');
      showDashTab('mybills');
      return;
    }
  }

  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-links a').forEach(function(a) { a.classList.remove('active'); });
  var pg = document.getElementById('page-' + id); if (pg) pg.classList.add('active');
  var nl = document.getElementById('nav-'  + id); if (nl) nl.classList.add('active');
  window.scrollTo(0, 0);
  var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
}

function showDashTab(id) {
  document.querySelectorAll('#page-dashboard .sb-nav a').forEach(function(a) { a.classList.remove('active'); });
  var el = document.getElementById('dt-'   + id); if (el) el.classList.add('active');
  document.querySelectorAll('#page-dashboard .tab-c').forEach(function(t) { t.classList.remove('active'); });
  var ct = document.getElementById('dtc-' + id); if (ct) ct.classList.add('active');
  if (id === 'mybills') renderMyBills();
  if (id === 'history') renderHistory();
}

function showAdminTab(id) {
  document.querySelectorAll('#page-admin .sb-nav a').forEach(function(a) { a.classList.remove('active'); });
  var el = document.getElementById('at-'  + id); if (el) el.classList.add('active');
  document.querySelectorAll('#page-admin .tab-c').forEach(function(t) { t.classList.remove('active'); });
  var ct = document.getElementById('atc-' + id); if (ct) ct.classList.add('active');
}

function goToDashboard() {
  if (isAdmin) { showPage('admin');     showAdminTab('overview'); }
  else         { showPage('dashboard'); showDashTab('overview');  }
}

function setBillingLinkVisibility(visible) {
  var billLink = document.getElementById('nav-billing');
  if (!billLink) return;
  billLink.style.display = visible ? 'inline-block' : 'none';
}


/* ================================================================
   5. MODAL SYSTEM
   ================================================================ */

function openModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

/* Close on dark backdrop click */
document.addEventListener('click', function(e) {
  if (e.target.classList && e.target.classList.contains('overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

/* Close on Escape key */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(function(m) {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }
});


/* ================================================================
   6. AUTHENTICATION
   ================================================================ */

/**
 * doLogin()
 * Validates resident credentials against stored accounts.
 * Shows an inline error if wrong — does NOT accept random logins.
 *
 * Production: replace with fetch() POST to login.php + MySQL.
 */
function doLogin() {
  var u      = document.getElementById('loginUser').value.trim();
  var p      = document.getElementById('loginPass').value.trim();
  var errDiv = document.getElementById('loginError');
  var errMsg = document.getElementById('loginErrMsg');
  errDiv.style.display = 'none';

  if (!u || !p) {
    errMsg.textContent = 'Please enter your username and password.';
    errDiv.style.display = 'flex';
    return;
  }

  var accounts = getAccounts();
  var found    = null;
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].username.toLowerCase() === u.toLowerCase() && accounts[i].password === p) {
      found = accounts[i]; break;
    }
  }

  if (!found) {
    errMsg.textContent = 'Invalid username or password. Please check your credentials.';
    errDiv.style.display = 'flex';
    return;
  }

  /* ── Successful login ── */
  closeModal('loginModal');
  loggedIn = true; isAdmin = false; curUser = found;
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  errDiv.style.display = 'none';

  /* Update navbar */
  document.getElementById('navLoggedOut').style.display = 'none';
  document.getElementById('navLoggedIn').style.display  = 'flex';
  document.getElementById('navName').textContent        = 'Hi, ' + found.name.split(' ')[0] + '!';
  setBillingLinkVisibility(true);

  /* Update sidebar */
  var parts    = found.name.split(' ');
  var initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  document.getElementById('resAvatar').textContent    = initials;
  document.getElementById('resName').textContent      = found.name;
  document.getElementById('resUnit').textContent      = found.unit;
  document.getElementById('dashGreeting').textContent = 'Good day, ' + parts[0] + '! \uD83D\uDC4B';
  document.getElementById('resInfo2').textContent     = found.unit;

  renderOverviewBills();
  showPage('dashboard');
  showDashTab('overview');
  showToast('Welcome back, ' + parts[0] + '!');
}

/**
 * doAdminLogin()
 * Validates admin credentials. Demo: admin / admin123
 * Production: replace with fetch() POST to admin_login.php.
 */
function doAdminLogin() {
  var u      = document.getElementById('adminUser').value.trim();
  var p      = document.getElementById('adminPass').value.trim();
  var errDiv = document.getElementById('adminError');
  errDiv.style.display = 'none';

  if (!u || !p) {
    document.getElementById('adminErrMsg').textContent = 'Please enter username and password.';
    errDiv.style.display = 'flex';
    return;
  }

  if (u === 'admin' && p === 'admin123') {
    closeModal('adminModal');
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    loggedIn = true; isAdmin = true;
    document.getElementById('navLoggedOut').style.display = 'none';
    document.getElementById('navLoggedIn').style.display  = 'flex';
    document.getElementById('navName').textContent        = 'Admin';
    setBillingLinkVisibility(false);
    populateBillingDropdown();
    renderAdminRecentPayments();
    showPage('admin');
    showAdminTab('overview');
    showToast('Admin login successful!');
  } else {
    document.getElementById('adminErrMsg').textContent = 'Invalid credentials. Use: admin / admin123';
    errDiv.style.display = 'flex';
  }
}

/**
 * doLogout()
 * Clears the session and returns to the home page.
 */
function doLogout() {
  loggedIn = false; isAdmin = false; curUser = null;
  document.getElementById('navLoggedOut').style.display = 'block';
  document.getElementById('navLoggedIn').style.display  = 'none';
  setBillingLinkVisibility(false);
  showPage('home');
}


/* ================================================================
   7. RESIDENT DASHBOARD — RENDER
   ================================================================ */

/**
 * getBadge(status) — returns an HTML badge string for the given status.
 */
function getBadge(status) {
  var map = { paid:'b-paid', unpaid:'b-unpaid', overdue:'b-over', pending:'b-pend' };
  var lbl = { paid:'Paid', unpaid:'Unpaid', overdue:'Overdue + Penalty', pending:'Pending' };
  return '<span class="badge ' + (map[status]||'b-unpaid') + '">' + (lbl[status]||'Unpaid') + '</span>';
}

/**
 * renderOverviewBills()
 * Fills the Overview tab's recent-bills table and KPI widgets
 * with the logged-in resident's data.
 */
function renderOverviewBills() {
  if (!curUser) return;
  var bills = getBills(curUser.username);
  var tbody = document.getElementById('recentBillsBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  bills.slice(0, 3).forEach(function(b) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + b.period + '</td>' +
                   '<td>&#8369;' + b.amount.toLocaleString() + '</td>' +
                   '<td>' + getBadge(b.status) + '</td>';
    tbody.appendChild(tr);
  });

  var unpaid = bills.filter(function(b) { return b.status === 'unpaid' || b.status === 'overdue'; });
  var due    = unpaid.reduce(function(s, b) { return s + b.amount; }, 0);
  document.getElementById('swUnpaid').textContent = unpaid.length;
  document.getElementById('swDue').innerHTML      = due > 0 ? '&#8369;' + due.toLocaleString() : '&#8369;0';
}

/**
 * renderMyBills()
 * Fills the My Bills tab table with all of the resident's billing records.
 */
function renderMyBills() {
  if (!curUser) return;
  var bills = getBills(curUser.username);
  var tbody = document.getElementById('myBillsTable');
  if (!tbody) return;

  tbody.innerHTML = '';
  bills.forEach(function(b, i) {
    var actionBtn = (b.status === 'unpaid' || b.status === 'overdue')
      ? '<button class="btn btn-gold btn-sm" onclick="startPayment(' + i + ')"><i class="fas fa-credit-card"></i> Pay Now</button>'
      : '<button class="btn btn-ghost btn-sm" onclick="viewReceipt(' + i + ')"><i class="fas fa-receipt"></i> Receipt</button>';

    var tr = document.createElement('tr');
    tr.setAttribute('data-status', b.status);
    tr.innerHTML =
      '<td><strong>' + b.period + '</strong></td>' +
      '<td>' + b.desc + '</td>' +
      '<td>&#8369;' + b.amount.toLocaleString() + '.00</td>' +
      '<td>' + b.dueDate + '</td>' +
      '<td>' + getBadge(b.status) + '</td>' +
      '<td>' + actionBtn + '</td>';
    tbody.appendChild(tr);
  });
}

/**
 * renderHistory()
 * Fills the Payment History tab with the resident's paid bills.
 */
function renderHistory() {
  if (!curUser) return;
  var bills = getBills(curUser.username);
  var tbody = document.getElementById('historyTable');
  if (!tbody) return;

  tbody.innerHTML = '';
  var rcpNum = 2400;
  var paid   = bills.filter(function(b) { return b.status === 'paid'; });

  paid.forEach(function(b) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>#RCP-' + (rcpNum++) + '</td>' +
      '<td>' + b.period + '</td>' +
      '<td>&#8369;' + b.amount.toLocaleString() + '</td>' +
      '<td>' + (b.method   || 'GCash') + '</td>' +
      '<td>' + (b.paidDate || '&mdash;') + '</td>' +
      '<td>' + getBadge('paid') + '</td>';
    tbody.appendChild(tr);
  });

  if (!paid.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--g400);padding:2rem">No payment history yet.</td></tr>';
  }
}


/* ================================================================
   8. BILLING FILTER
   ================================================================ */

/**
 * filterBills(chip, filter)
 * Filters the My Bills table rows by their data-status attribute.
 *
 * @param {HTMLElement} chip    - Clicked filter chip
 * @param {string}      filter  - 'all' | 'paid' | 'unpaid' | 'overdue'
 */
function filterBills(chip, filter) {
  document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
  chip.classList.add('active');
  document.querySelectorAll('#myBillsTable tr').forEach(function(row) {
    var st = row.getAttribute('data-status');
    row.style.display = (filter === 'all' || st === filter) ? '' : 'none';
  });
}


/* ================================================================
   9. PAYMENT FLOW
   ================================================================ */

/**
 * startPayment(billIndex)
 * Prepares the Payment page for the selected bill and navigates to it.
 */
function startPayment(billIndex) {
  if (!curUser) return;
  var bills = getBills(curUser.username);
  var bill  = bills[billIndex];
  if (!bill) return;

  pendingBillForPayment = { index: billIndex, bill: bill };

  document.getElementById('payPeriodLabel').textContent  = 'AMOUNT DUE \u2014 ' + bill.period.toUpperCase();
  document.getElementById('payAmountLabel').innerHTML    = '\u20B1 ' + bill.amount.toLocaleString() + '.00';
  document.getElementById('payDueDateLabel').textContent = 'Due Date: ' + bill.dueDate;
  document.getElementById('payAmountInput').value        = '\u20B1' + bill.amount.toLocaleString() + '.00';
  document.getElementById('gcashNum').value = '';
  document.getElementById('gcashRef').value = '';

  var btn = document.getElementById('payBtn');
  btn.innerHTML = '<i class="fas fa-lock"></i> Confirm Payment';
  btn.disabled  = false;
  btn.style.background = '';

  showPage('payment');
}

/**
 * viewReceipt(billIndex)
 * Populates the Receipt page with a paid bill's data and navigates to it.
 */
function viewReceipt(billIndex) {
  if (!curUser) return;
  var bills = getBills(curUser.username);
  var bill  = bills[billIndex];
  if (!bill) return;

  document.getElementById('rcpName').textContent   = curUser.name;
  document.getElementById('rcpUnit').textContent   = curUser.unit;
  document.getElementById('rcpPeriod').textContent = bill.period;
  document.getElementById('rcpMethod').textContent = bill.method   || 'GCash';
  document.getElementById('rcpRef').textContent    = bill.ref      || 'GC-XXXXXXXXXX';
  document.getElementById('rcpDate').textContent   = bill.paidDate || '\u2014';
  document.getElementById('rcpAmount').innerHTML   = '\u20B1 ' + bill.amount.toLocaleString() + '.00';
  document.getElementById('rcpNum').textContent    = 'Receipt No. #RCP-' + (2400 + billIndex);

  showPage('receipt');
}

/**
 * selectMethod(el) — highlights the chosen payment method card.
 */
function selectMethod(el) {
  document.querySelectorAll('.pay-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
}

/**
 * processPayment()
 * Validates inputs, simulates 2-second processing, marks the bill
 * as paid in localStorage, then shows the receipt page.
 *
 * Production: POST to payment.php before updating the UI.
 */
function processPayment() {
  if (!pendingBillForPayment) { showToast('No bill selected.'); return; }

  var gcashNum = document.getElementById('gcashNum').value.trim();
  var gcashRef = document.getElementById('gcashRef').value.trim();
  if (!gcashNum) { showToast('Please enter your GCash number.'); return; }
  if (!gcashRef) { showToast('Please enter the reference number.'); return; }

  var btn = document.getElementById('payBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  btn.disabled  = true;

  var selectedMethod = 'GCash';
  var selEl = document.querySelector('.pay-opt.sel .pay-name');
  if (selEl) selectedMethod = selEl.textContent;

  setTimeout(function() {
    btn.innerHTML        = '<i class="fas fa-check"></i> Payment Confirmed!';
    btn.style.background = 'var(--success)';

    /* Mark bill as paid and persist */
    var bills = getBills(curUser.username);
    var idx   = pendingBillForPayment.index;
    var now   = new Date();
    var dateStr = MONTHS_LONG[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() +
                  ' \u2014 ' +
                  String(now.getHours()).padStart(2,'0')   + ':' +
                  String(now.getMinutes()).padStart(2,'0');

    bills[idx].status   = 'paid';
    bills[idx].method   = selectedMethod;
    bills[idx].ref      = gcashRef;
    bills[idx].paidDate = dateStr;
    saveBillsForUser(curUser.username, bills);

    /* Populate receipt */
    var bill = bills[idx];
    document.getElementById('rcpName').textContent   = curUser.name;
    document.getElementById('rcpUnit').textContent   = curUser.unit;
    document.getElementById('rcpPeriod').textContent = bill.period;
    document.getElementById('rcpMethod').textContent = selectedMethod;
    document.getElementById('rcpRef').textContent    = gcashRef;
    document.getElementById('rcpDate').textContent   = dateStr;
    document.getElementById('rcpAmount').innerHTML   = '\u20B1 ' + bill.amount.toLocaleString() + '.00';
    document.getElementById('rcpNum').textContent    = 'Receipt No. #RCP-' + (rcpCounter++);

    setTimeout(function() { showPage('receipt'); pendingBillForPayment = null; }, 600);
  }, 2000);
}


/* ================================================================
   10. ADMIN — RESIDENTS
   ================================================================ */

/**
 * saveResident()
 * Validates the form, creates a login account in localStorage,
 * adds the resident to the table and billing dropdown, and seeds
 * a default billing record.
 *
 * Production: POST to add_resident.php.
 */
function saveResident() {
  var first = document.getElementById('rFirst').value.trim();
  var last  = document.getElementById('rLast').value.trim();
  var email = document.getElementById('rEmail').value.trim();
  var phone = document.getElementById('rPhone').value.trim();
  var block = document.getElementById('rBlock').value.trim();
  var unit  = document.getElementById('rUnit').value.trim();
  var uname = document.getElementById('rUsername').value.trim();
  var pass  = document.getElementById('rPassword').value.trim();
  var pass2 = document.getElementById('rPassword2').value.trim();

  if (!first || !last)    { showToast("Please enter the resident's full name."); return; }
  if (!block || !unit)    { showToast('Please enter the block and unit.'); return; }
  if (!uname)             { showToast('Please enter a username.'); return; }
  if (!pass)              { showToast('Please set a password.'); return; }
  if (pass.length < 6)    { showToast('Password must be at least 6 characters.'); return; }
  if (pass !== pass2)     { showToast('Passwords do not match.'); return; }

  var accounts = getAccounts();
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].username.toLowerCase() === uname.toLowerCase()) {
      showToast('Username "' + uname + '" is already taken.'); return;
    }
  }

  var fullName = first + ' ' + last;
  var location = block + ', ' + unit;

  /* Save account */
  accounts.push({ username:uname, password:pass, name:fullName, unit:location, email:email||'', phone:phone||'' });
  LSset('sah_accounts', accounts);

  /* Seed default bill */
  var allBills = LS('sah_bills', {});
  allBills[uname] = [{ period:'March 2025', desc:'Monthly HOA Dues', amount:1500, dueDate:'March 31, 2025', status:'unpaid' }];
  LSset('sah_bills', allBills);

  /* Add row to residents table */
  var newRow = document.createElement('tr');
  newRow.innerHTML =
    '<td><strong>' + fullName + '</strong></td>' +
    '<td>' + location + '</td>' +
    '<td>' + (email || '&mdash;') + '</td>' +
    '<td>' + (phone || '&mdash;') + '</td>' +
    '<td><code>' + uname + '</code></td>' +
    '<td><code>' + pass  + '</code></td>' +
    '<td><span class="badge b-paid">Active</span></td>' +
    '<td><button class="btn btn-danger btn-sm" onclick="deleteResident(this)"><i class="fas fa-trash"></i></button></td>';
  document.getElementById('residentsTable').appendChild(newRow);

  /* Add to billing dropdown */
  var opt = document.createElement('option');
  opt.value       = uname + '|' + fullName + '|' + location;
  opt.textContent = fullName + ' \u2014 ' + location;
  document.getElementById('bResident').appendChild(opt);

  /* Update count */
  var cnt = document.getElementById('totalUnitsCount');
  if (cnt) cnt.textContent = parseInt(cnt.textContent || '4') + 1;

  /* Clear form */
  ['rFirst','rLast','rEmail','rPhone','rBlock','rUnit','rUsername','rPassword','rPassword2'].forEach(function(id) {
    document.getElementById(id).value = '';
  });

  closeModal('addResModal');
  showToast(fullName + ' added! Login: ' + uname + ' / ' + pass);
}

function deleteResident(btn) {
  var row  = btn.closest('tr');
  var name = row.cells[0].textContent.trim();
  if (confirm('Delete resident "' + name + '"?')) { row.remove(); showToast(name + ' removed.'); }
}

function searchResidents() {
  var q = document.getElementById('resSearch').value.toLowerCase();
  document.querySelectorAll('#residentsTable tr').forEach(function(row) {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}


/* ================================================================
   11. ADMIN — BILLING (Create & Edit)
   ================================================================ */

/**
 * saveBilling()
 * Creates a new billing record in localStorage and adds a row
 * to the admin billing table.
 *
 * Production: POST to create_billing.php.
 */
function saveBilling() {
  var resVal  = document.getElementById('bResident').value;
  var period  = document.getElementById('bPeriod').value;
  var desc    = document.getElementById('bDesc').value.trim();
  var amount  = document.getElementById('bAmount').value;
  var dueDate = document.getElementById('bDueDate').value;
  var status  = document.getElementById('bStatus').value;

  if (!resVal)  { showToast('Please select a resident.'); return; }
  if (!period)  { showToast('Please select a billing period.'); return; }
  if (!amount)  { showToast('Please enter an amount.'); return; }
  if (!dueDate) { showToast('Please select a due date.'); return; }

  var parts    = resVal.split('|');
  var username = parts[0];
  var resName  = parts[1];
  var resUnit  = parts[2];

  var d           = new Date(period + '-01');
  var periodLabel = MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();

  var dd          = new Date(dueDate + 'T00:00:00');
  var dueDateLabel = MONTHS_LONG[dd.getMonth()] + ' ' + dd.getDate() + ', ' + dd.getFullYear();

  /* Save to resident's bills */
  var bills = getBills(username);
  bills.unshift({ period:periodLabel, desc:desc||'Monthly HOA Dues', amount:parseFloat(amount), dueDate:dueDateLabel, status:status });
  saveBillsForUser(username, bills);

  var BADGE = { paid:{cls:'b-paid',lbl:'Paid'}, pending:{cls:'b-pend',lbl:'Pending'}, unpaid:{cls:'b-unpaid',lbl:'Unpaid'} };
  var b = BADGE[status] || BADGE.unpaid;
  var actionBtn = (status === 'paid')
    ? '<button class="btn btn-ghost btn-sm" onclick="showPage(\'receipt\')"><i class="fas fa-eye"></i> View</button>'
    : '<button class="btn btn-ghost btn-sm" onclick="openEditBilling(this)"><i class="fas fa-edit"></i> Edit</button>';

  var newRow = document.createElement('tr');
  newRow.innerHTML =
    '<td>' + resName + '</td>' +
    '<td>' + resUnit.replace('Block ','B').replace(', Unit ','-U') + '</td>' +
    '<td>' + periodLabel + '</td>' +
    '<td>' + (desc||'Monthly HOA Dues') + '</td>' +
    '<td>&#8369;' + parseFloat(amount).toLocaleString() + '</td>' +
    '<td>' + dueDateLabel + '</td>' +
    '<td><span class="badge ' + b.cls + '">' + b.lbl + '</span></td>' +
    '<td>' + actionBtn + '</td>';

  var tbody = document.getElementById('adminBillingTable');
  tbody.insertBefore(newRow, tbody.firstChild);

  /* Reset form */
  document.getElementById('bResident').value = '';
  document.getElementById('bPeriod').value   = '';
  document.getElementById('bAmount').value   = '1500';
  document.getElementById('bDueDate').value  = '';
  document.getElementById('bDesc').value     = 'Monthly HOA Dues';
  document.getElementById('bStatus').value   = 'unpaid';

  closeModal('billModal');
  showToast('Billing created for ' + resName + ' \u2014 ' + periodLabel);
}

/**
 * openEditBilling(btn)
 * Pre-fills the Edit Billing modal with data from the clicked row.
 * Columns: Resident | Unit | Period | Desc | Amount | Due Date | Status | Action
 */
function openEditBilling(btn) {
  var row   = btn.closest('tr');
  var cells = row.cells;
  window._editRow = row;

  document.getElementById('eBResident').value = cells[0].textContent.trim();
  document.getElementById('eBUnit').value     = cells[1].textContent.trim();
  document.getElementById('eBPeriod').value   = cells[2].textContent.trim();
  document.getElementById('eBDesc').value     = cells[3].textContent.trim();
  document.getElementById('eBAmount').value   = cells[4].textContent.replace(/[\u20B1,]/g,'').trim();
  document.getElementById('eBDueDate').value  = cells[5].textContent.trim();

  var st  = cells[6].textContent.trim().toLowerCase();
  document.getElementById('eBStatus').value = ['paid','pending','overdue','unpaid'].indexOf(st) !== -1 ? st : 'unpaid';

  openModal('editBillModal');
}

/**
 * saveEditBilling()
 * Validates the Edit form and updates the target row in-place.
 * Production: POST to update_billing.php.
 */
function saveEditBilling() {
  var period  = document.getElementById('eBPeriod').value.trim();
  var desc    = document.getElementById('eBDesc').value.trim();
  var amount  = document.getElementById('eBAmount').value;
  var dueDate = document.getElementById('eBDueDate').value.trim();
  var status  = document.getElementById('eBStatus').value;

  if (!period)  { showToast('Please enter the billing period.'); return; }
  if (!amount)  { showToast('Please enter the amount.'); return; }
  if (!dueDate) { showToast('Please enter the due date.'); return; }

  var row = window._editRow;
  if (!row) { showToast('Error: no row selected.'); return; }

  var BADGE = { paid:{cls:'b-paid',lbl:'Paid'}, pending:{cls:'b-pend',lbl:'Pending'}, overdue:{cls:'b-over',lbl:'Overdue'}, unpaid:{cls:'b-unpaid',lbl:'Unpaid'} };
  var b = BADGE[status] || BADGE.unpaid;

  var cells = row.cells;
  cells[2].textContent = period;
  cells[3].textContent = desc || 'Monthly HOA Dues';
  cells[4].innerHTML   = '&#8369;' + parseFloat(amount).toLocaleString();
  cells[5].textContent = dueDate;
  cells[6].innerHTML   = '<span class="badge ' + b.cls + '">' + b.lbl + '</span>';
  cells[7].innerHTML   = (status === 'paid')
    ? '<button class="btn btn-ghost btn-sm" onclick="showPage(\'receipt\')"><i class="fas fa-eye"></i> View</button>'
    : '<button class="btn btn-ghost btn-sm" onclick="openEditBilling(this)"><i class="fas fa-edit"></i> Edit</button>';

  closeModal('editBillModal');
  showToast('Billing record updated!');
}

function deleteEditRow() {
  var row = window._editRow;
  if (!row) return;
  if (confirm('Delete billing record for ' + row.cells[0].textContent.trim() + '?')) {
    row.remove(); window._editRow = null;
    closeModal('editBillModal');
    showToast('Billing record deleted.');
  }
}


/* ================================================================
   12. ADMIN — PAYMENTS
   ================================================================ */

/**
 * verifyPayment(btn, rowId, resName, period)
 * Opens the Verify Payment modal pre-filled with the pending row's data.
 */
function verifyPayment(btn, rowId, resName, period) {
  document.getElementById('vResident').textContent = resName;
  document.getElementById('vPeriod').textContent   = period;
  document.getElementById('vRef').value            = '';
  document.getElementById('vDate').value           = new Date().toISOString().split('T')[0];
  var cb = document.getElementById('confirmVerifyBtn');
  cb.setAttribute('data-row',    rowId);
  cb.setAttribute('data-res',    resName);
  cb.setAttribute('data-period', period);
  openModal('verifyModal');
}

/**
 * confirmVerify()
 * Validates the verification form, assigns a receipt number,
 * and updates the row from Pending → Paid.
 * Production: POST to verify_payment.php.
 */
function confirmVerify() {
  var ref  = document.getElementById('vRef').value.trim();
  var date = document.getElementById('vDate').value;
  if (!ref)  { showToast('Please enter the reference number.'); return; }
  if (!date) { showToast('Please select the date received.'); return; }

  var cb      = document.getElementById('confirmVerifyBtn');
  var rowId   = cb.getAttribute('data-row');
  var resName = cb.getAttribute('data-res');
  var period  = cb.getAttribute('data-period');

  var rcpNum    = '#RCP-' + rcpCounter++;
  var dd        = new Date(date + 'T00:00:00');
  var dateLabel = MONTHS_SHORT[dd.getMonth()] + ' ' + dd.getDate();

  var row = document.getElementById(rowId);
  if (row) {
    var cells = row.cells;
    cells[0].textContent = rcpNum;
    cells[6].textContent = dateLabel;
    cells[7].innerHTML   = '<span class="badge b-paid">Paid</span>';
    cells[8].innerHTML   = '<button class="btn btn-ghost btn-sm" onclick="showPage(\'receipt\')"><i class="fas fa-eye"></i> View</button>';
    row.removeAttribute('id');
  }

  closeModal('verifyModal');
  showToast('Payment verified! ' + resName + ' \u2014 ' + period + ' marked Paid. ' + rcpNum);
}

function renderAdminRecentPayments() {
  var tbody = document.getElementById('adminRecentPayments');
  if (!tbody) return;
  var rows = [
    ['Juan Dela Cruz','B3-U12','Feb 2025','&#8369;1,500','GCash',  'Feb 14','b-paid','Paid'],
    ['Maria Santos',  'B1-U05','Mar 2025','&#8369;1,500','PayMaya','Mar 5', 'b-paid','Paid'],
    ['Pedro Reyes',   'B2-U08','Mar 2025','&#8369;1,500','Bank',   'Mar 10','b-paid','Paid'],
    ['Ana Gonzales',  'B4-U02','Mar 2025','&#8369;1,500','GCash',  '&mdash;','b-pend','Pending']
  ];
  tbody.innerHTML = '';
  rows.forEach(function(r) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td><td>'+r[4]+'</td><td>'+r[5]+'</td><td><span class="badge '+r[6]+'">'+r[7]+'</span></td>';
    tbody.appendChild(tr);
  });
}


/* ================================================================
   13. ADMIN — BILLING DROPDOWN
   ================================================================ */

/**
 * populateBillingDropdown()
 * Fills the Create Billing resident dropdown from localStorage accounts.
 */
function populateBillingDropdown() {
  var sel = document.getElementById('bResident');
  sel.innerHTML = '<option value="">-- Select Resident --</option>';
  getAccounts().forEach(function(a) {
    var opt = document.createElement('option');
    opt.value       = a.username + '|' + a.name + '|' + a.unit;
    opt.textContent = a.name + ' \u2014 ' + a.unit;
    sel.appendChild(opt);
  });
}


/* ================================================================
   14. ADMIN — ANNOUNCEMENTS
   ================================================================ */

/**
 * publishAnnouncement()
 * Validates the announcement form and prepends the item to the list.
 * Production: POST to publish_announcement.php.
 */
function publishAnnouncement() {
  var title = document.getElementById('annTitle').value.trim();
  var cat   = document.getElementById('annCat').value;
  var msg   = document.getElementById('annMsg').value.trim();

  if (!title) { showToast('Please enter an announcement title.'); return; }
  if (!msg)   { showToast('Please enter the announcement message.'); return; }

  var dc    = (cat === 'Maintenance') ? 'w' : (cat === 'Event') ? 's' : 'i';
  var today = new Date();
  var ds    = MONTHS_LONG[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();

  var item = document.createElement('div');
  item.className = 'notif';
  item.innerHTML =
    '<div class="ndot ' + dc + '"></div>' +
    '<div style="flex:1"><div class="n-text bold">' + title + '</div>' +
    '<div class="n-time">' + ds + ' &bull; ' + cat + '</div></div>' +
    '<button class="btn btn-danger btn-sm" onclick="deleteAnn(this)"><i class="fas fa-trash"></i></button>';

  var list = document.getElementById('annList');
  list.insertBefore(item, list.firstChild);

  document.getElementById('annTitle').value = '';
  document.getElementById('annMsg').value   = '';

  showToast('Announcement "' + title + '" published!');
}

function deleteAnn(btn) {
  var item  = btn.closest('.notif');
  var title = item.querySelector('.n-text') ? item.querySelector('.n-text').textContent.trim() : 'this announcement';
  if (confirm('Delete "' + title + '"?')) { item.remove(); showToast('Announcement deleted.'); }
}


/* ================================================================
   15. UTILITIES
   ================================================================ */

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}

function showToast(msg) {
  var t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}


/* ================================================================
   16. INITIALIZATION
   ================================================================ */

document.addEventListener('DOMContentLoaded', function() {
  /* Seed default accounts on very first run */
  getAccounts();
  setBillingLinkVisibility(false);

  /* Set today as default date for the Verify Payment input */
  var vDate = document.getElementById('vDate');
  if (vDate) vDate.value = new Date().toISOString().split('T')[0];
});