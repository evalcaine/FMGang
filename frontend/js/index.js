/* ===============================
   GLOBAL
================================ */

let currentUserEmail = null;

let dateTimer = null;

let lastDateLoaded = null;


/* ===============================
   HELPERS
================================ */

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function setToday() {

  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2,'0');
  const dd = String(t.getDate()).padStart(2,'0');

  const today = `${yyyy}-${mm}-${dd}`;

  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = today;

  loadMatches();
}


/* ===============================
   INIT
================================ */

document.addEventListener('DOMContentLoaded', async () => {

  const results = document.getElementById('results');
  if (!results) return;

  const dateInput = document.getElementById('date');
  const todayDisplay = document.getElementById('today-display');

  /* DISPLAY TODAY */

  if (todayDisplay) {
    const today = new Date();
    todayDisplay.innerText = today.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /* AUTH */

  const { data:{ session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUserEmail = session.user.email;

  /* DATE CHANGE */

  if (dateInput) {
    dateInput.addEventListener('input', () => {

  clearTimeout(dateTimer);

  dateTimer = setTimeout(() => {
    loadMatches();
  }, 400);

});
  }

  /* INITIAL LOAD */

  setToday();

});


/* ===============================
   LOAD MATCHES
================================ */

async function loadMatches() {

  const dateInput = document.getElementById('date');
  const results = document.getElementById('results');
  const empty = document.getElementById('empty');

  results.innerHTML = '';
  empty.innerHTML = '';

  if (!currentUserEmail) {
    empty.innerText = 'User not loaded';
    return;
  }

  if (!dateInput.value) {
    empty.innerText = 'Please select a date';
    return;
  }

  const date = dateInput.value.split('T')[0];

  /* PREVENT DUPLICATE REQUESTS */

if (date === lastDateLoaded) return;
lastDateLoaded = date;

  /* HEADER DATE */

  const resultsDate = document.getElementById('resultsDate');
  if (resultsDate) resultsDate.innerText = formatDate(date);

  /* API */

  const url =
    `/api/matches/grouped` +
    `?email=${encodeURIComponent(currentUserEmail)}` +
    `&date=${encodeURIComponent(date)}`;

  let response;

  try {
    response = await fetch(url);
  } catch {
    empty.innerText = 'Cannot reach server';
    return;
  }

  if (!response.ok) {
    empty.innerText = 'Error loading matches';
    return;
  }

 const data = await response.json();
if (!data.length) {
  empty.innerText = "Your tour is hidden. Enable visibility in My Tours to see other travelers.";
  return;
}
  
 /* ===============================
   HERO CITY
================================ */

const cityName = document.getElementById('city-name');

if (Array.isArray(data) && data.length && cityName) {
  cityName.innerText = data[0].city;
}

if (!Array.isArray(data) || !data.length) {
  empty.innerText = 'No colleagues in this city for this date';
  return;
}

  /* CARDS */

  data.forEach(item => {

    if (!Array.isArray(item.people) || item.people.length === 0) return;

    const card = document.createElement('div');
    card.className = 'colleague-card';

    card.innerHTML = `
      <div class="card-city">${item.city}</div>

      <div class="card-date">
        ${formatDate(item.date)}
      </div>

      <div class="card-people">
        ${item.people.map(p => `
          <button
            class="person"
            onclick="openProfile(
              '${item.city}',
              '${item.date}',
              '${p.name.replace(/'/g,"\\'")}'
            )">
            ${p.name}
          </button>
        `).join('')}
      </div>
    `;

    results.appendChild(card);

  });

}


/* ===============================
   PROFILE
================================ */

async function openProfile(city, date, name) {

  const url =
    `/api/profile` +
    `?email=${encodeURIComponent(currentUserEmail)}` +
    `&name=${encodeURIComponent(name)}` +
    `&date=${date}` +
    `&city=${encodeURIComponent(city)}`;

  let response;

  try {
    response = await fetch(url);
  } catch {
    alert('Network error');
    return;
  }

  if (!response.ok) {
    alert('You can only view profiles if there is a real match');
    return;
  }

  const profile = await response.json();

  document.getElementById('profileName').innerText =
    profile.name || '';

  document.getElementById('profilePhone').innerText =
    profile.phone ? `📞 ${profile.phone}` : '📞 Phone not shared';

  document
    .getElementById('profileOverlay')
    .classList.remove('hidden');
}

function closeProfile(event) {

  if (!event || event.target.id === 'profileOverlay') {

    document
      .getElementById('profileOverlay')
      .classList.add('hidden');

  }

}


/* ===============================
   LOGOUT
================================ */

async function logout() {

  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';

}