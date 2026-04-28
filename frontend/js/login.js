import { login, signup, isLoggedIn } from './api.js';

// If already logged in, go to chat
if (isLoggedIn()) window.location.href = '/chat.html';

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

tabLogin.addEventListener('click', () => {
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  tabLogin.classList.add('bg-white/10', 'text-white');
  tabLogin.classList.remove('text-white/50');
  tabSignup.classList.remove('bg-white/10', 'text-white');
  tabSignup.classList.add('text-white/50');
});

tabSignup.addEventListener('click', () => {
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  tabSignup.classList.add('bg-white/10', 'text-white');
  tabSignup.classList.remove('text-white/50');
  tabLogin.classList.remove('bg-white/10', 'text-white');
  tabLogin.classList.add('text-white/50');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  err.classList.add('hidden');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Logging in...';

  try {
    await login(
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-password').value,
    );
    window.location.href = '/chat.html';
  } catch (ex) {
    err.textContent = ex.message || 'Login failed';
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Login';
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('signup-error');
  const success = document.getElementById('signup-success');
  const btn = document.getElementById('signup-btn');
  err.classList.add('hidden');
  success.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    await signup(
      document.getElementById('signup-email').value.trim(),
      document.getElementById('signup-password').value,
    );
    success.textContent = 'Account created! Check your email to confirm, then log in.';
    success.classList.remove('hidden');
    btn.textContent = 'Account Created';
  } catch (ex) {
    err.textContent = ex.message || 'Signup failed';
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});
