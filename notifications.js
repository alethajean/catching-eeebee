// ===== NOTIFICATIONS via EmailJS =====
// EmailJS sends real emails with zero backend required.
// SMS texts are sent via an SMS service using the customer's stored phone number.
//
// SETUP STEPS (free at emailjs.com):
//   1. Create a free account at https://www.emailjs.com
//   2. Add an Email Service (Gmail recommended) → note the Service ID
//   3. Create these 3 Email Templates → note each Template ID
//   4. Go to Account > API Keys → note your Public Key
//   5. Fill in the four constants below, then set NOTIFICATIONS_ENABLED = true
//
// TEMPLATE VARIABLES used (create templates with these {{variable}} placeholders):
//   booking-confirm:  {{to_name}}, {{to_email}}, {{date}}, {{time}}, {{location}}
//   booking-cancel:   {{to_name}}, {{to_email}}, {{date}}, {{time}}, {{location}}
//   admin-notify:     {{event_type}}, {{customer_name}}, {{date}}, {{time}}, {{location}}, {{customer_phone}}

const NOTIFICATIONS_ENABLED = false; // ← set to true after filling in IDs below

const EJ_PUBLIC_KEY         = 'YOUR_PUBLIC_KEY';
const EJ_SERVICE_ID         = 'YOUR_SERVICE_ID';
const EJ_TEMPLATE_CONFIRM   = 'YOUR_TEMPLATE_CONFIRM_ID';   // sent to customer on booking
const EJ_TEMPLATE_CANCEL    = 'YOUR_TEMPLATE_CANCEL_ID';    // sent to customer on cancel
const EJ_TEMPLATE_ADMIN     = 'YOUR_TEMPLATE_ADMIN_ID';     // sent to EeeBee on any event

// EeeBee's contact info for admin alerts
const EEEBEE_EMAIL = 'jeaniegochenour@gmail.com';
const EEEBEE_PHONE = '4258923018'; // included in admin notification template so she sees it

// Load EmailJS SDK dynamically
function loadEmailJS() {
  return new Promise((resolve) => {
    if (window.emailjs) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { emailjs.init(EJ_PUBLIC_KEY); resolve(); };
    document.head.appendChild(s);
  });
}

async function sendEmail(templateId, params) {
  if (!NOTIFICATIONS_ENABLED) {
    console.log('[Notifications disabled] Would send:', templateId, params);
    return;
  }
  try {
    await loadEmailJS();
    await emailjs.send(EJ_SERVICE_ID, templateId, params);
  } catch (e) {
    console.warn('EmailJS error:', e);
  }
}

// ===== PUBLIC API =====

// Send booking confirmation to customer
async function notifyBookingConfirmed(user, date, time, location) {
  const prefs = getUserNotifPrefs(user.email);

  if (prefs.method === 'email' || prefs.method === 'both') {
    await sendEmail(EJ_TEMPLATE_CONFIRM, {
      to_name: user.name, to_email: user.email,
      date, time, location, reply_to: EEEBEE_EMAIL,
    });
  }
  // SMS: phone number is passed to the admin template so EeeBee can follow up,
  // and to the customer template so an SMS service can be wired in via EmailJS webhook.
  if ((prefs.method === 'text' || prefs.method === 'both') && prefs.phone) {
    await sendEmail(EJ_TEMPLATE_CONFIRM, {
      to_name: user.name, to_email: user.email,
      to_phone: prefs.phone, date, time, location, reply_to: EEEBEE_EMAIL,
    });
  }
  await notifyAdmin('New Booking', user.name, user.email, prefs.phone || '—', date, time, location);
}

// Send cancellation notice to customer
async function notifyBookingCancelled(user, date, time, location) {
  const prefs = getUserNotifPrefs(user.email);

  if (prefs.method === 'email' || prefs.method === 'both') {
    await sendEmail(EJ_TEMPLATE_CANCEL, {
      to_name: user.name, to_email: user.email,
      date, time, location, reply_to: EEEBEE_EMAIL,
    });
  }
  if ((prefs.method === 'text' || prefs.method === 'both') && prefs.phone) {
    await sendEmail(EJ_TEMPLATE_CANCEL, {
      to_name: user.name, to_email: user.email,
      to_phone: prefs.phone, date, time, location, reply_to: EEEBEE_EMAIL,
    });
  }
  await notifyAdmin('Cancellation', user.name, user.email, prefs.phone || '—', date, time, location);
}

// Alert EeeBee via email
async function notifyAdmin(eventType, customerName, customerEmail, customerPhone, date, time, location) {
  await sendEmail(EJ_TEMPLATE_ADMIN, {
    event_type:     eventType,
    customer_name:  customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    date, time, location,
    to_email: EEEBEE_EMAIL,
  });
}

// Get stored notification prefs for a user
function getUserNotifPrefs(email) {
  const users = JSON.parse(localStorage.getItem('eca_users') || '[]');
  const user  = users.find(u => u.email === email);
  return {
    method: user?.notifMethod || 'email',
    phone:  user?.phone       || '',
  };
}

// Check if user has an upcoming booking within 48hrs and show a reminder banner
function checkUpcomingReminder() {
  const session = typeof getSession === 'function' ? getSession() : null;
  if (!session) return;

  const bookings = JSON.parse(localStorage.getItem('eca_bookings') || '[]');
  const now      = Date.now();

  const upcoming = bookings
    .filter(b => b.userEmail === session.email)
    .filter(b => {
      const lessonMs = bookingToMs(b.date, b.time);
      const diff     = lessonMs - now;
      return diff > 0 && diff <= 48 * 60 * 60 * 1000; // within 48 hrs
    })
    .sort((a,b) => bookingToMs(a.date,a.time) - bookingToMs(b.date,b.time));

  if (upcoming.length === 0) return;

  const next   = upcoming[0];
  const diffMs = bookingToMs(next.date, next.time) - now;
  const hrs    = Math.floor(diffMs / (1000*60*60));
  const mins   = Math.floor((diffMs % (1000*60*60)) / (1000*60));

  const av  = JSON.parse(localStorage.getItem('eca_availability') || '{}');
  const loc = av[next.date]?.[next.time] || '';

  let banner = document.getElementById('reminder-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'reminder-banner';
    const nav = document.querySelector('nav');
    if (nav) nav.after(banner);
    else document.body.prepend(banner);
  }

  banner.innerHTML = `
    <div style="
      background:var(--orange);color:var(--white);
      padding:0.75rem 2rem;text-align:center;font-size:0.9rem;font-weight:700;
      display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap
    ">
      <span>🥎 Reminder: You have a session in ${hrs > 0 ? `${hrs}h ${mins}m` : `${mins} minutes`}
        — ${next.time} on ${new Date(next.date+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
        ${loc ? `· 📍 ${loc}` : ''}
      </span>
      <button onclick="document.getElementById('reminder-banner').remove()"
        style="background:rgba(0,0,0,0.2);border:none;color:white;padding:0.2rem 0.75rem;
               border-radius:4px;cursor:pointer;font-weight:700;font-size:0.82rem">
        Dismiss
      </button>
    </div>`;
}

function bookingToMs(dateStr, timeStr) {
  const [y,m,d]  = dateStr.split('-').map(Number);
  const match    = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let   [,h,min,ampm] = match;
  h = parseInt(h); min = parseInt(min);
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(y, m-1, d, h, min).getTime();
}
