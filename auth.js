/**
 * auth.js
 * -----------------------------------------------------------------------
 * DEMO-ONLY client-side "login." There is no backend and no real access
 * control -- the credentials and the check itself are fully visible to
 * anyone who views source or opens dev tools. This exists purely to
 * demonstrate the login -> redirect -> gated-content UX. Do not treat
 * this as real security, and do not put anything here you wouldn't want
 * publicly visible until it's replaced with a real auth provider
 * (Clerk/Auth0/Firebase Auth, etc.) and a real backend.
 * -----------------------------------------------------------------------
 */

const DEMO_USERNAME = 'user';
const DEMO_PASSWORD = 'password';
const AUTH_KEY = 'olo_demo_authed';

function isLoggedIn() {
  return window.localStorage.getItem(AUTH_KEY) === 'true';
}

function attemptLogin(username, password) {
  if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
    window.localStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

function logout() {
  window.localStorage.removeItem(AUTH_KEY);
}

/**
 * Call this as early as possible (synchronously, in <head>) on any page
 * that requires login. If the user isn't "logged in," redirect to the
 * login page immediately, carrying along where to return to afterward.
 *
 * @param {string} loginPagePath - relative path from THIS page to login.html
 * @param {string} redirectBackTo - path (relative to the site root) to
 *   return to after a successful login
 */
function requireAuth(loginPagePath, redirectBackTo) {
  if (!isLoggedIn()) {
    window.location.replace(
      `${loginPagePath}?redirect=${encodeURIComponent(redirectBackTo)}`,
    );
  }
}

/**
 * Finds any element marked data-auth-nav and fills it with either a
 * "Login" link or a "Logged in as user / Log out" control, depending on
 * auth state. Each such element should carry data-root="" (site root
 * pages) or data-root="../" (one level down, e.g. trial-calendar/).
 */
function renderAuthNav() {
  document.querySelectorAll('[data-auth-nav]').forEach((el) => {
    const rootPath = el.getAttribute('data-root') || '';
    if (isLoggedIn()) {
      el.innerHTML = '<span class="auth-status">Logged in as <strong>user</strong></span><a href="#" class="auth-logout">Log out</a>';
      const logoutLink = el.querySelector('.auth-logout');
      if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
          e.preventDefault();
          logout();
          window.location.href = `${rootPath}index.html`;
        });
      }
    } else {
      el.innerHTML = `<a href="${rootPath}login.html">Login</a>`;
    }
  });
}

document.addEventListener('DOMContentLoaded', renderAuthNav);
