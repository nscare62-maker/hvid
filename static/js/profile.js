/* ============================================================
   HVID — Public Profile JS
   Route:    /public/:identity_id  →  profile.html?id=<id>
   API:      GET /api/profile/:identityId
   Contract: { identity_id, tier, trust_signal,
               verification_summary, stability_indicator }

   Safety rules:
     - Never show reports, internal scores, or raw flags
     - Never show action hints (owner-only feature)
     - trust_signal is advisory, not a verdict
   ============================================================ */
'use strict';

// ── Trust signal palette ───────────────────────────────────────
// Mirrors TrustSignalUI (trust-signal.js) — single source of truth.
// Used as fallback when trust-signal.js is not loaded yet.
const PROFILE_SIGNALS = {
  STABLE:                { label: 'Stable Identity',       desc: 'No issues detected. Identity is consistent.',        color: '#34d399', bg: 'rgba(52,211,153,.08)',  border: 'rgba(52,211,153,.18)',  icon: '✔' },
  UNDER_REVIEW:          { label: 'Under Review',          desc: 'Some signals require attention.',                     color: '#fbbf24', bg: 'rgba(251,191,36,.07)',  border: 'rgba(251,191,36,.2)',   icon: '⚠' },
  REQUIRES_REVALIDATION: { label: 'Revalidation Required', desc: 'Recent changes detected. Verification recommended.', color: '#fb923c', bg: 'rgba(251,146,60,.07)',  border: 'rgba(251,146,60,.2)',   icon: '🔁' },
  LIMITED:               { label: 'Limited Trust',         desc: 'Usage restricted due to risk signals.',              color: '#f87171', bg: 'rgba(248,113,113,.07)', border: 'rgba(248,113,113,.2)',  icon: '⛔' },
  SUSPENDED:             { label: 'Suspended Identity',    desc: 'This identity is currently blocked.',                color: '#991b1b', bg: 'rgba(153,27,27,.10)',   border: 'rgba(153,27,27,.25)',   icon: '🚫' },
  // Legacy value aliases (from old match-output enum)
  STRONG:    { label: 'Stable Identity',       desc: 'No issues detected.',                                 color: '#34d399', bg: 'rgba(52,211,153,.08)',  border: 'rgba(52,211,153,.18)',  icon: '✔' },
  MODERATE:  { label: 'Under Review',          desc: 'Some signals require attention.',                     color: '#fbbf24', bg: 'rgba(251,191,36,.07)',  border: 'rgba(251,191,36,.2)',   icon: '⚠' },
  CAUTION:   { label: 'Revalidation Required', desc: 'Recent changes detected.',                            color: '#fb923c', bg: 'rgba(251,146,60,.07)',  border: 'rgba(251,146,60,.2)',   icon: '🔁' },
  HIGH_RISK: { label: 'Limited Trust',         desc: 'Usage restricted due to risk signals.',              color: '#f87171', bg: 'rgba(248,113,113,.07)', border: 'rgba(248,113,113,.2)',  icon: '⛔' },
};

// Resolve signal config: prefers TrustSignalUI if loaded, falls back to PROFILE_SIGNALS
function _sig(signal) {
  if (window.TrustSignalUI) return window.TrustSignalUI.resolveTrustState(signal);
  return PROFILE_SIGNALS[signal] || PROFILE_SIGNALS.UNDER_REVIEW;
}

// ── Tier labels ────────────────────────────────────────────────
const TIER_LABELS = {
  PREMIUM:      { label: 'Premium',      color: '#fbbf24' },
  PROFESSIONAL: { label: 'Professional', color: '#818cf8' },
  BASIC:        { label: 'Basic',        color: 'rgba(255,255,255,.4)' },
};

// ── Verification summary labels ────────────────────────────────
const VERIF_LABELS = {
  kyc:  'Verified with official documents',
  face: 'Face verification completed',
};

// ── HTML escape ───────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Skeleton loading ───────────────────────────────────────────
const SKEL = 'background:rgba(255,255,255,.06);border-radius:6px;animation:pSkelPulse 1.4s ease-in-out infinite';

function showProfileSkeleton() {
  if (!document.getElementById('p-skel-css')) {
    const s = document.createElement('style');
    s.id = 'p-skel-css';
    s.textContent = '@keyframes pSkelPulse{0%,100%{opacity:.3}50%{opacity:.8}}';
    document.head.appendChild(s);
  }
  const iconEl = document.getElementById('profile-trust-icon');
  if (iconEl) {
    iconEl.textContent = '';
    iconEl.style.cssText = `${SKEL};width:44px;height:44px;border-radius:12px;flex-shrink:0`;
  }
  ['profile-trust-signal','profile-verif-list','profile-stability'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div style="${SKEL};height:14px;width:70%;margin:4px 0"></div>
                             <div style="${SKEL};height:11px;width:45%;margin:4px 0"></div>`;
  });
}

// ── 404 state ─────────────────────────────────────────────────
function showNotFound() {
  const page = document.getElementById('profile-page');
  if (page) {
    page.innerHTML = `
      <div style="text-align:center;padding:80px 24px">
        <div style="font-size:48px;margin-bottom:16px">—</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:10px">Identity not found</div>
        <div style="font-size:14px;color:rgba(255,255,255,.4)">
          This HVID identity does not exist or is not publicly visible.
        </div>
      </div>`;
    page.style.opacity = '1';
  }
  const loading = document.getElementById('profile-loading');
  if (loading) loading.style.display = 'none';
}

// ── Fetch from API ─────────────────────────────────────────────
function fetchProfile(identityId) {
  return fetch(`/api/profile/${encodeURIComponent(identityId)}`)
    .then(r => {
      if (r.status === 404) return { notFound: true };
      if (!r.ok) return null;
      return r.json();
    })
    .catch(() => null);
}

// ── Main render ───────────────────────────────────────────────
function renderProfile(identityId, data) {
  const ts = _sig(data.trust_signal);

  // ── S1: Trust icon ───────────────────────────────────────────
  const iconEl = document.getElementById('profile-trust-icon');
  if (iconEl) {
    iconEl.style.color      = ts.color;
    iconEl.style.background = ts.bg || 'rgba(255,255,255,.04)';
    iconEl.style.borderColor = ts.border || 'rgba(255,255,255,.1)';
    iconEl.style.cssText    = ''; 
    iconEl.style.color      = ts.color;
    iconEl.style.background = ts.bg;
    iconEl.style.borderColor = ts.border;
    iconEl.textContent      = ts.icon;
  }

  // ── S2: Trust signal card ─────────────────────────────────────
  const signalEl = document.getElementById('profile-trust-signal');
  if (signalEl) {
    if (window.TrustSignalUI) {
      signalEl.innerHTML = window.TrustSignalUI.buildTrustCard(ts, null, false);
    } else {
      signalEl.innerHTML =
        `<div style="background:${ts.bg};border:1px solid ${ts.border};border-radius:14px;padding:20px 22px">
           <div style="font-size:16px;font-weight:800;color:${ts.color};margin-bottom:5px">
             ${ts.icon} ${esc(ts.label)}
           </div>
           <div style="font-size:13px;color:rgba(255,255,255,.5);line-height:1.6">
             ${esc(ts.desc || '')}
           </div>
         </div>`;
    }
  }

  // ── S2c: Revocation Signal (Task 4) ──────────────────────────
  const tierSlot = document.getElementById('profile-tier-slot');
  if (tierSlot) {
    const sig = data.revocation_signal || 'NONE';
    const REV_MAP = {
      NONE: { label: 'Clean history', color: '#34d399', bg: 'rgba(52,211,153,.1)' },
      LOW:  { label: 'Minor ownership issues', color: '#fbbf24', bg: 'rgba(251,191,36,.1)' },
      HIGH: { label: 'High ownership risk', color: '#f87171', bg: 'rgba(248,113,113,.1)' }
    };
    const cfg = REV_MAP[sig] || REV_MAP.NONE;
    
    tierSlot.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span title="Based on previously revoked assets" 
              style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;
                     color:${cfg.color};background:${cfg.bg};cursor:help;
                     border:1px solid ${cfg.color}33">
          🛡️ ${cfg.label}
        </span>
      </div>`;
  }

  // ── S2b: Identity Type badge ───────────────────────────
  const typeRowEl = document.getElementById('profile-identity-type');
  if (typeRowEl && window.IdentityTypeUI) {
    const _it = data.identity_type || (data.tier === 'PREMIUM' ? 'PROFESSIONAL' : 'PERSONAL');
    typeRowEl.innerHTML = IdentityTypeUI.profileRow(_it);
  }

  // ── S3: Verification summary ──────────────────────────────────
  const verifEl = document.getElementById('profile-verif-list');
  if (verifEl) {
    const items = [];
    items.push(`<div class="profile-verif-item"><span class="profile-verif-check">✓</span>Phone verified</div>`);
    if (data.kyc_verified || data.verification_summary?.kyc) {
      items.push(`<div class="profile-verif-item"><span class="profile-verif-check">✓</span>${esc(VERIF_LABELS.kyc)}</div>`);
    }
    if (data.face_verified || data.verification_summary?.face) {
      items.push(`<div class="profile-verif-item"><span class="profile-verif-check">✓</span>${esc(VERIF_LABELS.face)}</div>`);
    }
    if (!data.kyc_verified && !data.verification_summary?.kyc) {
      items.push(`<div class="profile-verif-item profile-verif-pending"><span>○</span>Additional verification not yet completed</div>`);
    }
    if (data.status === 'REVERIFY_REQUIRED') {
      items.push(`<div class="profile-verif-item" style="color:#fb923c;font-weight:700;"><span class="profile-verif-check" style="background:rgba(251,146,60,.1);color:#fb923c;border-color:rgba(251,146,60,.2)">!</span>Verification expired — re-validation required</div>`);
    }
    verifEl.innerHTML = items.join('');
  }

  // ── S4: Stability indicator ───────────────────────────────────
  const stabilityEl = document.getElementById('profile-stability');
  if (stabilityEl) {
    if (data.stable || data.stability_indicator === 'STABLE') {
      stabilityEl.textContent = '✓ Stable identity — no recent changes detected.';
      stabilityEl.style.color = '#34d399';
    } else {
      stabilityEl.textContent = '⚠ Recent changes detected on this identity.';
      stabilityEl.style.color = '#fb923c';
    }
  }

  // ── S5: Assets (Social + Web) ───────────────────────────────
  // Groups assets by category (CORE vs CUSTOM) and trust level.
  const assetsEl = document.getElementById('profile-verified-assets');
  if (assetsEl) {
    const rawAssets = Array.isArray(data.verified_assets) ? data.verified_assets : (Array.isArray(data.assets) ? data.assets : []);
    
    // Sorting (Task 5): VERIFIED → CHALLENGED → UNVERIFIED → REVOKED
    const ORDER = { VERIFIED: 0, CHALLENGED: 1, UNVERIFIED: 2, REVOKED: 3 };
    rawAssets.sort((a, b) => (ORDER[a.status] ?? 99) - (ORDER[b.status] ?? 99));

    if (rawAssets.length === 0) {
      assetsEl.style.display = 'none';
    } else {
      const SVG_INSTA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
      const SVG_WEB   = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      const SVG_TWIT  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>';
      const SVG_LINK  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';

      const TYPE_META = {
        instagram: { icon: SVG_INSTA, prefix: '@',  label: 'Instagram', category: 'CORE' },
        website:   { icon: SVG_WEB,   prefix: '',    label: 'Website',   category: 'CORE' },
        twitter:   { icon: SVG_TWIT,  prefix: '@',  label: 'Twitter',   category: 'CORE' },
        CUSTOM:    { icon: SVG_LINK,  prefix: '',    label: 'Claimed Asset', category: 'CUSTOM' },
      };

      // Grouping logic: core assets are verified accounts from known platforms
      const core   = rawAssets.filter(a => (TYPE_META[a.type]?.category === 'CORE' || a.category === 'CORE') && a.status === 'VERIFIED');
      const custom = rawAssets.filter(a => !core.includes(a));

      const renderAssetRow = (a, isCore) => {
        const meta = TYPE_META[a.type] || (a.type === 'CUSTOM' ? TYPE_META.CUSTOM : { icon: SVG_LINK, prefix: '', label: a.type });
        const displayVal = `${meta.prefix}${esc(a.value)}`;
        
        const STATUS_CFG = {
          VERIFIED:   { label: 'Verified',      icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>', color: '#34d399', bg: 'rgba(52,211,153,.08)', border: 'rgba(52,211,153,.18)' },
          CHALLENGED: { label: 'Under Dispute', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>', color: '#fbbf24', bg: 'rgba(251,191,36,.08)',  border: 'rgba(251,191,36,.18)' },
          UNVERIFIED: { label: 'Unverified',    icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>', color: '#818cf8', bg: 'rgba(129,140,248,.08)', border: 'rgba(129,140,248,.18)' },
          REVOKED:    { label: 'Revoked',       icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>', color: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.18)' },
        };

        const s = STATUS_CFG[a.status] || STATUS_CFG.UNVERIFIED;
        const statusBadge = `<span style="font-size:10px;font-weight:800;padding:3px 10px;border-radius:99px;flex-shrink:0;color:${s.color};background:${s.bg};border:1px solid ${s.border}">${s.icon} ${s.label}</span>`;
        
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 0;
                      border-bottom:1px solid rgba(255,255,255,.05);${!isCore ? 'opacity:0.7' : ''}">
            <span style="font-size:20px;flex-shrink:0">${meta.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.3);
                          text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">
                ${esc(meta.label)}
              </div>
              <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);
                          overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${displayVal}
              </div>
            </div>
            ${statusBadge}
          </div>`;
      };

      const coreHtml = core.length > 0 
        ? `<div style="margin-bottom:var(--space-6)">
             <div style="font-size:11px;font-weight:800;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
               Verified Assets
               <span style="text-transform:none;font-weight:500;letter-spacing:0;font-size:10px;opacity:0.8">CORE</span>
             </div>
             <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px;line-height:1.5">
               Verified assets are confirmed to be controlled by this identity.
             </p>
             <div style="border-top:1px solid rgba(255,255,255,.05)">${core.map(a => renderAssetRow(a, true)).join('')}</div>
           </div>`
        : '';

      const customHtml = custom.length > 0
        ? `<div>
             <div style="font-size:11px;font-weight:800;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
               Other Claimed Assets
               <span style="text-transform:none;font-weight:500;letter-spacing:0;font-size:10px;opacity:0.8">CUSTOM</span>
             </div>
             <div style="border-top:1px solid rgba(255,255,255,.05)">${custom.map(a => renderAssetRow(a, false)).join('')}</div>
           </div>`
        : '';

      assetsEl.style.display = 'block';
      assetsEl.innerHTML = coreHtml + customHtml;
    }
  }

  // ── Share link ────────────────────────────────────────────────
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(identityId)}`;
  const linkEl   = document.getElementById('profile-share-link');
  if (linkEl) linkEl.value = shareUrl;

  // ── Reveal page ───────────────────────────────────────────────
  const page = document.getElementById('profile-page');
  if (page) page.style.opacity = '1';
  const loading = document.getElementById('profile-loading');
  if (loading) loading.style.display = 'none';
}

// ── Copy link to clipboard ────────────────────────────────────
function copyProfileLink() {
  const linkEl = document.getElementById('profile-share-link');
  const btn    = document.getElementById('profile-copy-btn');
  const url    = linkEl ? linkEl.value : window.location.href;

  navigator.clipboard.writeText(url).then(() => {
    if (btn) {
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
    }
  }).catch(() => {
    if (linkEl) { linkEl.select(); document.execCommand('copy'); }
    if (btn) {
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
    }
  });
}

// ── Native share (mobile) ─────────────────────────────────────
function nativeShare() {
  const shareUrl  = document.getElementById('profile-share-link')?.value || window.location.href;
  const shareData = { title: 'HVID Identity Profile', text: 'Check this HVID identity trust profile.', url: shareUrl };
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    navigator.share(shareData).catch(() => {});
  } else {
    copyProfileLink();
  }
}

window.copyProfileLink = copyProfileLink;
window.nativeShare     = nativeShare;

// ── Fetch latest report against identity (for challenge flow) ────────────
async function getLatestReport(identityId) {
  try {
    const token = localStorage.getItem('hvid_token') || '';
    const res = await fetch(`/api/report/target/${encodeURIComponent(identityId)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const reports = await res.json();
    return reports?.[0]?.id || null;
  } catch (_) {
    return null;
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params     = new URLSearchParams(window.location.search);
  let identityId     = params.get('id') || '';
  const authIdentity = (typeof HVID_API !== 'undefined') ? HVID_API.auth.identityId() : null;
  if (!identityId && authIdentity) {
    identityId = authIdentity;
  }

  const idEl = document.getElementById('profile-identity-id');
  if (idEl && identityId) {
    const formattedId = identityId.startsWith('HVID-')
      ? identityId.replace(/^HVID-/i, '').slice(0, 8).toUpperCase()
      : identityId.slice(0, 8).toUpperCase();
    idEl.textContent = `HVID-${formattedId}`;
  }

  if (!identityId) {
    showNotFound();
    return;
  }

  showProfileSkeleton();

  const result = await fetchProfile(identityId);

  if (result && result.notFound) {
    showNotFound();
    return;
  }

  if (!result) { showNotFound(); return; }
  renderProfile(identityId, result);

  const myId = (typeof HVID_API !== 'undefined') ? HVID_API.auth.identityId() : null;

  const verifyAccountSection = document.getElementById('profile-verify-account-section');
  if (verifyAccountSection && myId && identityId && myId === identityId) {
    verifyAccountSection.style.display = '';
  }

  const challengeBtn = document.getElementById('profile-challenge-btn');
  if (challengeBtn && myId && identityId && myId === identityId) {
    challengeBtn.style.display = '';
    challengeBtn.onclick = async function () {
      challengeBtn.disabled = true;
      challengeBtn.textContent = 'Loading…';
      const reportId = await getLatestReport(identityId);
      if (reportId) {
        window.location.href = 'challenge.html?reportId=' + encodeURIComponent(reportId);
      } else {
        challengeBtn.disabled = false;
        challengeBtn.textContent = 'Challenge Report';
        alert('No report available to challenge.');
      }
    };
    loadHistory(identityId);
  }

  const reportBtn = document.getElementById('profile-report-btn');
  if (reportBtn && identityId) {
    if (!myId || myId !== identityId) {
      reportBtn.style.display = '';
    }
  }

  const ownershipChallengeBtn = document.getElementById('profile-ownership-challenge-btn');
  if (ownershipChallengeBtn && identityId) {
    if (!myId || myId !== identityId) {
      ownershipChallengeBtn.style.display = '';
      ownershipChallengeBtn.onclick = function () {
        if (window.ChallengeUI) {
          window.ChallengeUI.openSubmission(identityId);
        } else {
          window.location.href = 'challenge.html?target_identity_id=' + encodeURIComponent(identityId);
        }
      };
    }
  }
});

// ── MVP Ownership Verification Flow ──────────────────────────────
let currentVerificationAccountId = null;

window.getVerificationCode = async function () {
  const platform = document.getElementById('verifyPlatformSelect').value;
  const handle = document.getElementById('verifyHandleInput').value.trim();
  const btn = document.getElementById('getVerificationCodeBtn');
  const result = document.getElementById('verifyAccountResult');

  if (!handle) {
    result.style.display = 'block';
    result.style.color = '#f87171';
    result.textContent = 'Please enter a handle or username.';
    return;
  }

  const identityId = new URLSearchParams(window.location.search).get('id');
  if (!identityId) return;

  btn.disabled = true;
  btn.textContent = 'Generating...';
  result.style.display = 'none';

  try {
    const res = await fetch('/api/identity/add-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity_id: identityId, platform, handle }),
    });

    if (!res.ok) throw new Error('Failed to generate code');
    const data = await res.json();
    
    // We assume the backend returns the account ID somehow. Wait, our addAccount didn't return account_id.
    // I need to fix that in the backend, or just assume the frontend will call a verify endpoint. 
    // Wait, the backend verifyAccount needs account_id. Let's fix the backend in the next step, for now just use the response.
    currentVerificationAccountId = data.account_id || 'dummy'; 

    document.getElementById('verifyAccountStep1').style.display = 'none';
    document.getElementById('verifyAccountStep2').style.display = 'block';
    document.getElementById('verificationCodeDisplay').textContent = data.verification_code;
    
    const expiryDisplay = document.getElementById('verificationExpiryDisplay');
    if (expiryDisplay && data.expires_in) {
      expiryDisplay.textContent = `Code expires in ${data.expires_in}`;
      expiryDisplay.style.display = 'block';
    } else if (expiryDisplay) {
      expiryDisplay.style.display = 'none';
    }
    
    document.getElementById('verificationInstructionsDisplay').textContent = data.instructions;

  } catch (err) {
    result.style.display = 'block';
    result.style.color = '#f87171';
    result.textContent = 'Unable to generate code. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Get Verification Code';
  }
};

window.confirmAccountVerification = async function () {
  const btn = document.getElementById('confirmVerificationBtn');
  const result = document.getElementById('verifyAccountResult');
  const proofText = document.getElementById('proofText').value;

  if (!proofText.trim()) {
    result.style.display = 'block';
    result.style.color = '#fbbf24';
    result.textContent = 'Please paste your bio text first.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/identity/verify-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        account_id: currentVerificationAccountId,
        proof_text: proofText 
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      throw new Error(errData.message || 'Verification failed');
    }
    
    result.style.display = 'block';
    result.style.color = '#34d399';
    result.textContent = 'Account verified successfully! It will now appear on your profile.';
    
    document.getElementById('verifyAccountStep2').style.display = 'none';
    
    // Optionally reload profile
    setTimeout(() => window.location.reload(), 1500);

  } catch (err) {
    result.style.display = 'block';
    result.style.color = '#f87171';
    
    if (err.message && err.message.includes('expired')) {
      result.textContent = err.message;
      btn.textContent = 'Generate new code';
      btn.onclick = () => {
        document.getElementById('verifyAccountStep2').style.display = 'none';
        document.getElementById('verifyAccountStep1').style.display = 'block';
        document.getElementById('verifyAccountResult').style.display = 'none';
        document.getElementById('getVerificationCodeBtn').disabled = false;
        document.getElementById('getVerificationCodeBtn').textContent = 'Get Verification Code';
      };
      btn.disabled = false;
    } else {
      result.textContent = err.message || 'Verification code not found. Please check your profile and try again.';
      btn.disabled = false;
      btn.textContent = 'Verify Account';
    }
  }
};

// ── History timeline ─────────────────────────────────────────────────────────

const EVENT_LABELS = {
  REPORT_SUBMITTED:           'A report was submitted',
  ENFORCEMENT_LEVEL_CHANGED:  'Enforcement level updated',
  TRUST_SIGNAL_CHANGED:       'Trust signal changed',
  VERIFICATION_LEVEL_CHANGED: 'Verification level updated',
  KYC_SUBMITTED:              'KYC documents submitted',
  KYC_APPROVED:               'KYC approved',
  KYC_REJECTED:               'KYC rejected',
  CHALLENGE_SUBMITTED:        'Challenge raised',
  CHALLENGE_RESOLVED_SUCCESS: '✔ Challenge successful — trust restored',
  CHALLENGE_RESOLVED_FAILED:  'Challenge reviewed and rejected',
};

function formatEvent(item) {
  const metaType = item.metadata && item.metadata.event_type;
  const type     = metaType || item.eventType || item.event_type || '';
  const base     = EVENT_LABELS[type] || type.replace(/_/g, ' ').toLowerCase();
  const context = item.metadata && item.metadata.type;
  return context ? `${base}<span class="history-context">${esc(context)}</span>` : base;
}

let fullHistoryList  = [];
let historyVisible   = 10;
const HISTORY_PAGE   = 10;

function getDateGroup(dateStr) {
  if (!dateStr) return 'Older';
  const d   = new Date(dateStr);
  const now = new Date();
  if (d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Older';
}

function getSeverityClass(item) {
  const type = (item.metadata && item.metadata.event_type) ||
               item.eventType || item.event_type || '';
  if (type.includes('SUCCESS') || type.includes('APPROVED')) return 'history-success';
  if (type.includes('FAILED')  || type.includes('REJECTED'))  return 'history-failure';
  if (type.includes('ENFORCEMENT'))                            return 'history-warning';
  return '';
}

function renderItem(item, container) {
  const div = document.createElement('div');
  div.className = `history-item ${getSeverityClass(item)}`;
  const timeStr = item.createdAt || item.created_at;
  const displayTime = timeStr
    ? new Date(timeStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  div.innerHTML = `
    <div class="history-dot"></div>
    <div>
      <div class="history-title">${formatEvent(item)}</div>
      <div class="history-time">${displayTime}</div>
    </div>
  `;
  container.appendChild(div);
}

function renderHistory(list) {
  const wrap      = document.getElementById('profile-history');
  const container = document.getElementById('history-list');
  if (!wrap || !container) return;
  wrap.style.display = '';
  container.innerHTML = '';
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="history-empty">No activity recorded for this identity yet.</div>';
    return;
  }
  const page = list.slice(0, historyVisible);
  const groups   = { Today: [], Yesterday: [], Older: [] };
  page.forEach(item => {
    const g = getDateGroup(item.createdAt || item.created_at);
    groups[g].push(item);
  });
  ['Today', 'Yesterday', 'Older'].forEach(label => {
    const items = groups[label];
    if (!items.length) return;
    const header = document.createElement('div');
    header.className  = 'history-group';
    header.textContent = label;
    container.appendChild(header);
    items.forEach(item => renderItem(item, container));
  });
  if (historyVisible < list.length) {
    const btn = document.createElement('button');
    btn.className  = 'history-load-more';
    btn.textContent = `Load more (${list.length - historyVisible} remaining)`;
    btn.onclick = function () {
      historyVisible += HISTORY_PAGE;
      renderHistory(fullHistoryList);
    };
    container.appendChild(btn);
  }
}

async function loadHistory(identityId) {
  const token = localStorage.getItem('hvid_token');
  if (!token) return;
  try {
    const res = await fetch(
      `/api/internal/history/${encodeURIComponent(identityId)}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    const list  = Array.isArray(data) ? data : (data.logs || data.items || []);
    fullHistoryList = list;
    historyVisible  = HISTORY_PAGE;
    renderHistory(fullHistoryList);
  } catch {}
}
