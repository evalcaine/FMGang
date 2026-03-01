document.addEventListener('DOMContentLoaded', () => {

  // 🛑 GUARD — only run on login page
  if (!document.getElementById('loginEmail')) return; // not login page

  let mode = 'login';

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const title = document.getElementById('title');
  const toggleText = document.getElementById('toggleText');
  const message = document.getElementById('message');

  document.getElementById('toggleMode').addEventListener('click', toggleMode);
  document.getElementById('signInBtn').addEventListener('click', signIn);
  document.getElementById('createBtn').addEventListener('click', createAccount);
  document.getElementById('forgotBtn').addEventListener('click', forgotPassword);

  function toggleMode() {
    message.innerText = '';

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
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginEmail.value,
      password: document.getElementById('loginPassword').value
    });

    if (error) message.innerText = error.message;
    else window.location.href = 'index.html';
  }

  async function createAccount() {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const name = document.getElementById('regName').value;

    if (!email || !password || !name) {
      message.innerText = 'Please fill all required fields';
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      message.innerText = error.message;
      return;
    }

    await supabaseClient.from('profiles').insert({
      id: data.user.id,
      name
    });

    window.location.href = 'index.html';
  }

  async function forgotPassword() {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(loginEmail.value);
    message.innerText = error ? error.message : 'Password reset email sent';
  }

});