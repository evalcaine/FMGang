
let currentUser = null;
let availableRoutes = [];
let editingId = null;

const today = new Date();
today.setHours(0,0,0,0);

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

/* ===============================
   HELPER
================================ */
function showConfirm(title, message) {
  return new Promise((resolve) => {

    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    titleEl.innerText = title;
    messageEl.innerText = message;

    modal.classList.remove('hidden');

    // 🔒 Block background scroll
    document.body.style.overflow = 'hidden';

    function cleanup(result) {
      modal.classList.add('hidden');

      // 🔓 Restore scroll
      document.body.style.overflow = '';

      okBtn.removeEventListener('click', okHandler);
      cancelBtn.removeEventListener('click', cancelHandler);

      resolve(result);
    }

    function okHandler() {
      cleanup(true);
    }

    function cancelHandler() {
      cleanup(false);
    }

    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', cancelHandler);
  });
}

/* ===============================
   INIT
================================ */
window.addEventListener('DOMContentLoaded', async () => {

  // 🛑 GUARD — only run on register page
  if (!document.getElementById('routeCode')) return;

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

const colorIndex = tour.route_code.charCodeAt(0) % 5;
const colorClass = `tour-dot-${colorIndex + 1}`;

div.innerHTML = `

<div class="tour-color-dot ${colorClass}"></div>

<div class="tour-info">

<strong>${tour.route_code}</strong>

<span>
${formatDate(tour.start_date)} → ${formatDate(tour.end_date)}
</span>

</div>

<div class="tour-actions">

<button
onclick="openEdit(${tour.id}, '${tour.route_code}', '${tour.start_date}')"
${started ? 'disabled' : ''}>
Edit
</button>

<button
onclick="deleteTour(${tour.id})"
${started ? 'disabled' : ''}>
Delete
</button>

</div>

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

  try {

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

    let data = {};
    try {
      data = await res.json();
    } catch {}

    btn.disabled = false;

    if (res.ok) {

      msg.innerHTML = '<div class="success">Tour added!</div>';

      document.getElementById('routeCode').value = '';
      document.getElementById('startDate').value = '';

      await loadUserTours();

    } else {

      msg.innerHTML =
        `<div class="error">${data.error || "Server error"}</div>`;

    }

  } catch (err) {

    console.error(err);

    btn.disabled = false;
    msg.innerHTML = '<div class="error">Server connection failed</div>';

  }
}


/* ===============================
   DELETE
================================ */
async function deleteTour(id) {

  const confirmed = await showConfirm(
    "Delete tour?",
    "This action cannot be undone."
  );

  if (!confirmed) return;

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
