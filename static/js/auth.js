/* ============================================================
   HVID — Auth State Management
   Simulated auth via localStorage (no backend)
   ============================================================ */

'use strict';

// ── Identity state constants ─────────────────────────────────
const IDENTITY_STATES = {
  UNVERIFIED:       'UNVERIFIED',
  VERIFIED:         'VERIFIED',
  LIMITED:          'LIMITED',
  SUSPENDED:        'SUSPENDED',
  REVERIFY_REQUIRED:'REVERIFY_REQUIRED',
  REVOKED:          'REVOKED',
};

// ── Verification level labels ────────────────────────────────
const VERIFICATION_LEVELS = {
  0: 'Unverified',
  1: 'Basic',
  2: 'Strong',
  3: 'High Assurance',
};

const Auth = {
  STORAGE_KEY: 'hvid_session',
  TOKEN_KEY:   'hvid_token',

  /** Get stored JWT token */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || null;
  },

  /** Store JWT token */
  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  /** Clear JWT token */
  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  /** Authorization header for protected API calls */
  apiHeaders() {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  /** Check if a user session exists (JWT token only — email session check removed) */
  isLoggedIn() {
    return !!this.getToken();
    // CLEANUP M1: removed legacy email-session check:
    // try {
    //   const s = localStorage.getItem(this.STORAGE_KEY);
    //   return !!s && !!JSON.parse(s).email;
    // } catch { return false; }
  },

  /** Get current session data */
  getSession() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || null;
    } catch { return null; }
  },

  /** Get identity state string */
  getIdentityState() {
    const s = this.getSession();
    return s ? (s.identityState || IDENTITY_STATES.UNVERIFIED) : null;
  },

  /** Get verification level (0–3) */
  getVerificationLevel() {
    const s = this.getSession();
    return s ? (s.verificationLevel || 0) : 0;
  },

  /** Update identity state + optional level. Persists to session. */
  updateIdentity({ state, level, lastVerifiedAt } = {}) {
    const s = this.getSession();
    if (!s) return;
    if (state) s.identityState = state;
    if (typeof level === 'number') s.verificationLevel = level;
    if (lastVerifiedAt) s.lastVerifiedAt = lastVerifiedAt;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s));
  },

  /** Create a new session from OTP verify response */
  loginWithToken(token, identityId, extras = {}) {
    this.setToken(token);
    const session = {
      identity_id:        identityId,
      identityId:         identityId,
      hvid:               identityId,
      loginAt:            new Date().toISOString(),
      createdAt:          new Date().toISOString(),
      // Map snake_case API fields → camelCase session fields
      identityState:      extras.identity_state      || extras.identityState      || IDENTITY_STATES.UNVERIFIED,
      verificationLevel:  extras.verification_level  != null ? extras.verification_level : (extras.verificationLevel || 0),
      trust_signal:       extras.trust_signal        || 'UNVERIFIED',
      tier:               extras.tier                || 'FREE',
      identityType:       extras.identity_type      || extras.identityType      || 'PERSONAL',
      identity_type:      extras.identity_type      || extras.identityType      || 'PERSONAL',
      account_type:       extras.account_type       || extras.identity_type    || extras.identityType || 'PERSONAL',
      username:           extras.username            || null,
      email:              extras.email               || null,
      phone_last4:        extras.phone_last4         || null,
      phone:              extras.phone               || null,
      lastVerifiedAt:     extras.last_verified_at    || extras.lastVerifiedAt    || null,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('hvid_identity_id', identityId);
    return session;
  },

  // CLEANUP M1: Legacy email/password demo login REMOVED.
  // This created a fake session with a random HVID and no real backend.
  // login(email, name) { ... }

  /** Destroy session and token */
  logout() {
    // Clear user-scoped KYC personal details before wiping the session
    try {
      const sess = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      const uid  = sess.identity_id || sess.identityId;
      if (uid) localStorage.removeItem('hvid_kyc_personal_details_' + uid);
    } catch(e) {}
    // Clear legacy unscoped key
    localStorage.removeItem('hvid_kyc_personal_details');
    // Clear all auth state
    this.clearToken();
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('hvid_identity_id');
    // Clear any pending phone from OTP flow
    sessionStorage.removeItem('hvid_pending_phone');
    // Clear verification step state
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('hvid_verification_step'));
      keys.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
  },

  /** Redirect to login if not authenticated */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = this._loginPath();
      return false;
    }
    return true;
  },

  /** Redirect to dashboard if already authenticated — validates token with backend first */
  redirectIfAuthed() {
    const token = this.getToken();
    if (!token) return; // no token, stay on login page

    // Validate token with backend before redirecting — prevents stale token bypass
    fetch(`${window.HVID_API_BASE || '/api'}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.ok) {
        window.location.href = this._dashPath();
      } else {
        // Token is invalid/expired — clear it so the login form works fresh
        this.logout();
      }
    }).catch(() => {
      // Backend unreachable — stay on login page, don't redirect
    });
  },

  _loginPath() {
    return '/auth/login';
  },

  _dashPath() {
    return '/dashboard';
  },
};

window.Auth = Auth;
window.IDENTITY_STATES = IDENTITY_STATES;
window.VERIFICATION_LEVELS = VERIFICATION_LEVELS;

// ── Auto-logout on 401 (expired token) ─────────────────────
(function patchFetchFor401() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const resp = await originalFetch.apply(this, args);
    if (resp.status === 401 && Auth.getToken()) {
      Auth.logout();
      window.location.href = Auth._loginPath();
    }
    return resp;
  };
})();


// ── OTP Login form handler (login.html) ────────────────────
(function initLoginForm() {
  const form = document.getElementById('auth-form');
  if (!form) return;

  const mode = form.dataset.authMode || 'login';
  const usernameEl = document.getElementById('username');
  const countryCodeEl = document.getElementById('country-code');
  const phoneNumberEl = document.getElementById('phone-number');
  const otpEl = document.getElementById('otp');
  const errEl = document.getElementById('form-error');
  const btn = form.querySelector('.auth-btn-full');
  const step1 = document.getElementById('otp-step-1');
  const step2 = document.getElementById('otp-step-2');

  // Always start fresh — never carry over a pending phone from a previous session
  sessionStorage.removeItem('hvid_pending_phone');
  let currentPhone = '';
  let currentUsername = '';
  let currentAccountType = 'INDIVIDUAL';

  const requestedAccountType = new URLSearchParams(window.location.search).get('account_type');
  if (mode === 'signup' && (requestedAccountType === 'BUSINESS' || requestedAccountType === 'INDIVIDUAL')) {
    const accountInput = form.querySelector(`input[name="account_type"][value="${requestedAccountType}"]`);
    if (accountInput) accountInput.checked = true;
  }

  function buildPhone() {
    if (!phoneNumberEl || !countryCodeEl) return '';
    const raw = (phoneNumberEl.value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+')) {
      return raw.replace(/\s+/g, '');
    }
    const country = (countryCodeEl.value || '+1').trim();
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
    return `${country}${digits}`;
  }

  function getEnteredOtp() {
    // Read from all individual digit inputs first
    const digitInputs = document.querySelectorAll('.otp-digit');
    if (digitInputs.length === 6) {
      const code = Array.from(digitInputs).map(d => d.value).join('').replace(/\D/g, '');
      if (code) return code;
    }
    // Fallback: hidden inputs
    const otpRealEl = document.getElementById('otp-real');
    const otpEl     = document.getElementById('otp');
    return (otpRealEl?.value?.trim() || otpEl?.value?.trim() || '').replace(/\D/g, '');
  }

  function isOtpStepVisible() {
    if (!step2) return false;
    return window.HVIDAuthUtils?.isOtpStepVisible(step2)
      || getComputedStyle(step2).display !== 'none'
      || step2.getAttribute('aria-hidden') === 'false';
  }

  function showError(msg) {
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
      errEl.style.display = 'block';
    }
  }
  function clearError() {
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('visible');
      errEl.style.display = 'none';
    }
  }

  async function handleAuthSubmit(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    clearError();

    // Debug helper: log invocation and current state
    try {
      console.log('[AUTH] handleAuthSubmit invoked', {
        isOtpStepVisible: isOtpStepVisible(),
        phonePreview: buildPhone(),
        username: (usernameEl?.value || null),
        authMode: mode,
      });
    } catch (_) {}

    // Step 1: Request OTP
    if (!isOtpStepVisible()) {
      const phone = buildPhone();
      if (!phone) { showError('Please enter your phone number.'); return; }
      if (!/^\+\d{6,15}$/.test(phone)) {
        showError('Please enter a valid phone number with country code.');
        return;
      }

      if (mode === 'signup') {
        const username = (usernameEl?.value || '').trim();
        if (!username) {
          showError('Please enter a username to create your account.');
          return;
        }
        currentUsername = username;
        currentAccountType = form.querySelector('input[name="account_type"]:checked')?.value || 'INDIVIDUAL';
      } else {
        currentAccountType = '';
      }

      btn.textContent = 'Sending code…';
      btn.disabled = true;
      btn.classList.add('loading');
      
      try {
        const r = await fetch(`${window.HVID_API_BASE || '/api'}/auth/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, account_type: currentAccountType, mode }),
        });
        
        const d = await r.json();
        
        if (!r.ok) {
          const errorMsg = d.message || d.error || 'Could not send code. Please try again.';
          showError(errorMsg);
          if (r.status === 404 && d.create_url) {
            const link = document.createElement('a');
            link.href = `${d.create_url}?account_type=${encodeURIComponent(currentAccountType)}`;
            link.textContent = `Create ${currentAccountType === 'BUSINESS' ? 'Business' : 'Individual'} account`;
            link.style.cssText = 'display:block;margin:10px auto 0;text-align:center;color:#818cf8;font-weight:600;';
            errEl?.appendChild(link);
          } else if (r.status === 409 && d.login_url) {
            const link = document.createElement('a');
            link.href = d.login_url;
            link.textContent = 'Sign in with your existing account';
            link.style.cssText = 'display:block;margin:10px auto 0;text-align:center;color:#818cf8;font-weight:600;';
            errEl?.appendChild(link);
          }
          btn.textContent = 'Send Code';
          btn.disabled = false;
          btn.classList.remove('loading');
          return;
        }

        if (mode === 'login' && d.account_type) {
          currentAccountType = d.account_type;
        }
        
        // Success - show step 2
        currentPhone = phone;
        sessionStorage.setItem('hvid_pending_phone', phone);
        if (step1) step1.style.display = 'none';
        if (step2) {
          step2.style.display = 'block';
          step2.setAttribute('aria-hidden', 'false');
        }
        btn.textContent = 'Verify Code';
        btn.disabled = false;
        btn.classList.remove('loading');
        
        // Show success message
        if (window.HVID?.toast) {
          window.HVID.toast('Verification code sent! Check your phone.', 'success');
        }
        
        // Focus OTP input
        setTimeout(() => {
          const otpRealEl = document.getElementById('otp-real');
          if (otpRealEl) otpRealEl.focus();
        }, 100);
        
      } catch (err) {
        console.error('OTP request error:', err);
        showError('Unable to reach server. Please check if the backend is running on http://localhost:3000');
        btn.textContent = 'Send Code';
        btn.disabled = false;
        btn.classList.remove('loading');
      }
      return;
    }

    // Step 2: Verify OTP
    const otp = getEnteredOtp();
    if (!otp || otp.length !== 6) { 
      showError('Please enter the complete 6-digit code.'); 
      return; 
    }
    
    btn.textContent = 'Verifying…';
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
      const r = await fetch(`${window.HVID_API_BASE || '/api'}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, otp, account_type: currentAccountType, username: currentUsername }),
      });
      
      const d = await r.json();
      
      if (!r.ok) {
        const errorMsg = d.message || d.error || 'Invalid verification code. Please try again.';
        showError(errorMsg);
        btn.textContent = 'Verify Code';
        btn.disabled = false;
        btn.classList.remove('loading');
        
        // Clear OTP input for retry
        const otpRealEl = document.getElementById('otp-real');
        if (otpRealEl) {
          otpRealEl.value = '';
          otpRealEl.focus();
        }
        if (otpEl) otpEl.value = '';
        return;
      }
      
      // Success! Store token + create session
      if (!d.token || !d.identity_id) {
        showError('Invalid response from server. Please try again.');
        btn.textContent = 'Verify Code';
        btn.disabled = false;
        btn.classList.remove('loading');
        return;
      }
      
      Auth.loginWithToken(d.token, d.identity_id, {
        phone:              currentPhone,
        username:           currentUsername || d.username || null,
        email:              d.email || null,
        identity_type:      d.identity_type || null,
        account_type:       d.identity_type || currentAccountType,
        identity_state:     d.identity_state,
        verification_level: d.verification_level,
        trust_signal:       d.trust_signal,
        tier:               d.tier,
        phone_last4:        d.phone_last4 || currentPhone.slice(-4),
        last_verified_at:   d.last_verified_at || null,
        is_new:             d.is_new,
      });
      sessionStorage.removeItem('hvid_pending_phone');
      
      // Show success message
      if (window.HVID?.toast) {
        window.HVID.toast('Login successful! Redirecting...', 'success');
      }
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = Auth._dashPath();
      }, 500);
      
    } catch (err) {
      console.error('OTP verification error:', err);
      showError('Unable to verify. Please check if the backend is running.');
      btn.textContent = 'Verify Code';
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  form.addEventListener('submit', handleAuthSubmit);

  // Back to phone step
  const backBtn = document.getElementById('otp-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    btn.textContent = 'Send Code';
    currentPhone = '';
    sessionStorage.removeItem('hvid_pending_phone');
    clearError();
  });
})();

// CLEANUP M1: Email/password signup handler REMOVED.
// Previously: collected name, email, password → called Auth.login(email, name)
// → created a fake session with hardcoded random HVID, no backend involved.
// The signup.html form UI is left intact for future phone-OTP signup wiring.
//
// (function initSignupForm() { ... })();

// CLEANUP M1: Password visibility toggle REMOVED.
// Existed solely to support the removed email/password signup form.
// (function initPasswordToggle() { ... })();
