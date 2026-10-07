/* ============================================================
   HVID — AuthContext (Global Auth State Layer)
   Extends existing Auth object with reactive state:
     · token         — raw JWT from localStorage
     · identity_id   — persisted identity UUID
     · isAuthenticated — live-validated flag

   Contract (read-only from outside):
     AuthContext.get()          → { token, identity_id, isAuthenticated }
     AuthContext.onReady(fn)    → run fn once validation resolves
     AuthContext.refresh()      → re-validate against /api/auth/me

   This module NEVER modifies Auth logic — it only reads from it.
   ============================================================ */

'use strict';

(function defineAuthContext() {
  /* ── Private state ────────────────────────────────────────── */
  let _token          = null;
  let _identityId     = null;
  let _isAuthenticated = false;
  let _ready          = false;
  const _readyCbs     = [];

  /* ── Resolve from existing Auth object ────────────────────── */
  function _sync() {
    _token      = (window.Auth && Auth.getToken()) || null;
    _identityId = null;

    try {
      const sess  = window.Auth && Auth.getSession();
      _identityId = (sess && (sess.identity_id || sess.identityId)) || null;
    } catch (_) {}

    _isAuthenticated = !!_token;
  }

  /* ── Validate against /api/auth/me ───────────────────────── */
  async function _validate() {
    _sync();

    if (!_token) {
      _isAuthenticated = false;
      _settled();
      return;
    }

    try {
      const res = await fetch(`${window.HVID_API_BASE || '/api'}/auth/me`, {
        method:  'GET',
        headers: { 'Authorization': `Bearer ${_token}` },
      });

      if (res.ok) {
        const data  = await res.json();
        _identityId     = data.identity_id || _identityId;
        _isAuthenticated = true;
      } else {
        // 401 → token invalid; Auth's patchFetchFor401 already handles logout,
        // but we also clear state here for immediate consistency
        _isAuthenticated = false;
        _identityId      = null;
        _token           = null;
      }
    } catch (_) {
      // Network error — keep last known token/state (offline-tolerant)
    } finally {
      _settled();
    }
  }

  function _settled() {
    _ready = true;
    _readyCbs.forEach(fn => { try { fn(AuthContext.get()); } catch (_) {} });
    _readyCbs.length = 0;
  }

  /* ── Public API ───────────────────────────────────────────── */
  const AuthContext = {
    /**
     * Returns current auth state snapshot.
     * @returns {{ token: string|null, identity_id: string|null, isAuthenticated: boolean }}
     */
    get() {
      return {
        token:           _token,
        identity_id:     _identityId,
        isAuthenticated: _isAuthenticated,
      };
    },

    /**
     * Register a callback that fires once validation resolves.
     * If already ready, fires immediately (async-safe).
     * @param {function} fn  Called with AuthContext.get() result
     */
    onReady(fn) {
      if (_ready) {
        setTimeout(() => { try { fn(this.get()); } catch (_) {} }, 0);
      } else {
        _readyCbs.push(fn);
      }
    },

    /**
     * Re-validate the token against the backend.
     * Useful after login or to check if token expired mid-session.
     * @returns {Promise<{ token, identity_id, isAuthenticated }>}
     */
    async refresh() {
      _ready = false;
      await _validate();
      return this.get();
    },
  };

  window.AuthContext = AuthContext;

  /* ── Auto-init: validate on script load ──────────────────── */
  _validate();
})();
