/* ===============================
   HELPERS
================================ */

function formatDate(dateString) {
  const date = new Date(dateString);

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

async function setToday() {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');

  const today = `${yyyy}-${mm}-${dd}`;

  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.value = today;
  }
}

/* ===============================
   INIT
================================ */

document.addEventListener('DOMContentLoaded', async () => {

  const results = document.getElementById('results');

  // 🛑 Guard
  if (!results) return;

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUserEmail = session.user.email;

    await setToday();
  await loadMatches();   // ✅ controlled call
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

  // update header date label
  const resultsDate = document.getElementById('resultsDate');
  if (resultsDate) {
    resultsDate.innerText = formatDate(date);
  }

  const url =
    `/matches/grouped` +
    `?email=${encodeURIComponent(currentUserEmail)}` +
    `&date=${encodeURIComponent(date)}`;

  let response;

  try {
    response = await fetch(`/api${url}`);
  } catch (err) {
    console.error('Network error:', err);
    empty.innerText = 'Cannot reach server';
    return;
  }

  if (!response.ok) {
    empty.innerText = 'Error loading matches';
    return;
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    empty.innerText = 'No matches found';
    return;
  }

  data.forEach(item => {

    if (!item.people || item.people.length === 0) return;

    const card = document.createElement('div');
    card.className = 'colleague-card';

    card.innerHTML = `
      <div class="card-city">
        ${item.city}
      </div>

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
   OPEN PROFILE
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
  } catch (err) {
    alert('Network error');
    return;
  }

  if (!response.ok) {
    alert('You can only view profiles if there is a real match');
    return;
  }

  const profile = await response.json();

  document.getElementById('profileName').innerText = profile.name || '';
  document.getElementById('profilePhone').innerText =
    profile.phone ? `📞 ${profile.phone}` : '📞 Phone not shared';

  document.getElementById('profileOverlay').classList.remove('hidden');
}

function closeProfile(event) {
  if (!event || event.target.id === 'profileOverlay') {
    document.getElementById('profileOverlay').classList.add('hidden');
  }
}

/* ===============================
   LOGOUT
================================ */

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

/* ===============================
   INIT
================================ */

window.addEventListener('DOMContentLoaded', async () => {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUserEmail = session.user.email;

  setToday(); // this already calls loadMatches()

});