/* ============================================================
   HVID — Protected Route Guard
   Wraps existing Auth.requireAuth() and adds token validation.

   Usage (add to top of any dashboard/protected page scripts):
     <script src="../js/app.js"></script>
     <script src="../js/auth.js"></script>
     <script src="../js/auth-context.js"></script>
     <script src="../js/protected-route.js"></script>

   Behaviour:
     1. Checks Auth.isLoggedIn() — if false, redirect to login immediately.
     2. If token present, validates via /api/auth/me.
     3. On 401 response: clears session, redirects to login.
     4. On success: sets window.__HVID_AUTH_READY = true so page JS can proceed.
     5. Dispatches CustomEvent 'hvid:auth-ready' on document.

   Routes protected by this script:
     /dashboard/*  /verify.html  /security.html
   ============================================================ */

'use strict';

(function initProtectedRoute() {

  /* ── Helpers ─────────────────────────────────────────────── */
  function _loginPath() {
    return '/auth/login';
  }

  function _redirectToLogin(reason) {
    // eslint-disable-next-line no-console
    console.info('[HVID] Protected route — redirecting to login:', reason);
    window.location.href = _loginPath();
  }

  /* ── Step 1: Immediate guard (sync) ─────────────────────── */
  if (!window.Auth || !Auth.isLoggedIn()) {
    _redirectToLogin('no session');
    return; // stop all further execution
  }

  /* ── Step 2: Token validation (async) ──────────────────── */
  const token = Auth.getToken();

  if (!token) {
    // Legacy session only (no JWT) — allow through in offline/dev mode
    window.__HVID_AUTH_READY = true;
    document.dispatchEvent(new CustomEvent('hvid:auth-ready', {
      detail: { identityId: null, phone: null, isAuthenticated: false },
    }));
    return;
  }

  // Non-blocking: page renders, then validates
  (async function validate() {
    try {
const res = await fetch(`${window.HVID_API_BASE || '/api'}/auth/me`, {
        method:  'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        Auth.logout();
        _redirectToLogin('token expired');
        return;
      }

      if (res.ok) {
        const data = await res.json();

        // ── Sync full identity data back into stored session ──
        try {
          const stored = JSON.parse(localStorage.getItem('hvid_session') || '{}');
          stored.identity_id        = data.identity_id  || stored.identity_id;
          stored.identityId         = data.identity_id  || stored.identityId;
          stored.hvid               = data.identity_id  || stored.hvid;
          stored.username           = data.username     || stored.username || null;
          stored.phone_last4        = data.phone_last4  || stored.phone_last4 || null;
          stored.identityState      = data.identity_state      || stored.identityState      || 'UNVERIFIED';
          stored.verificationLevel  = data.verification_level  != null ? data.verification_level : (stored.verificationLevel || 0);
          stored.trust_signal       = data.trust_signal        || stored.trust_signal        || 'UNVERIFIED';
          stored.tier               = data.tier                || stored.tier                || 'FREE';
          localStorage.setItem('hvid_session', JSON.stringify(stored));
        } catch (_) {}

        window.__HVID_AUTH_READY = true;
        document.dispatchEvent(new CustomEvent('hvid:auth-ready', {
          detail: {
            identityId:         data.identity_id,
            username:           data.username,
            phone_last4:        data.phone_last4,
            identityState:      data.identity_state,
            verificationLevel:  data.verification_level,
            tier:               data.tier,
            isAuthenticated:    true,
          },
        }));
      }
      // Non-401 errors (network/5xx) — allow through optimistically
    } catch (_) {
      // Offline / backend down — allow through
      window.__HVID_AUTH_READY = true;
      document.dispatchEvent(new CustomEvent('hvid:auth-ready', {
        detail: { identityId: null, phone: null, isAuthenticated: false },
      }));
    }
  })();

})();
