// ===== CALENDAR & BOOKING =====
// Availability: localStorage "eca_availability" = { "2026-06-15": { "10:00 AM": "Main Facility", ... } }
// Bookings:     localStorage "eca_bookings"     = [{ date, time, userEmail, userName, bookedAt, location }]

let currentYear, currentMonth, selectedDate = null, selectedTime = null;

function getRawAvailability() { return JSON.parse(localStorage.getItem('eca_availability') || '{}'); }
function getBookings()        { return JSON.parse(localStorage.getItem('eca_bookings') || '[]'); }
function saveBookings(b)      { localStorage.setItem('eca_bookings', JSON.stringify(b)); }

function getSlotsForDate(dateStr) {
  const raw = getRawAvailability()[dateStr];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : Object.keys(raw);
}
function getLocationForSlot(dateStr, time) {
  const raw = getRawAvailability()[dateStr];
  if (!raw || Array.isArray(raw)) return '';
  return raw[time] || '';
}
function isSlotBooked(dateStr, time) {
  return getBookings().some(b => b.date === dateStr && b.time === time);
}

function toDateStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function formatDateLabel(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// Convert a booking date+time to milliseconds for comparison
function bookingToMs(dateStr, timeStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const match   = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let [,h,min,ampm] = match; h = parseInt(h); min = parseInt(min);
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(y, m-1, d, h, min).getTime();
}

// Can this booking still be cancelled? (more than 24hrs before lesson)
function canCancel(dateStr, timeStr) {
  return bookingToMs(dateStr, timeStr) - Date.now() > 24 * 60 * 60 * 1000;
}

// ===== RENDER CALENDAR =====
function renderCalendar() {
  const today = new Date();
  if (currentYear === undefined) { currentYear = today.getFullYear(); currentMonth = today.getMonth(); }

  document.getElementById('cal-month-label').textContent =
    new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' });

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });

  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
  const todayStr    = toDateStr(today);
  const bookings    = getBookings();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-cell empty'; grid.appendChild(el);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(currentYear, currentMonth, day));
    const isPast  = dateStr < todayStr;
    const avSlots = getSlotsForDate(dateStr);
    const hasAv   = avSlots.length > 0;

    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (isPast)                   cell.classList.add('past');
    if (dateStr === todayStr)     cell.classList.add('today');
    if (dateStr === selectedDate) cell.classList.add('selected');
    if (!isPast && !hasAv)        cell.classList.add('no-availability');
    cell.innerHTML = `<span>${day}</span>`;

    if (hasAv && !isPast) {
      const booked    = bookings.filter(b => b.date === dateStr).length;
      const available = avSlots.length - booked;
      const dotRow    = document.createElement('div'); dotRow.className = 'dot-row';
      if (available > 0) { const d = document.createElement('div'); d.className = 'cal-dot available'; dotRow.appendChild(d); }
      if (booked > 0)    { const d = document.createElement('div'); d.className = 'cal-dot booked';    dotRow.appendChild(d); }
      cell.appendChild(dotRow);
      cell.addEventListener('click', () => selectDate(dateStr));
    }
    grid.appendChild(cell);
  }
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  selectedDate = null; selectedTime = null;
  document.getElementById('confirm-panel').style.display = 'none';
  renderCalendar();
  document.getElementById('slots-header').textContent = 'Select a date to see available times';
  document.getElementById('time-slots').innerHTML = '<p style="font-size:0.85rem;color:var(--gray);text-align:center;padding:1rem 0">← Choose a date on the calendar</p>';
}

// ===== SELECT DATE =====
function selectDate(dateStr) {
  selectedDate = dateStr; selectedTime = null;
  document.getElementById('confirm-panel').style.display = 'none';
  renderCalendar();
  renderSlots(dateStr);
}

function renderSlots(dateStr) {
  document.getElementById('slots-header').textContent = formatDateLabel(dateStr);
  const container = document.getElementById('time-slots');
  container.innerHTML = '';
  const avSlots = getSlotsForDate(dateStr);

  if (avSlots.length === 0) {
    container.innerHTML = '<p style="font-size:0.85rem;color:var(--gray);text-align:center;padding:1.5rem 0">No availability set for this day.<br>Contact EeeBee at <strong>425-892-3018</strong>.</p>';
    return;
  }

  const order  = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
                   '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM'];
  const sorted = avSlots.slice().sort((a,b) => order.indexOf(a) - order.indexOf(b));

  sorted.forEach(time => {
    const booked   = isSlotBooked(dateStr, time);
    const location = getLocationForSlot(dateStr, time);
    const slot     = document.createElement('div');
    slot.className = `slot ${booked ? 'booked' : 'available'}`;
    if (!booked && time === selectedTime) slot.classList.add('selected-slot');
    const locHtml = location ? `<span style="font-size:0.72rem;opacity:0.75;font-weight:600">📍 ${location}</span>` : '';
    slot.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1px">
        <span>${time}</span>${locHtml}
      </div>
      <span class="slot-badge">${booked ? 'Booked' : 'Open'}</span>`;
    if (!booked) slot.addEventListener('click', () => selectSlot(dateStr, time));
    container.appendChild(slot);
  });
}

// ===== SELECT SLOT =====
function selectSlot(dateStr, time) {
  selectedTime = time;
  renderSlots(dateStr);
  const session  = getSession();
  const location = getLocationForSlot(dateStr, time);
  document.getElementById('confirm-date').textContent     = formatDateLabel(dateStr);
  document.getElementById('confirm-time').textContent     = time;
  document.getElementById('confirm-location').textContent = location || 'TBD';
  document.getElementById('confirm-user').textContent     = session ? session.name : '';

  // Populate player checkboxes if the user has players on their profile
  const users   = JSON.parse(localStorage.getItem('eca_users') || '[]');
  const user    = users.find(u => u.email === session?.email);
  const players = (user?.players || []).map(p => typeof p === 'object' ? p : { name: p, age: null });
  const wrap    = document.getElementById('confirm-players-wrap');
  const list    = document.getElementById('confirm-players-list');
  if (players.length > 0) {
    list.innerHTML = players.map((p, i) => {
      const label = p.age ? `${p.name} <span style="font-size:0.72rem;color:var(--orange);font-weight:700">(Age ${p.age})</span>` : p.name;
      return `<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.88rem;cursor:pointer">
        <input type="checkbox" name="attending-player" value="${p.name}" style="accent-color:var(--orange);width:15px;height:15px" ${players.length === 1 ? 'checked' : ''} />
        ${label}
      </label>`;
    }).join('');
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }

  document.getElementById('confirm-panel').style.display  = 'block';
  document.getElementById('confirm-panel').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ===== CONFIRM BOOKING =====
async function confirmBooking() {
  if (!selectedDate || !selectedTime) return;
  if (isSlotBooked(selectedDate, selectedTime)) {
    alert('Sorry — that slot was just taken. Please choose another time.');
    renderSlots(selectedDate);
    document.getElementById('confirm-panel').style.display = 'none';
    return;
  }
  const session  = getSession();
  const location = getLocationForSlot(selectedDate, selectedTime);
  const bookings = getBookings();
  const checkedPlayers = [...document.querySelectorAll('input[name="attending-player"]:checked')].map(el => el.value);
  bookings.push({
    date: selectedDate, time: selectedTime,
    userEmail: session.email, userName: session.name,
    location, players: checkedPlayers, bookedAt: new Date().toISOString()
  });
  saveBookings(bookings);

  const d = selectedDate, t = selectedTime;
  selectedTime = null;
  document.getElementById('confirm-panel').style.display = 'none';
  renderCalendar();
  renderSlots(d);
  renderMyBookings();
  showToast('Booking confirmed! See you on the field. 🥎');

  // Send notifications
  const users = JSON.parse(localStorage.getItem('eca_users') || '[]');
  const user  = users.find(u => u.email === session.email);
  if (user && typeof notifyBookingConfirmed === 'function') {
    await notifyBookingConfirmed(user, formatDateLabel(d), t, location || 'TBD');
  }
  if (typeof checkUpcomingReminder === 'function') checkUpcomingReminder();
}

function cancelSelection() {
  selectedTime = null;
  document.getElementById('confirm-panel').style.display = 'none';
  if (selectedDate) renderSlots(selectedDate);
}

// ===== CANCEL BOOKING =====
async function cancelBooking(dateStr, time) {
  if (!canCancel(dateStr, time)) {
    alert('Cancellations must be made at least 24 hours before the session.');
    return;
  }
  const label = `${formatDateLabel(dateStr)} at ${time}`;
  if (!confirm(`Cancel your booking on ${label}?\n\nThis cannot be undone.`)) return;

  const session  = getSession();
  const bookings = getBookings();
  const booking  = bookings.find(b => b.date === dateStr && b.time === time && b.userEmail === session.email);
  if (!booking) return;

  // Remove from bookings
  const updated = bookings.filter(b => !(b.date === dateStr && b.time === time && b.userEmail === session.email));
  saveBookings(updated);

  renderMyBookings();
  renderCalendar();
  if (selectedDate === dateStr) renderSlots(dateStr);
  showToast('Booking cancelled.');

  // Send notifications
  const users = JSON.parse(localStorage.getItem('eca_users') || '[]');
  const user  = users.find(u => u.email === session.email);
  if (user && typeof notifyBookingCancelled === 'function') {
    await notifyBookingCancelled(user, formatDateLabel(dateStr), time, booking.location || 'TBD');
  }
  if (typeof checkUpcomingReminder === 'function') checkUpcomingReminder();
}

// ===== MY BOOKINGS =====
function renderMyBookings() {
  const session   = getSession();
  if (!session)   return;
  const container = document.getElementById('my-bookings');
  const todayStr  = toDateStr(new Date());
  const mine      = getBookings()
    .filter(b => b.userEmail === session.email && b.date >= todayStr)
    .sort((a,b) => a.date.localeCompare(b.date));

  if (mine.length === 0) {
    container.innerHTML = '<p style="font-size:0.85rem;color:var(--gray)">No upcoming bookings yet.</p>';
    return;
  }

  container.innerHTML = mine.map(b => {
    const cancellable  = canCancel(b.date, b.time);
    const msUntil      = bookingToMs(b.date, b.time) - Date.now();
    const hoursUntil   = Math.floor(msUntil / (1000*60*60));
    const cancelLabel  = cancellable
      ? `<button class="cancel-booking-btn" onclick="cancelBooking('${b.date}','${b.time}')">Cancel</button>`
      : `<span class="cancel-locked-label" title="Cancellations must be 24+ hours in advance">🔒 &lt;24hrs</span>`;
    const locLine     = b.location ? `<div class="booking-location">📍 ${b.location}</div>` : '';
    const playersLine = b.players?.length ? `<div style="font-size:0.78rem;color:var(--orange);font-weight:700;margin-top:2px">🧤 ${b.players.join(', ')}</div>` : '';
    return `
      <div class="booking-row">
        <div class="booking-info">
          <div class="booking-date">${formatDateLabel(b.date)}</div>
          <div class="booking-time">${b.time} · 60 min</div>
          ${locLine}
          ${playersLine}
        </div>
        <div class="booking-actions">
          <span class="booking-confirmed-badge">Confirmed</span>
          ${cancelLabel}
        </div>
      </div>`;
  }).join('');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)',
    background:'var(--black)', color:'var(--white)', padding:'0.85rem 1.75rem',
    borderRadius:'30px', fontWeight:'700', fontSize:'0.92rem',
    boxShadow:'0 8px 30px rgba(0,0,0,0.3)', zIndex:'500', transition:'opacity 0.4s ease',
    borderLeft:'4px solid var(--orange)'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('cal-grid')) return;
  const page = document.getElementById('calendar-page');
  if (!page) return;
  const tryInit = () => {
    if (page.style.display !== 'none') {
      renderCalendar();
      renderMyBookings();
      if (typeof checkUpcomingReminder === 'function') checkUpcomingReminder();
    }
  };
  tryInit();
  new MutationObserver(tryInit).observe(page, { attributes:true, attributeFilter:['style'] });
});
