/**
 * Client-side UAA Auth Check for static SPA pages.
 * 
 * This script checks for a ua_session cookie and validates it against UAA.
 * If not authenticated, redirects to UAA login with the app slug.
 * 
 * Usage: Include this script as the FIRST element in <head> of index.html:
 *   <script src="/ua-auth.js" data-app="vtop"></script>
 *
 * The data-app attribute specifies the UAA app slug.
 */
(function() {
  var APP_SLUG = (document.currentScript && document.currentScript.getAttribute('data-app')) || 'unknown';
  var UA_ORIGIN = 'https://unified-access-auth-woad.vercel.app';
  var COOKIE_NAME = 'ua_session';

  // Check for ua_token in URL (callback from UAA)
  var urlParams = new URLSearchParams(window.location.search);
  var uaToken = urlParams.get('ua_token');

  if (uaToken) {
    // Set cookie and clean URL
    document.cookie = COOKIE_NAME + '=' + uaToken + '; path=/; max-age=' + (30 * 24 * 60 * 60) + '; Secure; SameSite=Lax';
    // Remove ua_token and returnTo from URL
    urlParams.delete('ua_token');
    urlParams.delete('returnTo');
    var cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', cleanUrl);
    // Continue loading the page
    return;
  }

  // Check for existing cookie
  var cookies = document.cookie.split(';');
  var sessionToken = null;
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.startsWith(COOKIE_NAME + '=')) {
      sessionToken = c.substring(COOKIE_NAME.length + 1);
      break;
    }
  }

  if (sessionToken) {
    // Validate token with UAA
    fetch(UA_ORIGIN + '/api/auth/validate?app=' + APP_SLUG, {
      headers: { 'Authorization': 'Bearer ' + sessionToken }
    }).then(function(res) {
      if (res.ok) {
        return res.json();
      }
      throw new Error('Invalid session');
    }).then(function(data) {
      if (data.ok) {
        // Valid session — show page content
        document.documentElement.classList.add('ua-authenticated');
        document.documentElement.setAttribute('data-ua-user', data.user.email);
        document.documentElement.setAttribute('data-ua-role', data.role);
        // Dispatch event for app to use
        window.dispatchEvent(new CustomEvent('ua-auth', { detail: data }));
      } else {
        // Access denied — redirect to UAA for fresh login
        clearCookieAndRedirect();
      }
    }).catch(function(e) {
      // Network error or invalid session — redirect to UAA
      clearCookieAndRedirect();
    });
  } else {
    // No cookie — redirect to UAA login
    clearCookieAndRedirect();
  }

  function clearCookieAndRedirect() {
    document.cookie = COOKIE_NAME + '=; path=/; max-age=0; Secure; SameSite=Lax';
    var loginUrl = UA_ORIGIN + '/?app=' + APP_SLUG + '&returnTo=' + encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = loginUrl;
  }

  // Hide page content until auth is confirmed — prevents flash of content
  document.write('<style>html:not(.ua-authenticated) .ua-protected { visibility: hidden; } html:not(.ua-authenticated) body > *:not(script):not(style) { visibility: hidden; } html.ua-authenticated body > * { visibility: visible; }</style>');
})();