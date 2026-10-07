/**
 * api.js — HVID Unified API Layer
 *
 * Single source of truth for all backend API calls.
 * Built from confirmed controllers only — NO invented endpoints.
 *
 * BASE URL: /api  (same-origin; adjust API_BASE for cross-origin dev)
 *
 * TOKEN: stored in localStorage under 'hvid_token' (Auth.TOKEN_KEY)
 * All authenticated requests include: Authorization: Bearer <token>
 *
 * ── CONFIRMED ENDPOINTS ─────────────────────────────────────────
 *
 * AUTH
 *   POST /api/auth/request-otp   { phone }             → { message }
 *   POST /api/auth/verify-otp    { phone, otp }        → { token, identity_id }
 *
 * IDENTITY
 *   GET  /api/identity/:id                             → { id, status, verificationLevel, identity_type, trust_signal, tier, assets[] }
 *   PATCH /api/identity/:id/type { type }              → { id, identity_type, trust_signal, status }
 *
 * MATCH
 *   POST /api/match/check        { type?, value?, query? }
 *                                → { result_type, signal, verification_level, identity_type }
 *
 * REPORT
 *   POST /api/report/submit      { reporter_identity_id?, target_identity_id?,
 *                                  target_asset_id?, report_type, description?, evidence_urls? }
 *                                → { success, report_id, status }
 *
 * KYC
 *   POST /api/kyc/submit         { identity_id, document_type, document_urls[] }
 *                                → { kyc_id, status }
 *   GET  /api/kyc/status?identityId=  → { kyc_id, status, document_type, createdAt, updatedAt }
 *
 * SECURITY
 *   GET  /api/security/status/:identityId → { status, lastActivity, flagCount }
 *   POST /api/security/recover/start      { identity_id } → { success, ... }
 *   POST /api/security/recover/complete   { identity_id } → { success, message }
 *
 * ASSET  (all require Bearer token — identityId from JWT, never from body)
 *   POST /api/asset/claim            { type, value }           → { assetId, type, verificationStatus, verificationCode, instructions }
 *   POST /api/asset/verify/instagram { assetId, handle }       → { success, message }
 *   POST /api/asset/verify/website   { assetId, domain }       → { success, message, method? }
 *   GET  /api/asset/:identityId                                → AssetPublicView[]
 *
 * ── GAPS (endpoints referenced in frontend but not yet wired) ────
 *   POST /api/face/start         — controller not found (referenced in verification-flow.js)
 *   GET  /api/face/status        — controller not found (referenced in verification-flow.js)
 *
 * ── PREVIOUSLY NOTED AS GAP (now confirmed wired) ─────────────────
 *   GET  /api/auth/me            — EXISTS in auth.controller.ts (JwtAuthGuard protected)
 *   POST /api/kyc/start          — EXISTS in kyc.controller.ts (JwtAuthGuard protected)
 *
 * ── ERROR HANDLING ───────────────────────────────────────────────
 *   401 → clear token + redirect to //auth/login
 *   403 → return { __enforced: true, required_level }  (caller shows modal)
 *   429 → return { __rateLimit: true, retryAfter }
 *   500 → return { __serverError: true, message }
 */
'use strict';

const API_BASE = '/api';
window.HVID_API_BASE = API_BASE;

// ── Token helpers (delegates to Auth if available) ───────────────
const _token = {
  get()    { return (window.Auth?.getToken?.()) || localStorage.getItem('hvid_token') || null; },
  set(t)   { (window.Auth?.setToken?.(t)) || localStorage.setItem('hvid_token', t); },
  clear()  { (window.Auth?.clearToken?.()) || localStorage.removeItem('hvid_token'); },
};

// ── Base fetch wrapper ───────────────────────────────────────────
async function _request(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = _token.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.headers) Object.assign(headers, opts.headers);

  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    // Network failure
    return { __networkError: true, message: 'Unable to reach server. Check your connection.' };
  }

  // ── Error status handling ──────────────────────────────────────
  if (res.status === 401) {
    _token.clear();
    if (!opts.suppress401) {
      window.location.href = '/auth/login';
    }
    return { __unauthorized: true };
  }

  if (res.status === 403) {
    let payload = {};
    try { payload = await res.json(); } catch {}
    return { __enforced: true, ...payload };
  }

  if (res.status === 429) {
    let payload = {};
    try { payload = await res.json(); } catch {}
    // Treat rate limit same as a regular error — show the message
    return { __error: true, message: payload.error || payload.message || 'Too many requests. Please try again shortly.', ...payload };
  }

  if (res.status >= 500) {
    return { __serverError: true, message: 'Something went wrong. Please try again later.' };
  }

  // ── Happy path ─────────────────────────────────────────────────
  try {
    return res.status === 204 ? {} : await res.json();
  } catch {
    return {};
  }
}

// ── Public API object ────────────────────────────────────────────
const HVID_API = {

  // ── AUTH ────────────────────────────────────────────────────────
  auth: {
    /**
     * POST /api/auth/request-otp
     * @param {string} phone  - E.164 format recommended
     * @returns {{ message: string } | ErrorShape}
     */
    requestOtp(phone) {
      return _request('POST', '/auth/request-otp', { phone });
    },

    /**
     * POST /api/auth/verify-otp
     * On success: stores token automatically.
     * @param {string} phone
     * @param {string} otp
     * @returns {{ token: string, identity_id: string } | ErrorShape}
     */
    async verifyOtp(phone, otp) {
      const res = await _request('POST', '/auth/verify-otp', { phone, otp });
      if (res?.token) {
        _token.set(res.token);
        localStorage.setItem('hvid_identity_id', res.identity_id || '');
      }
      return res;
    },

    /** Read stored identity_id (set on verifyOtp success or loginWithToken) */
    identityId() {
      return localStorage.getItem('hvid_identity_id')
          || (window.Auth?.getSession?.()?.identityId || null)
          || (window.Auth?.getSession?.()?.identity_id || null);
    },

    /**
     * GET /api/auth/me
     * Validates current Bearer token. Returns 401 if expired.
     * Auto-logout handled by _request() on 401.
     * @returns {{ identity_id, phone, verification_level, trust_signal } | ErrorShape}
     */
    me() {
      return _request('GET', '/auth/me');
    },

    /** Clear all auth state */
    logout() {
      _token.clear();
      localStorage.removeItem('hvid_identity_id');
      window.location.href = '/auth/login';
    },
  },

  // ── IDENTITY ─────────────────────────────────────────────────────
  identity: {

    /**
     * GET /api/identity/:id
     * @param {string} id - UUID
     * @returns {{ id, status, verificationLevel, identity_type, trust_signal, tier, assets[], ... }}
     */
    get(id) {
      return _request('GET', `/identity/${encodeURIComponent(id)}`);
    },

    /**
     * PATCH /api/identity/:id/type
     * @param {string} id
     * @param {'PERSONAL'|'PROFESSIONAL'|'BUSINESS'} type
     * @returns {{ id, identity_type, trust_signal, status }}
     */
    changeType(id, type) {
      return _request('PATCH', `/identity/${encodeURIComponent(id)}/type`, { type });
    },
  },

  // ── MATCH ────────────────────────────────────────────────────────
  match: {
    /**
     * POST /api/match/check
     * @param {{ type?: string, value?: string, query?: string }} params
     * @returns {{ result_type: 'MATCH_CONFIRMED'|'PARTIAL_MATCH'|'UNDER_REVIEW'|'NO_MATCH',
     *             signal: string, verification_level: number, identity_type: string }}
     */
    check(params) {
      return _request('POST', '/match/check', params);
    },
  },

  // ── REPORT ───────────────────────────────────────────────────────
  report: {
    /**
     * POST /api/report/submit
     * @param {{ reporter_identity_id?, target_identity_id?, target_asset_id?,
     *           report_type: string, description?, evidence_urls?: string[] }} params
     * @returns {{ success: true, report_id: string, status: string }}
     */
    submit(params) {
      return _request('POST', '/report/submit', params);
    },
  },

  // ── CHALLENGE ────────────────────────────────────────────────────
  // challengerIdentityId is ALWAYS resolved from the JWT on the server.
  // It is NEVER passed in the request body.
  challenge: {
    /**
     * POST /api/challenge/submit/:reportId  🔒 Requires Bearer token
     * Opens a challenge against a VALID-resolved report.
     * Server enforces: caller must be report.target_identity_id.
     *
     * @param {string} reportId - UUID of the report to challenge
     * @param {{ challengeReason?: string, evidenceUrls?: string[] }} body
     * @returns {{ id, reportId, status, paymentStatus, challengeReason, evidenceUrls, createdAt, updatedAt } | ErrorShape}
     */
    submit(reportId, body) {
      return _request('POST', `/challenge/submit/${encodeURIComponent(reportId)}`, body);
    },

    /**
     * GET /api/challenge/:id  🔒 Requires Bearer token
     * Challenger retrieves their own challenge status.
     * Returns 403 if the requesting identity is not the challenger.
     *
     * @param {string} challengeId - UUID of the challenge
     * @returns {{ id, reportId, status, paymentStatus, challengeReason, evidenceUrls, createdAt, updatedAt } | ErrorShape}
     */
    getStatus(challengeId) {
      return _request('GET', `/challenge/${encodeURIComponent(challengeId)}`);
    },

    /**
     * POST /api/challenge/payment/confirm
     * Payment gateway webhook callback — confirms or fails a payment.
     * NOTE: In production this should be called from a verified webhook handler, not directly.
     *
     * @param {{ challengeId: string, outcome: 'COMPLETED'|'FAILED', paymentReference: string }} params
     * @returns {{ id, reportId, status, paymentStatus, ... } | ErrorShape}
     */
    confirmPayment(params) {
      return _request('POST', '/challenge/payment/confirm', params);
    },
  },

  // ── KYC ─────────────────────────────────────────────────────────
  kyc: {
    /**
     * POST /api/kyc/start  🔒 Requires Bearer token
     * Starts a KYC session. Returns redirect_url to send user to /kyc/mock.
     * Idempotent: returns existing PENDING session if one exists.
     * @returns {{ kyc_id: string, status: 'PENDING', redirect_url: string } | ErrorShape}
     */
    start() {
      return _request('POST', '/kyc/start');
    },
    /**
     * POST /api/kyc/submit
     * @param {{ identity_id: string, document_type: string, document_urls: string[] }} params
     * @returns {{ kyc_id: string, status: string }}
     */
    submit(params) {
      return _request('POST', '/kyc/submit', params);
    },

    /**
     * GET /api/kyc/status?identityId=
     * @param {string} identityId
     * @returns {{ kyc_id, status, document_type, createdAt, updatedAt }}
     */
    status(identityId) {
      return _request('GET', `/kyc/status?identityId=${encodeURIComponent(identityId)}`);
    },
  },

  // ── SECURITY ─────────────────────────────────────────────────────
  security: {
    /**
     * GET /api/security/status/:identityId
     * @param {string} identityId
     * @returns {{ status, lastActivity, flagCount }}
     */
    getStatus(identityId) {
      return _request('GET', `/security/status/${encodeURIComponent(identityId)}`);
    },

    /**
     * POST /api/security/recover/start
     * @param {string} identityId
     * @returns {{ success: true, ... }}
     */
    startRecovery(identityId) {
      return _request('POST', '/security/recover/start', { identity_id: identityId });
    },

    /**
     * POST /api/security/recover/complete
     * @param {string} identityId
     * @returns {{ success: true, message: string }}
     */
    completeRecovery(identityId) {
      return _request('POST', '/security/recover/complete', { identity_id: identityId });
    },
  },

  // ── ASSET ────────────────────────────────────────────────────────
  asset: {
    /**
     * POST /api/asset/claim  🔒 Requires Bearer token
     * Claim an Instagram handle or website domain.
     * identityId is resolved from the JWT — do NOT pass it in the body.
     *
     * @param {'instagram'|'INSTAGRAM'|'website'|'WEBSITE'} type
     * @param {string} value  - raw handle (e.g. '@yourname') or domain (e.g. 'yoursite.com')
     * @returns {{ assetId, type, verificationStatus, verificationCode, instructions } | ErrorShape}
     */
    claim(type, value) {
      return _request('POST', '/asset/claim', { type, value });
    },

    /**
     * POST /api/asset/confirm  🔒 Requires Bearer token
     * User confirms they have placed the verification code in their bio/profile.
     * Sets status → PENDING_REVIEW for admin spot-check.
     *
     * @param {string} assetId  - UUID returned from claim()
     * @returns {{ success: boolean, message: string, status: string } | ErrorShape}
     */
    confirm(assetId) {
      return _request('POST', '/asset/confirm', { assetId });
    },

    /**
     * POST /api/asset/verify/instagram  🔒 Requires Bearer token
     * Now behaves same as confirm() — sets PENDING_REVIEW for admin check.
     *
     * @param {string} assetId  - UUID returned from claim()
     * @param {string} handle   - Instagram handle (kept for backward compat)
     * @returns {{ success: boolean, message: string } | ErrorShape}
     */
    verifyInstagram(assetId, handle) {
      return _request('POST', '/asset/verify/instagram', { assetId, handle });
    },

    /**
     * POST /api/asset/verify/website  🔒 Requires Bearer token
     * Backend checks homepage meta tag OR DNS TXT record for the verification code.
     *
     * @param {string} assetId  - UUID returned from claim()
     * @param {string} domain   - domain (with or without https://)
     * @returns {{ success: boolean, message: string, method?: string } | ErrorShape}
     */
    verifyWebsite(assetId, domain) {
      return _request('POST', '/asset/verify/website', { assetId, domain });
    },

    /**
     * GET /api/asset/:identityId  🔒 Requires Bearer token (JWT must match identityId)
     * Returns all assets linked to the identity. valueHash is never included.
     *
     * @param {string} identityId  - UUID of the identity (must match JWT)
     * @returns {Array<{ id, type, verificationStatus, ownershipStrength, createdAt }> | ErrorShape}
     */
    list(identityId) {
      return _request('GET', `/asset/${encodeURIComponent(identityId)}`);
    },

    /**
     * DELETE /api/asset/:assetId  🔒 Requires Bearer token
     * Removes a linked account from the current identity.
     *
     * @param {string} assetId  - UUID returned from claim()
     * @returns {{ success: boolean, message: string } | ErrorShape}
     */
    remove(assetId) {
      return _request('DELETE', `/asset/${encodeURIComponent(assetId)}`);
    },
  },

  // ── ERROR SHAPE HELPERS ──────────────────────────────────────────
  isError(res) {
    return !res || res.__networkError || res.__unauthorized || res.__enforced ||
           res.__rateLimit || res.__serverError || res.statusCode >= 400;
  },

  /** Returns a user-friendly error message for any error shape */
  errorMessage(res) {
    if (!res)                return 'No response from server.';
    if (res.__networkError)  return res.message;
    if (res.__rateLimit)     return `Too many requests. Please wait ${res.retryAfter}s.`;
    if (res.__enforced)      return 'Verification required to continue.';
    if (res.__serverError)   return res.message;
    if (res.message)         return res.message;
    if (res.error)           return res.error;
    return 'An unexpected error occurred.';
  },

  /** Show enforcement modal (403) — wires to existing HVID.toast or alerts */
  handleEnforcement(res, redirectUrl = '//dashboard/verification') {
    if (!res.__enforced) return;
    const level = res.required_level || '';
    const msg   = `Additional verification is required${level ? ` (level ${level})` : ''}.`;
    if (window.HVID?.toast) {
      HVID.toast(msg, 'warning');
    } else {
      const modal = document.getElementById('enforcement-modal');
      if (modal) {
        modal.style.display = 'flex';
        const txt = modal.querySelector('.modal-message');
        if (txt) txt.textContent = msg;
        const btn = modal.querySelector('.modal-verify-btn');
        if (btn) btn.onclick = () => { window.location.href = redirectUrl; };
      }
    }
  },
};

// ── Expose globally ──────────────────────────────────────────────
window.HVID_API = HVID_API;
