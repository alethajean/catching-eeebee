// ===== ADMIN — AVAILABILITY MANAGEMENT =====
// Availability structure:
//   localStorage "eca_availability" = {
//     "2026-06-15": {
//       "10:00 AM": "Main Training Facility",
//       "2:00 PM":  "Local Ballfield"
//     }
//   }

const ALL_SLOTS = [
  '6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
  '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM'
];

const LOCATIONS = [
  'Main Training Facility',
  'Local Ballfield',
  "Athlete's Location",
  'TBD'
];

const DEFAULT_LOCATION = 'Main Training Facility';

let weekStart;

// ===== DATA HELPERS =====
function getAvailability() {
  const raw = JSON.parse(localStorage.getItem('eca_availability') || '{}');
  // Migrate old array format to new object format
  const migrated = {};
  for (const [date, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      migrated[date] = {};
      val.forEach(t => migrated[date][t] = DEFAULT_LOCATION);
    } else {
      migrated[date] = val;
    }
  }
  return migrated;
}
function saveAvailability(a) { localStorage.setItem('eca_availability', JSON.stringify(a)); }
function getBookings()       { return JSON.parse(localStorage.getItem('eca_bookings') || '[]'); }

// Returns array of time strings that are enabled for a date
function getEnabledTimes(dateStr) {
  const av = getAvailability();
  return Object.keys(av[dateStr] || {});
}

// ===== ADMIN LOGIN =====
function handleAdminLogin() {
  const pw  = document.getElementById('admin-password').value;
  const err = document.getElementById('admin-login-error');
  if (pw !== ADMIN_PASSWORD) { err.classList.add('show'); return; }
  err.classList.remove('show');
  setAdminSession();
  showAdminPage();
}
function adminLogout() {
  clearAdminSession();
  document.getElementById('admin-page').style.display = 'none';
  document.getElementById('admin-login-modal').classList.remove('hidden');
  document.getElementById('admin-password').value = '';
}
function showAdminPage() {
  document.getElementById('admin-login-modal').classList.add('hidden');
  document.getElementById('admin-page').style.display = 'block';
  initWeek();
  renderWeek();
  renderAdminBookings();
}

// ===== WEEK NAV =====
function getMondayOfWeek(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function initWeek() { if (!weekStart) weekStart = getMondayOfWeek(new Date()); }
function changeWeek(dir) {
  weekStart.setDate(weekStart.getDate() + dir * 7);
  renderWeek();
  renderAdminBookings();
}
function toDateStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function formatShort(dt) { return dt.toLocaleDateString('en-US', { month:'short', day:'numeric' }); }

// ===== RENDER WEEK =====
function renderWeek() {
  const endDate = new Date(weekStart); endDate.setDate(weekStart.getDate() + 6);
  document.getElementById('week-label').textContent =
    `Week of ${formatShort(weekStart)} – ${formatShort(endDate)}`;

  const av        = getAvailability();
  const bookings  = getBookings();
  const todayStr  = toDateStr(new Date());
  const container = document.getElementById('day-cards');
  container.innerHTML = '';

  let totalDays = 0, totalSlots = 0, totalBooked = 0;

  for (let i = 0; i < 7; i++) {
    const dt          = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
    const dateStr     = toDateStr(dt);
    const isPast      = dateStr < todayStr;
    const avSlots     = av[dateStr] || {};
    const slotCount   = Object.keys(avSlots).length;
    const dayBookings = bookings.filter(b => b.date === dateStr);

    if (slotCount > 0) { totalDays++; totalSlots += slotCount; }
    totalBooked += dayBookings.length;

    const card = document.createElement('div');
    card.className = 'day-availability-card';
    if (isPast) card.style.opacity = '0.55';

    const statusHtml = slotCount > 0
      ? `<span class="day-status has-slots">${slotCount} slot${slotCount>1?'s':''} open</span>`
      : `<span class="day-status no-slots">No availability</span>`;

    card.innerHTML = `
      <div class="day-av-header" onclick="toggleDayCard('body-${dateStr}')">
        <h3>${dt.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</h3>
        ${statusHtml}
      </div>
      <div class="day-av-body" id="body-${dateStr}">
        <div id="slots-${dateStr}"></div>
        <div class="day-actions">
          <button class="btn btn-all-on"  onclick="setAllDay('${dateStr}',true)">All On</button>
          <button class="btn btn-all-off" onclick="setAllDay('${dateStr}',false)">All Off</button>
        </div>
      </div>`;

    container.appendChild(card);
    renderDaySlots(dateStr, avSlots, dayBookings, isPast);
  }

  document.getElementById('stat-days').textContent   = totalDays;
  document.getElementById('stat-slots').textContent  = totalSlots;
  document.getElementById('stat-booked').textContent = totalBooked;
}

// ===== RENDER SLOTS FOR ONE DAY =====
function renderDaySlots(dateStr, avSlots, dayBookings, isPast) {
  const container = document.getElementById(`slots-${dateStr}`);
  if (!container) return;
  container.innerHTML = '';

  ALL_SLOTS.forEach(time => {
    const isOn     = time in avSlots;
    const location = avSlots[time] || DEFAULT_LOCATION;
    const booking  = dayBookings.find(b => b.time === time);
    const isBooked = !!booking;

    const wrapper = document.createElement('div');
    wrapper.className = 'slot-row';

    if (isBooked) {
      // Locked — show red, can't toggle
      wrapper.innerHTML = `
        <div class="slot-toggle booked-by-user" title="Booked by ${booking.userName}">
          ${time}
          <span class="slot-booked-label">Booked · ${booking.userName}</span>
        </div>
        <div class="slot-location-row">
          <span class="slot-location-val">📍 ${location}</span>
        </div>`;
    } else if (isOn) {
      // ON — show location selector
      const opts = LOCATIONS.map(l =>
        `<option value="${l}" ${l === location ? 'selected' : ''}>${l}</option>`
      ).join('');
      wrapper.innerHTML = `
        <div class="slot-toggle on" onclick="${isPast ? '' : `toggleSlot('${dateStr}','${time}')`}">
          <span>${time}</span>
          <span class="slot-on-check">✓ Open</span>
        </div>
        <div class="slot-location-row">
          <label class="slot-location-label">📍 Location:</label>
          <select class="slot-location-select" onchange="setSlotLocation('${dateStr}','${time}',this.value)" ${isPast ? 'disabled' : ''}>
            ${opts}
          </select>
        </div>`;
    } else {
      // OFF
      wrapper.innerHTML = `
        <div class="slot-toggle off" onclick="${isPast ? '' : `toggleSlot('${dateStr}','${time}')`}">
          ${time}
        </div>`;
    }

    container.appendChild(wrapper);
  });
}

function toggleDayCard(bodyId) {
  const el = document.getElementById(bodyId);
  if (el) el.classList.toggle('open');
}

// ===== TOGGLE / SET LOCATION =====
function toggleSlot(dateStr, time) {
  const av    = getAvailability();
  const slots = av[dateStr] || {};
  if (time in slots) {
    delete slots[time];
  } else {
    slots[time] = DEFAULT_LOCATION;
  }
  if (Object.keys(slots).length === 0) delete av[dateStr];
  else av[dateStr] = slots;
  saveAvailability(av);
  rerenderDay(dateStr);
  updateStats();
}

function setSlotLocation(dateStr, time, location) {
  const av = getAvailability();
  if (!av[dateStr]) av[dateStr] = {};
  av[dateStr][time] = location;
  saveAvailability(av);
  updateDayHeader(dateStr);
}

function rerenderDay(dateStr) {
  const av       = getAvailability();
  const bookings = getBookings().filter(b => b.date === dateStr);
  const isPast   = dateStr < toDateStr(new Date());
  renderDaySlots(dateStr, av[dateStr] || {}, bookings, isPast);
  updateDayHeader(dateStr);
  updateStats();
  // Keep card open
  const bodyEl = document.getElementById(`body-${dateStr}`);
  if (bodyEl) bodyEl.classList.add('open');
}

function updateDayHeader(dateStr) {
  const av       = getAvailability();
  const slotCount = Object.keys(av[dateStr] || {}).length;
  const header    = document.querySelector(`#body-${dateStr}`)?.previousElementSibling;
  if (!header) return;
  const statusEl = header.querySelector('.day-status');
  if (!statusEl) return;
  statusEl.className = `day-status ${slotCount > 0 ? 'has-slots' : 'no-slots'}`;
  statusEl.textContent = slotCount > 0 ? `${slotCount} slot${slotCount>1?'s':''} open` : 'No availability';
}

function updateStats() {
  const av       = getAvailability();
  const bookings = getBookings();
  const todayStr = toDateStr(new Date());
  let days = 0, slots = 0, booked = 0;
  for (let i = 0; i < 7; i++) {
    const dt  = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
    const ds  = toDateStr(dt);
    const cnt = Object.keys(av[ds] || {}).length;
    if (cnt > 0) { days++; slots += cnt; }
    booked += bookings.filter(b => b.date === ds).length;
  }
  document.getElementById('stat-days').textContent   = days;
  document.getElementById('stat-slots').textContent  = slots;
  document.getElementById('stat-booked').textContent = booked;
}

// ===== QUICK ACTIONS =====
function setAllDay(dateStr, on) {
  const bookings = getBookings().filter(b => b.date === dateStr);
  const av = getAvailability();
  if (on) {
    av[dateStr] = av[dateStr] || {};
    ALL_SLOTS.forEach(t => { if (!(t in (av[dateStr]||{}))) av[dateStr][t] = DEFAULT_LOCATION; });
  } else {
    if (bookings.length > 0) {
      av[dateStr] = {};
      bookings.forEach(b => av[dateStr][b.time] = (getAvailability()[dateStr]?.[b.time] || DEFAULT_LOCATION));
    } else {
      delete av[dateStr];
    }
  }
  saveAvailability(av);
  rerenderDay(dateStr);
}

function openAllWeek() {
  const av       = getAvailability();
  const todayStr = toDateStr(new Date());
  for (let i = 0; i < 7; i++) {
    const dt  = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
    const ds  = toDateStr(dt);
    if (ds >= todayStr) {
      av[ds] = av[ds] || {};
      ALL_SLOTS.forEach(t => { if (!(t in av[ds])) av[ds][t] = DEFAULT_LOCATION; });
    }
  }
  saveAvailability(av);
  renderWeek();
}

function clearAllWeek() {
  if (!confirm('Remove all availability for this week? Already-booked slots are preserved.')) return;
  const av       = getAvailability();
  const bookings = getBookings();
  for (let i = 0; i < 7; i++) {
    const dt  = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
    const ds  = toDateStr(dt);
    const booked = bookings.filter(b => b.date === ds);
    if (booked.length > 0) {
      av[ds] = {};
      booked.forEach(b => av[ds][b.time] = av[ds]?.[b.time] || DEFAULT_LOCATION);
    } else {
      delete av[ds];
    }
  }
  saveAvailability(av);
  renderWeek();
}

function copyLastWeek() {
  const av       = getAvailability();
  const todayStr = toDateStr(new Date());
  for (let i = 0; i < 7; i++) {
    const thisDt  = new Date(weekStart); thisDt.setDate(weekStart.getDate() + i);
    const lastDt  = new Date(weekStart); lastDt.setDate(weekStart.getDate() + i - 7);
    const thisStr = toDateStr(thisDt);
    const lastStr = toDateStr(lastDt);
    if (thisStr >= todayStr && av[lastStr]) {
      av[thisStr] = { ...av[lastStr] };
    }
  }
  saveAvailability(av);
  renderWeek();
  showAdminToast("Last week's schedule copied!");
}

// ===== ADMIN BOOKINGS =====
function renderAdminBookings() {
  const container = document.getElementById('admin-bookings-list');
  const todayStr  = toDateStr(new Date());
  const upcoming  = getBookings()
    .filter(b => b.date >= todayStr)
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  if (upcoming.length === 0) {
    container.innerHTML = '<p style="font-size:0.82rem;color:var(--gray)">No upcoming bookings.</p>';
    return;
  }
  const av = getAvailability();
  container.innerHTML = upcoming.map(b => {
    const loc = av[b.date]?.[b.time] || '—';
    return `
      <div style="padding:0.6rem 0;border-bottom:1px solid var(--light-gray);font-size:0.82rem">
        <div style="font-weight:800;color:var(--black)">${new Date(b.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
        <div style="color:var(--gray)">${b.time} · ${b.userName}</div>
        <div style="color:var(--orange);font-size:0.76rem;font-weight:700">📍 ${loc}</div>
      </div>`;
  }).join('');
}

function showAdminToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)',
    background:'var(--black)', color:'var(--white)', padding:'0.75rem 1.5rem',
    borderRadius:'30px', fontWeight:'700', fontSize:'0.88rem',
    boxShadow:'0 6px 20px rgba(0,0,0,0.25)', zIndex:'500', transition:'opacity 0.4s ease',
    borderLeft:'4px solid var(--orange)'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 2500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('admin-login-modal');
  const page  = document.getElementById('admin-page');
  if (!modal || !page) return;
  if (isAdminSession()) showAdminPage();
  else { modal.classList.remove('hidden'); page.style.display = 'none'; }
});
