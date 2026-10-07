/**
 * verification-flow.js
 *
 * Provider-agnostic frontend verification flow.
 *
 * Handles:
 *  1. "Start KYC" / "Start Face" CTA clicks
 *  2. POST /api/kyc/start or /api/face/start → receive redirect_url
 *  3. Redirect user to external provider
 *  4. Return handling (URL param ?verif_return=1)
 *  5. Status polling → update UI state
 *
 * SAFETY: Never displays raw provider details, session tokens, or
 *         document references. Shows only internal status labels.
 *
 * Zero coupling: attaches to existing #kyc-action-btn / #face-action-btn
 * if present, and injects its own panel if on a standalone page.
 */
'use strict';

(function VerificationFlow() {

  // ── Config ──────────────────────────────────────────────────
  const API          = '/api';
  const POLL_DELAY   = 3000; // ms between status polls after return
  const MAX_POLLS    = 10;   // give up after N polls

  // ── Auth helpers ─────────────────────────────────────────────
  const token = () => localStorage.getItem('hvid_token') || '';
  const session = () => {
    try { return JSON.parse(localStorage.getItem('hvid_session') || '{}'); }
    catch { return {}; }
  };
  const identityId = () => {
    const s = session();
    return s.identity_id || s.identityId || null;
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  // ── Status labels ─────────────────────────────────────────────
  const STATUS_UI = {
    PENDING:      { icon: '⏳', label: 'Verification in progress',   color: '#818cf8' },
    UNDER_REVIEW: { icon: '🔍', label: 'Under review',               color: '#fbbf24' },
    VERIFIED:     { icon: '✅', label: 'Verification successful',    color: '#34d399' },
    REJECTED:     { icon: '❌', label: 'Verification failed — retry', color: '#f87171' },
    EXPIRED:      { icon: '⚠️', label: 'Verification expired',       color: '#f87171' },
    UNKNOWN:      { icon: '❓', label: 'Status unknown',              color: 'rgba(255,255,255,.4)' },
  };

  function statusUI(s) { return STATUS_UI[s] || STATUS_UI.UNKNOWN; }

  // ── Toast util ────────────────────────────────────────────────
  function toast(msg, color) {
    let el = document.getElementById('vf-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vf-toast';
      el.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'background:#1e1e2e', 'border:1px solid rgba(255,255,255,.12)', 'border-radius:10px',
        'padding:10px 18px', 'font-size:13px', 'font-weight:600', 'color:rgba(255,255,255,.85)',
        'z-index:9999', 'opacity:0', 'transition:opacity .2s', 'pointer-events:none',
        'font-family:Inter,sans-serif', 'white-space:nowrap',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.color  = color || 'rgba(255,255,255,.85)';
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
  }

  // ── Start verification ────────────────────────────────────────
  async function startVerification(type /* 'kyc' | 'face' */) {
    const iid = identityId();
    if (!iid) { toast('Please sign in to start verification', '#f87171'); return; }

    if (type === 'face') {
      window.location.href = '/face-capture';
      return;
    }

    const btnId = type === 'kyc' ? 'kyc-action-btn' : 'face-action-btn';
    const btn   = document.getElementById(btnId);
    const orig  = btn?.textContent || '';
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

    try {
      const endpoint = type === 'kyc'
        ? `${API}/kyc/start`
        : `${API}/face/start`;

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ identity_id: iid }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.requires_payment) {
          if (btn) { btn.disabled = false; btn.textContent = orig; }
          toast(data.error || 'Payment required before KYC.', '#fbbf24');
          setTimeout(() => { window.location.href = data.redirect_url || '/dashboard/upgrade'; }, 900);
          return;
        }
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }

      // Provider returned a redirect URL — send user there
      if (data.redirect_url) {
        toast('Redirecting to secure verification provider…', '#818cf8');
        // Store return context so we poll on return
        sessionStorage.setItem('vf_pending', JSON.stringify({ type, identity_id: iid }));
        setTimeout(() => { window.location.href = data.redirect_url; }, 800);
        return;
      }

      // No redirect_url (simulation / internal flow) — treat as PENDING
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      toast('Verification started — status updating…', '#818cf8');
      setStatusDisplay(type, 'PENDING');

    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      toast(err.message || `Could not start ${type.toUpperCase()} verification.`, '#f87171');
    }
  }

  // ── Poll status after provider return ─────────────────────────
  async function pollStatus(type, iid, attempts) {
    if (attempts >= MAX_POLLS) {
      setStatusDisplay(type, 'PENDING'); // show pending, let natural refresh handle it
      return;
    }

    const endpoint = type === 'kyc'
      ? `${API}/kyc/status?identityId=${iid}`
      : `${API}/face/status?identityId=${iid}`;

    try {
      const res  = await fetch(endpoint, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      const s    = data.status || 'UNKNOWN';
      setStatusDisplay(type, s);
      // Keep polling if still pending
      if (s === 'PENDING' || s === 'UNDER_REVIEW') {
        setTimeout(() => pollStatus(type, iid, attempts + 1), POLL_DELAY);
      }
    } catch {
      setTimeout(() => pollStatus(type, iid, attempts + 1), POLL_DELAY);
    }
  }

  // ── Update status pill / button in existing page ──────────────
  function setStatusDisplay(type, status) {
    const ui    = statusUI(status);
    const pillId = type === 'kyc' ? 'kyc-status-pill' : 'face-status-pill';
    const btnId  = type === 'kyc' ? 'kyc-action-btn'  : 'face-action-btn';

    const pill = document.getElementById(pillId);
    if (pill) {
      pill.innerHTML = `<span style="
        display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;
        padding:2px 10px;border-radius:99px;border:1px solid ${ui.color}33;
        background:${ui.color}11;color:${ui.color}
      ">${ui.icon} ${ui.label}</span>`;
    }

    const btn = document.getElementById(btnId);
    if (btn) {
      const done = status === 'VERIFIED' || status === 'PENDING' || status === 'UNDER_REVIEW';
      btn.style.display = done ? 'none' : '';
    }

    // Update standalone panel if present
    const panelId = `vf-status-${type}`;
    const panel   = document.getElementById(panelId);
    if (panel) {
      panel.innerHTML = renderStatusCard(type, status);
    }
  }

  // ── Standalone status card HTML ───────────────────────────────
  function renderStatusCard(type, status) {
    const ui    = statusUI(status);
    const label = type === 'kyc' ? 'KYC Document Verification' : 'Face Biometric Verification';
    const retryLabel = type === 'kyc' ? 'Retry KYC' : 'Retry Face Verification';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${ui.icon}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#e2e8f0">${label}</div>
            <div style="font-size:12px;color:${ui.color};margin-top:2px">${ui.label}</div>
          </div>
        </div>
        ${status === 'REJECTED' || status === 'EXPIRED' || status === 'UNKNOWN'
          ? `<button onclick="window.VerifFlow.start('${type}')" style="
              font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;
              padding:6px 14px;border-radius:8px;border:1px solid rgba(129,140,248,.25);
              background:rgba(129,140,248,.08);color:#818cf8;
            ">${retryLabel}</button>`
          : ''}
      </div>`;
  }

  // ── Inject standalone panel (for pages without existing UI) ───
  function injectStandalonePanel(mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    mount.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- Security notice -->
        <div style="
          border-radius:10px;padding:12px 14px;margin-bottom:4px;
          background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.15);
          font-size:12px;color:rgba(52,211,153,.75);line-height:1.6
        ">
          🔒 <strong style="color:#34d399">We use secure external providers.</strong>
          No documents or biometric data are stored on HVID servers.
          You will be redirected to a verified third-party service to complete the check.
        </div>

        <!-- KYC card -->
        <div style="
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
          border-radius:14px;padding:18px 20px
        ">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px">
                KYC Document Verification
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,.4);line-height:1.5">
                Upload a government-issued ID via our secure provider.<br>
                Required for Professional tier.
              </div>
            </div>
            <button id="kyc-action-btn" onclick="window.VerifFlow.start('kyc')" style="
              font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;
              padding:9px 18px;border-radius:10px;border:1px solid rgba(129,140,248,.3);
              background:rgba(129,140,248,.1);color:#818cf8;transition:opacity .15s;
            ">Start KYC Verification</button>
          </div>
          <div id="vf-status-kyc" style="border-top:1px solid rgba(255,255,255,.06);padding-top:12px;font-size:12px;color:rgba(255,255,255,.35)">
            No KYC verification on record.
          </div>
        </div>

        <!-- Face card -->
        <div style="
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
          border-radius:14px;padding:18px 20px
        ">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px">
                Face Biometric Verification
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,.4);line-height:1.5">
                One-time liveness check via secure provider. KYC required first.<br>
                Required for Premium tier.
              </div>
            </div>
            <button id="face-action-btn" onclick="window.VerifFlow.start('face')" style="
              font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;
              padding:9px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.1);
              background:rgba(255,255,255,.04);color:rgba(255,255,255,.5);transition:opacity .15s;
            " disabled>Start Face Verification</button>
          </div>
          <div id="vf-status-face" style="border-top:1px solid rgba(255,255,255,.06);padding-top:12px;font-size:12px;color:rgba(255,255,255,.35)">
            Complete KYC first to unlock face verification.
          </div>
        </div>

      </div>`;
  }

  // ── Load and render current statuses ──────────────────────────
  async function loadStatuses() {
    const iid = identityId();
    if (!iid) return;

    try {
      const [kycRes, faceRes] = await Promise.allSettled([
        fetch(`${API}/kyc/status?identityId=${iid}`,  { headers: authHeaders() }),
        fetch(`${API}/face/status?identityId=${iid}`, { headers: authHeaders() }),
      ]);

      let kycStatus  = 'UNKNOWN';
      let faceStatus = 'UNKNOWN';

      if (kycRes.status === 'fulfilled' && kycRes.value.ok) {
        const d = await kycRes.value.json().catch(() => ({}));
        kycStatus = d.status || 'UNKNOWN';
      }
      if (faceRes.status === 'fulfilled' && faceRes.value.ok) {
        const d = await faceRes.value.json().catch(() => ({}));
        faceStatus = d.status || 'UNKNOWN';
      }

      setStatusDisplay('kyc', kycStatus);
      setStatusDisplay('face', faceStatus);

      // If KYC has been approved server-side, update local session. The
      // final confirmation still requires face approval as well.
      if (kycStatus === 'VERIFIED') {
        try {
          const s = JSON.parse(localStorage.getItem('hvid_session') || '{}');
          s.verificationLevel = Math.max(s.verificationLevel || s.verification_level || 0, 2);
          s.identityState = 'VERIFIED';
          localStorage.setItem('hvid_session', JSON.stringify(s));
        } catch (e) {
          // ignore
        }
      }

      if (window.updateConfirmationState) {
        window.updateConfirmationState(kycStatus, faceStatus);
      }
      if (kycStatus === 'VERIFIED' && faceStatus === 'VERIFIED' && window.showStep) {
        window.showStep(3);
      }

      // Unlock face button only if KYC is verified
      const faceBtn = document.getElementById('face-action-btn');
      if (faceBtn && kycStatus === 'VERIFIED') {
        faceBtn.disabled = false;
        faceBtn.style.color  = '#818cf8';
        faceBtn.style.borderColor = 'rgba(129,140,248,.3)';
        faceBtn.style.background  = 'rgba(129,140,248,.1)';
      }

    } catch { /* silent — will retry on next load */ }
  }

  // ── Handle provider return ────────────────────────────────────
  function handleProviderReturn() {
    const params = new URLSearchParams(window.location.search);
    const isReturn = params.get('verif_return') || params.get('provider_return');
    if (!isReturn) return;

    const ctx = JSON.parse(sessionStorage.getItem('vf_pending') || 'null');
    sessionStorage.removeItem('vf_pending');

    toast('Checking verification status…', '#818cf8');

    const iid  = ctx?.identity_id || identityId();
    const type = ctx?.type || 'kyc';

    if (iid) {
      setTimeout(() => pollStatus(type, iid, 0), 1000);
    }

    // Clean URL without reload
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', clean);
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    // Inject standalone panel if mount point exists
    if (document.getElementById('vf-mount')) {
      injectStandalonePanel('vf-mount');
    }

    // Handle return from provider (URL has ?verif_return=1)
    handleProviderReturn();

    // Load current statuses
    loadStatuses();

    // Wire existing buttons if already in DOM (dashboard page)
    const kycBtn  = document.getElementById('kyc-action-btn');
    const faceBtn = document.getElementById('face-action-btn');
    if (kycBtn  && !kycBtn.dataset.vfWired)  { kycBtn.addEventListener('click',  () => startVerification('kyc'));  kycBtn.dataset.vfWired  = '1'; }
    if (faceBtn && !faceBtn.dataset.vfWired) { faceBtn.addEventListener('click', () => startVerification('face')); faceBtn.dataset.vfWired = '1'; }

    // Periodically refresh statuses so admin actions (approve/reject)
    // are reflected to the user without needing a manual reload.
    setInterval(loadStatuses, 10000);
  }

  // ── Public API ────────────────────────────────────────────────
  window.VerifFlow = { start: startVerification, reload: loadStatuses };

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
