// ===== AUTH =====
// Users: localStorage "eca_users" = [{ name, email, password, phone, carrier, notifMethod }]
// Session: localStorage "eca_session" = { name, email }
// Admin:   localStorage "eca_admin"   = "true"

const ADMIN_PASSWORD = 'eeebee2026';

function getUsers()         { return JSON.parse(localStorage.getItem('eca_users')   || '[]'); }
function saveUsers(u)       { localStorage.setItem('eca_users', JSON.stringify(u)); }
function getSession()       { return JSON.parse(localStorage.getItem('eca_session') || 'null'); }
function saveSession(u)     { localStorage.setItem('eca_session', JSON.stringify({ name: u.name, email: u.email })); }
function clearSession()     { localStorage.removeItem('eca_session'); }
function isAdminSession()   { return localStorage.getItem('eca_admin') === 'true'; }
function setAdminSession()  { localStorage.setItem('eca_admin', 'true'); }
function clearAdminSession(){ localStorage.removeItem('eca_admin'); }

function handleLogin() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const err      = document.getElementById('login-error');
  const user     = getUsers().find(u => u.email === email && u.password === password);
  if (!user) { err.classList.add('show'); return; }
  err.classList.remove('show');
  saveSession(user);
  onAuthSuccess();
}

function handleRegister() {
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim().toLowerCase();
  const password= document.getElementById('reg-password').value;
  const phone   = document.getElementById('reg-phone')?.value.trim() || '';
  const notifMethod = document.querySelector('input[name="notif-method"]:checked')?.value || 'email';
  const err     = document.getElementById('reg-error');

  if (!name || !email || password.length < 6) {
    err.textContent = 'Please fill all required fields. Password must be at least 6 characters.';
    err.classList.add('show'); return;
  }
  if (getUsers().find(u => u.email === email)) {
    err.textContent = 'That email is already registered.';
    err.classList.add('show'); return;
  }
  // Require phone if text notifications chosen
  if ((notifMethod === 'text' || notifMethod === 'both') && !phone) {
    err.textContent = 'Please enter your phone number for text reminders.';
    err.classList.add('show'); return;
  }
  err.classList.remove('show');

  const users = getUsers();
  users.push({ name, email, password, phone, notifMethod });
  saveUsers(users);
  saveSession({ name, email });
  onAuthSuccess();
}

function onAuthSuccess() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
  const page = document.getElementById('calendar-page');
  if (page) page.style.display = 'block';
  renderNavAuth();
  if (typeof renderMyBookings === 'function') renderMyBookings();
  if (typeof renderCalendar  === 'function') renderCalendar();
  if (typeof checkUpcomingReminder === 'function') checkUpcomingReminder();
}

function logout() {
  clearSession();
  renderNavAuth();
  const page  = document.getElementById('calendar-page');
  const modal = document.getElementById('login-modal');
  if (page)  page.style.display = 'none';
  if (modal) modal.classList.remove('hidden');
}

function closeLoginAndRedirect() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
}

function switchToRegister() {
  document.getElementById('form-login').style.display    = 'none';
  document.getElementById('form-register').style.display = 'block';
  document.getElementById('modal-title').textContent     = 'Create Your Account';
  document.getElementById('modal-sub').textContent       = 'Free — just takes a moment.';
}
function switchToLogin() {
  document.getElementById('form-register').style.display = 'none';
  document.getElementById('form-forgot').style.display   = 'none';
  document.getElementById('form-login').style.display    = 'block';
  document.getElementById('modal-title').textContent     = 'Sign In to Book';
  document.getElementById('modal-sub').textContent       = 'Welcome back!';
}
function switchToForgot() {
  document.getElementById('form-login').style.display        = 'none';
  document.getElementById('form-register').style.display     = 'none';
  document.getElementById('form-forgot').style.display       = 'block';
  document.getElementById('forgot-step-email').style.display = 'block';
  document.getElementById('forgot-step-reset').style.display = 'none';
  document.getElementById('forgot-email').value              = '';
  document.getElementById('modal-title').textContent         = 'Reset Password';
  document.getElementById('modal-sub').textContent           = 'We\'ll help you get back in.';
}
function lookupForgotEmail() {
  const email  = document.getElementById('forgot-email').value.trim().toLowerCase();
  const errEl  = document.getElementById('forgot-email-error');
  const user   = getUsers().find(u => u.email === email);
  if (!user) {
    errEl.textContent = 'No account found with that email.'; errEl.classList.add('show'); return;
  }
  errEl.classList.remove('show');
  document.getElementById('forgot-step-email').style.display = 'none';
  document.getElementById('forgot-step-reset').style.display = 'block';
  document.getElementById('forgot-new-pw').dataset.email     = email;
}
function doForgotReset() {
  const email   = document.getElementById('forgot-new-pw').dataset.email;
  const pw      = document.getElementById('forgot-new-pw').value;
  const confirm = document.getElementById('forgot-confirm-pw').value;
  const errEl   = document.getElementById('forgot-reset-error');
  if (pw.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.add('show'); return;
  }
  if (pw !== confirm) {
    errEl.textContent = 'Passwords do not match.'; errEl.classList.add('show'); return;
  }
  const users = getUsers();
  const idx   = users.findIndex(u => u.email === email);
  users[idx].password = pw;
  saveUsers(users);
  switchToLogin();
  document.getElementById('modal-sub').textContent = '✓ Password updated — sign in below.';
}

// Show/hide phone fields based on notification preference
function updateNotifFields() {
  const method    = document.querySelector('input[name="notif-method"]:checked')?.value || 'email';
  const phoneWrap = document.getElementById('phone-fields');
  if (phoneWrap) phoneWrap.style.display = (method === 'text' || method === 'both') ? 'block' : 'none';
}

function renderNavAuth() {
  const container = document.getElementById('nav-auth');
  if (!container) return;
  const session = getSession();
  if (session) {
    const initials = session.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    container.innerHTML = `
      <div class="user-bar">
        <a href="profile.html" class="user-avatar" title="My Profile">${initials}</a>
        <a href="profile.html" class="user-name">${session.name.split(' ')[0]}</a>
        <button class="logout-btn" onclick="logout()">Sign Out</button>
      </div>`;
  } else {
    container.innerHTML = ``;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavAuth();
  const modal = document.getElementById('login-modal');
  const page  = document.getElementById('calendar-page');
  if (modal && page) {
    if (getSession()) {
      modal.classList.add('hidden');
      page.style.display = 'block';
    } else {
      modal.classList.remove('hidden');
      page.style.display = 'none';
    }
  }
});
