// frontend/js/auth.js

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login.html';
}


/*=======================================REGISTER.HTML=======================================*/


const supabaseClient = supabase.createClient(
  'https://wbdlvxisyktesdylhlsg.supabase.co',
  'sb_publishable_siYPKtcJxDZRE-vRJ79gxA_e9vrmfUP'
);

let currentUser = null;
let availableRoutes = [];
let editingId = null;

const today = new Date();
today.setHours(0,0,0,0);

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

/* ===============================
   INIT
================================ */
window.addEventListener('DOMContentLoaded', async () => {

  const { data:{ session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = session.user;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('name, phone')
    .eq('id', currentUser.id)
    .single();

  if (profile) {
    if (profile.name) document.getElementById('name').value = profile.name;
    if (profile.phone) document.getElementById('phone').value = profile.phone;
  }

  await loadRoutes();
  await loadUserTours();
});


/* ===============================
   LOAD ROUTES
================================ */
async function loadRoutes() {

  const btn = document.getElementById('submitBtn');
  const select = document.getElementById('routeCode');

  try {
    const res = await fetch('/api/routes');
    const routes = await res.json();

    availableRoutes = routes.map(r => r.code);

    // Reset select
    select.innerHTML = '<option value="">Select tour</option>';

    routes.forEach(r => {
      const option = document.createElement('option');
      option.value = r.code;
      option.textContent = r.code;
      select.appendChild(option);
    });

    btn.disabled = false;
    btn.innerText = 'Add Tour';

  } catch {
    document.getElementById('message').innerHTML =
      '<div class="error">Failed to load routes</div>';
  }
}

/* ===============================
   LOAD USER TOURS
================================ */
async function loadUserTours() {

  const container = document.getElementById('userTours');
  container.innerHTML = 'Loading tours...';

  try {
    const res = await fetch(`/api/user-tours?email=${currentUser.email}`);
    const tours = await res.json();

    if (!tours.length) {
      container.innerHTML = '<p>No tours yet.</p>';
      return;
    }

    container.innerHTML = '';

    tours.forEach(tour => {

      const start = new Date(tour.start_date);
      const started = start < today;

      const div = document.createElement('div');
      div.className = 'tour-item';

      div.innerHTML = `
        <strong>${tour.route_code}</strong><br>
        ${formatDate(tour.start_date)} → ${formatDate(tour.end_date)}
        <br>
        <button onclick="openEdit(${tour.id}, '${tour.route_code}', '${tour.start_date}')"
          ${started ? 'disabled' : ''}>Edit</button>
        <button onclick="deleteTour(${tour.id})"
          ${started ? 'disabled' : ''}>Delete</button>
      `;

      container.appendChild(div);
    });

  } catch {
    container.innerHTML = '<p>Error loading tours</p>';
  }
}


/* ===============================
   REGISTER
================================ */
async function register() {

  const msg = document.getElementById('message');
  const btn = document.getElementById('submitBtn');
  msg.innerHTML = '';

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const routeCode = document.getElementById('routeCode').value.trim().toUpperCase();
  const startDate = document.getElementById('startDate').value;

  if (!name || !routeCode || !startDate) {
    msg.innerHTML = '<div class="error">All required fields must be filled</div>';
    return;
  }

  if (!availableRoutes.includes(routeCode)) {
    msg.innerHTML =
      `<div class="error">Tour code <strong>${routeCode}</strong> does not exist</div>`;
    return;
  }

  btn.disabled = true;

  await supabaseClient.from('profiles').upsert({
    id: currentUser.id,
    name,
    phone
  });

  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: currentUser.email,
      name,
      routeCode,
      startDate
    })
  });

  btn.disabled = false;

  if (res.ok) {
    msg.innerHTML = '<div class="success">Tour added successfully!</div>';
    document.getElementById('routeCode').value = '';
    document.getElementById('startDate').value = '';
    await loadUserTours();
  } else {
    msg.innerHTML = '<div class="error">Error adding tour</div>';
  }
}


/* ===============================
   DELETE
================================ */
async function deleteTour(id) {

  if (!confirm('Delete this tour?')) return;

  const res = await fetch(`/api/user-tours/${id}?email=${currentUser.email}`, {
    method: 'DELETE'
  });

  if (res.ok) {
    await loadUserTours();
  }
}


/* ===============================
   EDIT MODAL
================================ */
function openEdit(id, routeCode, startDate) {

  editingId = id;

  document.getElementById('editRouteCode').value = routeCode;
  document.getElementById('editStartDate').value =
    startDate.split('T')[0];

  document.getElementById('editModal').classList.remove('hidden');
}

function closeEdit(event) {
  if (!event || event.target.id === 'editModal') {
    document.getElementById('editModal').classList.add('hidden');
    document.getElementById('editMsg').innerHTML = '';
  }
}

async function saveEdit() {

  const routeCode =
    document.getElementById('editRouteCode').value.trim().toUpperCase();

  const startDate =
    document.getElementById('editStartDate').value;

  const res = await fetch(`/api/user-tours/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: currentUser.email,
      routeCode,
      startDate
    })
  });

  if (res.ok) {
    closeEdit();
    await loadUserTours();
  }
}


/* ===============================
   LOGOUT
================================ */
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}


/*=====================================INDEX.HTML==========================================*/


/* ===============================
   CONFIG
================================ */

const supabaseClient = supabase.createClient(
  'https://wbdlvxisyktesdylhlsg.supabase.co',
  'sb_publishable_siYPKtcJxDZRE-vRJ79gxA_e9vrmfUP'
);

let currentUserEmail = null;

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

  document.getElementById('date').value = today;

  await loadMatches(); // 👈 carga matches de hoy automáticamente
}

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
    card.className = 'card';

    card.innerHTML = `
      <div class="city">${item.city}</div>
      <div class="date">${formatDate(item.date)}</div>
      <div class="people">
        ${item.people.map(p => `
          <span class="person"
            onclick="openProfile(
              '${item.city}',
              '${item.date}',
              '${p.name.replace(/'/g, "\\'")}'
            )">
            ${p.name}
          </span>
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

/*==========================================================LOGIN.HTML=================================*/


  const supabaseClient = supabase.createClient(
    'https://wbdlvxisyktesdylhlsg.supabase.co',
    'sb_publishable_siYPKtcJxDZRE-vRJ79gxA_e9vrmfUP'
  );

  let mode = 'login';

  function toggleMode() {
    document.getElementById('message').innerText = '';

    if (mode === 'login') {
      mode = 'register';
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      title.innerText = 'Create account';
      toggleText.innerText = 'Already have an account? Sign in';
    } else {
      mode = 'login';
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      title.innerText = 'Sign in';
      toggleText.innerText = 'Create account';
    }
  }

  async function signIn() {
    const email = loginEmail.value;
    const password = loginPassword.value;
    const msg = document.getElementById('message');
    msg.innerText = '';

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      msg.innerText = error.message;
    } else {
      window.location.href = 'index.html';
    }
  }

  async function createAccount() {
    const email = regEmail.value;
    const password = regPassword.value;
    const name = regName.value;
    
/*============= INTERNATIONAL========*/
    /*===If error const phone = regPhone.value;====*/

    const countryCode = document.getElementById('countryCode').value;
const rawPhone = regPhone.value.replace(/\D/g, '');

let phone = null;

if (rawPhone) {
  phone = countryCode + rawPhone;
}

/*=============PHONE VALIDATION ===========*/
if (phone && !/^\+\d{8,15}$/.test(phone)) {
  msg.innerText = 'Invalid international phone number';
  return;
}
/*==================*/


    const msg = document.getElementById('message');
    msg.innerText = '';

    if (!email || !password || !name) {
      msg.innerText = 'Please fill all required fields';
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (error) {
      msg.innerText = error.message;
      return;
    }

    await supabaseClient.from('profiles').insert({
      id: data.user.id,
      name,
      phone
    });

    window.location.href = 'index.html';
  }

  async function forgotPassword() {
    const email = loginEmail.value;
    const msg = document.getElementById('message');
    msg.innerText = '';

    if (!email) {
      msg.innerText = 'Enter your email first';
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

    msg.innerText = error
      ? error.message
      : 'Password reset email sent';
  }


/*========================================================RESET.HTML====================================*/
  
  const supabaseClient = supabase.createClient(
    'https://wbdlvxisyktesdylhlsg.supabase.co',
    'sb_publishable_siYPKtcJxDZRE-vRJ79gxA_e9vrmfUP'
  );

  let ready = false;

  // 🔑 Esperar a que Supabase procese el token del email
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      ready = true;
      console.log('Recovery session ready');
    }
  });

  async function updatePassword() {
    const password = document.getElementById('newPassword').value;
    const msg = document.getElementById('msg');

    if (!password) {
      msg.innerText = 'Password required';
      return;
    }

    if (!ready) {
      msg.innerText = 'Please wait a second and try again';
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({
      password
    });

    if (error) {
      msg.innerText = error.message;
    } else {
      msg.innerText = 'Password updated. Redirecting...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    }
  }

