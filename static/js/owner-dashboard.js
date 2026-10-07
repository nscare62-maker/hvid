/**
 * HVID — Owner Control Dashboard
 * Loads identity status, security status, verification state,
 * match activity, and wires control actions (freeze/recover).
 *
 * API connections (extended):
 *   GET /api/identity/:id              — identity data (status, verificationLevel)
 *   GET /api/security/status/:id      — security status, flags
 *   GET /api/internal/history/:id     — activity timeline (real events)
 *   GET /api/asset/identity/:id       — user assets for guidance
 */
'use strict';

(function OwnerDashboard() {

  // ── Fallback data when API unavailable ────────────────────────
  const MOCK = {
    security:       { status: 'ACTIVE', lastActivityAt: new Date().toISOString(), flagCount: 0 },
    activity:       [
      { icon: '✓', text: 'Identity created', time: 'Today', type: 'success' },
      { icon: '⚠', text: 'Verification pending', time: 'Today', type: 'warn' },
    ],
    matchCount:     0,
    verif:          { phone: false, kyc: false, face: false },
    tier:           'BASIC',
    trustSignal:    'MODERATE',
    identityStatus: 'ACTIVE',
  };

  // ── Clean SVG icons for events ──
  const I_CHECK  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const I_WARN   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  const I_CAMERA = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
  const I_DOC    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"></rect><circle cx="8" cy="11" r="3"></circle><path d="M14 9h4"></path><path d="M14 13h4"></path><path d="M5 18c0-1.7 1.3-3 3-3s3 1.3 3 3"></path></svg>';
  const I_LINK   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  const I_LOCK   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  const I_SHIELD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';

  // ── Event type → timeline UI map (matches HistoryEventType enum) ─
  const EVENT_MAP = {
    IDENTITY_CREATED:           { icon: I_SHIELD, text: 'Identity created' },
    ASSET_ADDED:                { icon: I_LINK,   text: 'Asset added' },
    ASSET_VERIFIED:             { icon: I_CHECK,  text: 'Asset verified' },
    ASSET_OWNERSHIP_LOST:       { icon: I_WARN,   text: 'Asset ownership updated' },
    ASSET_OWNERSHIP_GAINED:     { icon: I_CHECK,  text: 'Asset ownership confirmed' },
    VERIFICATION_LEVEL_CHANGED: { icon: I_CHECK,  text: 'Verification level updated' },
    ENFORCEMENT_LEVEL_CHANGED:  { icon: I_WARN,   text: 'Status updated' },
    MATCH_QUERY_RECORDED:       { icon: I_SHIELD, text: 'Profile checked' },
    MATCH_QUERIED:              { icon: I_SHIELD, text: 'Profile searched' },
    MATCH_RESOLVED:             { icon: I_CHECK,  text: 'Match resolved' },
    REPORT_SUBMITTED:           { icon: I_WARN,   text: 'Report submitted' },
    KYC_SUBMITTED:              { icon: I_DOC,    text: 'KYC submitted' },
    KYC_RESULT:                 { icon: I_CHECK,  text: 'KYC reviewed' },
    FACE_SUBMITTED:             { icon: I_CAMERA, text: 'Face verification submitted' },
    FACE_RESULT:                { icon: I_CHECK,  text: 'Face verification reviewed' },
    TIER_UPDATED:               { icon: I_CHECK,  text: 'Identity tier updated' },
    SECURITY_EVENT:             { icon: I_LOCK,   text: 'Security event recorded' },
    DEDUP_LINK_CREATED:         { icon: I_LINK,   text: 'Duplicate link flagged' },
    VERIFICATION_EVENT:         { icon: I_CHECK,  text: 'Verification event' },
    RISK_UPDATED:               { icon: I_WARN,   text: 'Risk profile updated' },
    INPUT_PROCESSED:            { icon: I_SHIELD, text: 'Input processed' },
    QUERY_PATTERN_DETECTED:     { icon: I_WARN,   text: 'Query pattern detected' },
  };

  // ── Signal palette for trust display ──────────
  const TRUST_CFG = {
    STABLE:                { label: 'Stable Identity',       color: '#10b981', icon: '✓' },
    UNDER_REVIEW:          { label: 'Under Review',          color: '#f59e0b', icon: '⚠' },
    REQUIRES_REVALIDATION: { label: 'Revalidation Required', color: '#fb923c', icon: '⟳' },
    LIMITED:               { label: 'Limited Trust',         color: '#ef4444', icon: '✕' },
    SUSPENDED:             { label: 'Suspended Identity',    color: '#991b1b', icon: '✕' },
    STRONG:    { label: 'Stable Identity',       color: '#10b981', icon: '✓' },
    MODERATE:  { label: 'Under Review',          color: '#f59e0b', icon: '⚠' },
    CAUTION:   { label: 'Revalidation Required', color: '#fb923c', icon: '⟳' },
    HIGH_RISK: { label: 'Limited Trust',         color: '#ef4444', icon: '✕' },
  };

  const STATUS_CFG = {
    ACTIVE:   { label: 'Active',         color: '#34d399', cls: 'badge-verified' },
    FROZEN:   { label: 'Frozen',         color: '#f87171', cls: 'badge-flagged'  },
    RECOVERY: { label: 'Under Recovery', color: '#fbbf24', cls: 'badge-pending'  },
  };

  function g(id) { return document.getElementById(id); }
  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Time formatter ───────────────────────────────────────────
  function timeAgo(isoStr) {
    if (!isoStr) return 'No recent activity';
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
    return new Date(isoStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
  }

  // ── API: fetch identity data ─────────────────────────────────
  async function fetchIdentity(identityId) {
    try {
      const r = await fetch(`/api/identity/${identityId}`, {
        headers: window.Auth ? Auth.apiHeaders() : {},
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  // ── API: fetch security status ────────────────────
  async function fetchSecurity(identityId) {
    try {
      const r = await fetch(`/api/security/status/${identityId}`, {
        headers: window.Auth ? Auth.apiHeaders() : {},
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  // ── API: fetch history events ────────────────────────────────
  async function fetchHistory(identityId) {
    try {
      const r = await fetch(`/api/internal/history/${identityId}`, {
        headers: window.Auth ? Auth.apiHeaders() : {},
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  // ── API: fetch assets ────────────────────────────────────────
  async function fetchAssets(identityId) {
    try {
      const r = await fetch(`/api/asset/identity/${identityId}`, {
        headers: window.Auth ? Auth.apiHeaders() : {},
      });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }

  // ── Skeleton loading state ───────────────────────────────────
  const SKEL_STYLE = 'background:rgba(255,255,255,.06);border-radius:6px;height:14px;margin:6px 0;animation:skelPulse 1.4s ease-in-out infinite';
  function skelHtml(lines = 2) {
    return Array.from({length: lines}, (_, i) =>
      `<div style="${SKEL_STYLE};width:${i===0?'70%':'45%'}"></div>`
    ).join('');
  }

  function showSkeletons() {
    const targets = [
      'db-trust-signal', 'db-last-activity', 'db-security-alerts',
      'db-activity-list', 'db-verif-list', 'db-trust-insight',
    ];
    targets.forEach(id => { const el = g(id); if (el) el.innerHTML = skelHtml(2); });
    const countEl = g('db-match-count');
    if (countEl) countEl.textContent = '…';
    if (!document.getElementById('hvid-skel-css')) {
      const s = document.createElement('style');
      s.id = 'hvid-skel-css';
      s.textContent = `@keyframes skelPulse { 0%,100%{opacity:.4} 50%{opacity:.9} }`;
      document.head.appendChild(s);
    }
  }

  function showDashboardError() {
    const listEl = g('db-activity-list');
    if (listEl) listEl.innerHTML = `<div style="font-size:13px;color:var(--color-text-muted);padding:16px 0">Unable to load dashboard. Check your connection.</div>`;
  }

  // ── S1: Identity Status Card ─────────────────────────────────
  function renderStatusCard(session, security, identity) {
    const verLevel = identity?.verificationLevel ?? session?.verificationLevel ?? 0;
    const tier     = verLevel >= 3 ? 'PREMIUM' : verLevel >= 2 ? 'PROFESSIONAL' : 'BASIC';
    const signalKey = (security?.flagCount >= 2) ? 'LIMITED'
                    : (security?.flagCount >= 1) ? 'REQUIRES_REVALIDATION'
                    : (verLevel >= 2)            ? 'STABLE' : 'UNDER_REVIEW';
    const ts       = window.TrustSignalUI
      ? window.TrustSignalUI.resolveTrustState(signalKey)
      : (TRUST_CFG[signalKey] || TRUST_CFG.UNDER_REVIEW);
    const statusK  = security?.status || identity?.status || 'ACTIVE';
    const statusCfg= STATUS_CFG[statusK] || STATUS_CFG.ACTIVE;

    const tierSlot = g('db-tier-slot');
    if (tierSlot && window.TierUI) {
      tierSlot.innerHTML = '';
      tierSlot.appendChild(TierUI.badge(tier));
    }

    const typeSlot = g('db-identity-type');
    if (typeSlot && window.IdentityTypeUI) {
      const _it = identity?.identityType || identity?.identity_type || session?.identity_type || 'PERSONAL';
      typeSlot.innerHTML = '';
      typeSlot.appendChild(IdentityTypeUI.badge(_it));
    }

    const typeInfo = g('db-identity-type-info');
    if (typeInfo && window.IdentityTypeUI) {
      const _it = identity?.identityType || identity?.identity_type || session?.identity_type || 'PERSONAL';
      const _showCta = verLevel < 2;
      typeInfo.innerHTML = IdentityTypeUI.dashboardBlock(_it, _showCta);
    }

    const sigEl = g('db-trust-signal');
    if (sigEl) {
      sigEl.style.color = '';
      sigEl.innerHTML =
        '<span style="font-weight:700;color:' + ts.color + '">' +
          (ts.icon || '') + ' ' + (ts.title || ts.label) +
        '</span>' +
        '<span style="display:block;font-size:11px;color:rgba(255,255,255,.38);margin-top:3px">' +
          (ts.desc || '') +
        '</span>';
    }

    const stEl = g('db-identity-status');
    if (stEl) {
      stEl.textContent = statusCfg.label;
      stEl.className   = `badge ${statusCfg.cls}`;
    }

    const hvidEl = g('db-hvid-id');
    if (hvidEl) {
      const shortId = identity?.id
        ? 'HVID-' + identity.id.slice(0,8).toUpperCase()
        : session?.hvid || null;
      if (shortId) hvidEl.textContent = shortId;
    }

    if (statusK === 'FROZEN') {
      const banner = g('db-frozen-banner');
      if (banner) banner.style.display = 'flex';
    }

    // ── Task 6: Dashboard (Reverify CTA) ──────────────────────────
    if (statusK === 'REVERIFY_REQUIRED') {
      const banner = g('db-reverify-banner');
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div style="background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.2);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px;width:100%">
            <div style="font-size:24px">🔁</div>
            <div style="flex:1">
              <div style="font-weight:700;color:#fb923c;margin-bottom:2px">Re-verification Required</div>
              <div style="font-size:12px;color:rgba(255,255,255,.5)">Your verification has expired or suspicious activity was detected. Re-verify to restore full trust.</div>
            </div>
            <a href="/dashboard/verification" class="btn btn-primary btn-sm" style="background:#fb923c;border-color:#fb923c">Reverify Now</a>
          </div>`;
      }
    }
  }

  // ── S2: Security Status ──────────────────────────────────────
  function renderSecurityCard(security) {
    const sec = security || MOCK.security;
    const lastEl = g('db-last-activity');
    if (lastEl) {
      lastEl.textContent = sec.lastActivityAt
        ? `Last active: ${timeAgo(sec.lastActivityAt)}`
        : 'No recent activity';
    }
    const secStatusEl = g('db-sec-status');
    if (secStatusEl) {
      const cfg = STATUS_CFG[sec.status] || STATUS_CFG.ACTIVE;
      secStatusEl.textContent = cfg.label;
      secStatusEl.style.color = cfg.color;
    }
    const alertsRow = g('db-security-alerts');
    if (alertsRow) {
      if (sec.flagCount > 0) {
        alertsRow.innerHTML = `
          <div class="report-item" style="border-color:rgba(251,191,36,.15);background:rgba(251,191,36,.04)">
            <div class="report-type-dot alert"></div>
            <div style="flex:1">
              <div class="report-title" style="color:#fbbf24">Unusual activity detected</div>
              <div class="report-desc">Your identity has ${sec.flagCount} active flag${sec.flagCount>1?'s':''}. Monitor closely.</div>
            </div>
          </div>`;
      } else {
        alertsRow.innerHTML = `<div style="font-size:13px;color:var(--color-text-muted);padding:4px 0">No active alerts.</div>`;
      }
    }
  }

  // ── S3: Activity Timeline ──────────────
  function renderTimeline(history) {
    const listEl = g('db-activity-list');
    if (!listEl) return;
    if (history && history.length > 0) {
      const MAX_ITEMS = 8;
      const shown = history.slice(0, MAX_ITEMS);
      listEl.innerHTML = shown.map(ev => {
        const def = EVENT_MAP[ev.eventType] || { icon: '◦', text: ev.eventType };
        const ts  = ev.createdAt ? timeAgo(ev.createdAt) : '';
        return `
          <div class="report-item" style="border-bottom:1px solid var(--color-border);padding:10px 0;display:flex;align-items:center;gap:10px">
            <div style="font-size:16px;width:24px;flex-shrink:0;text-align:center;display:flex;align-items:center;justify-content:center">${String(def.icon).indexOf('<svg') !== -1 ? def.icon : esc(def.icon)}</div>
            <div style="flex:1">
              <div class="report-title" style="font-size:13px">${esc(def.text)}</div>
            </div>
            <div class="report-time" style="font-size:11px;color:var(--color-text-muted);white-space:nowrap">${esc(ts)}</div>
          </div>`;
      }).join('');
      if (history.length > MAX_ITEMS) {
        listEl.insertAdjacentHTML('beforeend',
          `<div style="font-size:12px;color:var(--color-text-muted);padding:8px 0;text-align:center"><a href="/dashboard/timeline" style="color:#818cf8;text-decoration:none">View full timeline →</a></div>`);
      }
    } else {
      listEl.innerHTML = MOCK.activity.map(item =>
        `<div class="report-item" style="border-bottom:1px solid var(--border-color);padding:10px 0;display:flex;align-items:center;gap:10px">
          <div style="font-size:16px;width:24px;flex-shrink:0;text-align:center;display:flex;align-items:center;justify-content:center">${String(item.icon).indexOf('<svg') !== -1 ? item.icon : esc(item.icon)}</div>
          <div style="flex:1"><div class="report-title" style="font-size:13px">${esc(item.text)}</div></div>
          <div class="report-time" style="font-size:11px;color:var(--color-text-muted)">${esc(item.time)}</div>
        </div>`).join('');
    }
  }

  // ── S5: Verification Checklist ──────
  function renderVerifStatus(verificationLevel) {
    const el = g('db-verif-list');
    if (!el) return;
    const level = verificationLevel ?? 0;
    const items = [
      { label: 'Phone verified',        done: level >= 1 },
      { label: 'KYC documents',         done: level >= 2 },
      { label: 'Face verification',     done: level >= 3 },
    ];
    el.innerHTML = items.map(it => `
      <div class="profile-verif-item">
        <span class="profile-verif-check" style="${it.done ? '' : 'background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.2)'}">
          ${it.done ? '✓' : '○'}
        </span>
        <span style="color:${it.done ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'};font-size:13px">
          ${esc(it.label)}
        </span>
        ${it.done ? '' : `<a href="/dashboard/verification" style="font-size:11px;color:#818cf8;text-decoration:none;margin-left:auto">Add →</a>`}
      </div>`).join('');
  }

  // ── S6: Match Activity ──────────────────
  function renderMatchActivity(history) {
    const el = g('db-match-count');
    if (!el) return;
    if (history && Array.isArray(history)) {
      const count = history.filter(ev =>
        ev.eventType === 'MATCH_QUERY_RECORDED' ||
        ev.eventType === 'MATCH_QUERIED'
      ).length;
      el.textContent = count;
    } else {
      el.textContent = MOCK.matchCount;
    }
  }

  // ── S8: User Guidance (Progress + Next Steps) ───────────────
  function renderGuidance(assets, verificationLevel) {
    const slot = g('db-guidance-slot');
    if (!slot) return;

    const hasInsta = assets.some(a => a.type === 'instagram' && a.verificationStatus === 'verified');
    const hasWeb   = assets.some(a => a.type === 'website' && a.verificationStatus === 'verified');
    const hasAny   = assets.length > 0;
    const hasCustomOnly = hasAny && !hasInsta && !hasWeb;

    // Task 1: Checklist
    const checklist = `
      <div class="db-guidance-checklist">
        <div class="db-guidance-item done">✓ Verify phone</div>
        <div class="db-guidance-item ${hasInsta ? 'done' : ''}">${hasInsta ? '✓' : '○'} Add Instagram</div>
        <div class="db-guidance-item ${hasWeb ? 'done' : ''}">${hasWeb ? '✓' : '○'} Add Website</div>
      </div>`;

    // Task 2: Suggestion
    let suggestion = '';
    if (!hasAny) {
      suggestion = 'Add your first verified account to establish trust.';
    } else if (hasCustomOnly) {
      suggestion = 'Add a verified CORE account (Instagram/Website) for higher trust.';
    } else if (!hasInsta || !hasWeb) {
      suggestion = 'Complete your profile with more verified signals.';
    } else {
      slot.style.display = 'none'; // Everything done
      return;
    }

    // Task 3: Prompts
    const prompts = [];
    if (!hasInsta) prompts.push(`<a href="/dashboard/linked-accounts" class="db-guidance-cta">Verify Instagram →</a>`);
    if (!hasWeb)   prompts.push(`<a href="/dashboard/linked-accounts" class="db-guidance-cta">Verify Website →</a>`);

    slot.innerHTML = `
      <div class="db-guidance">
        <div class="db-guidance-title">✨ Complete your identity</div>
        ${checklist}
        <div class="db-guidance-next">
          <span style="font-size:18px">💡</span>
          ${suggestion}
        </div>
        <div style="display:flex;gap:12px">${prompts.join('')}</div>
      </div>`;
  }

  // ── S7: Trust Insights ────────────────────────────────────────────────────────
  function renderTrustInsights(verificationLevel, security, lastChangedAt) {
    const el = g('db-trust-insight');
    if (!el) return;
    const level = verificationLevel ?? 0;
    const flags = security?.flagCount || 0;
    const signalKey = flags >= 2 ? 'LIMITED'
                    : flags >= 1 ? 'REQUIRES_REVALIDATION'
                    : level >= 2 ? 'STABLE' : 'UNDER_REVIEW';
    if (window.TrustSignalUI) {
      const ts = window.TrustSignalUI.resolveTrustState(signalKey);
      el.innerHTML = window.TrustSignalUI.buildTrustCard(ts, lastChangedAt || null, true);
    } else {
      const cfg = TRUST_CFG[signalKey] || TRUST_CFG.STABLE;
      el.innerHTML =
        '<span style="font-weight:600;color:' + cfg.color + '">' + cfg.icon + ' ' + cfg.label + '</span>';
    }
  }

  // ── Freeze modal ───────────────────────────────────────────────
  function openFreezeModal(identityId, session) {
    if (window.Auth && !Auth.getToken()) {
      window.HVID?.toast('Sign in required to perform this action.', 'error');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'growth-modal-overlay';
    overlay.innerHTML = `
      <div class="growth-modal" role="dialog" aria-modal="true" aria-labelledby="freeze-modal-title" style="max-width:400px">
        <div class="growth-modal-header">
          <div>
            <div class="growth-modal-title" id="freeze-modal-title">Freeze your identity?</div>
            <div class="growth-modal-sub">This will temporarily restrict all activity.</div>
          </div>
          <button class="growth-modal-close" id="freeze-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="growth-modal-body" style="padding:16px 24px 20px">
          <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;line-height:1.6">
            While frozen, your identity cannot be matched or verified. You can unfreeze at any time via Recovery.
          </div>
          <div style="display:flex;gap:10px">
            <button id="freeze-confirm-btn" class="btn btn-primary btn-sm" style="flex:1;background:#f87171;border-color:#f87171">Freeze Now</button>
            <button id="freeze-cancel-btn" class="btn btn-ghost btn-sm" style="flex:1">Cancel</button>
          </div>
          <div id="freeze-result" style="font-size:12px;color:var(--color-text-muted);margin-top:10px;text-align:center" role="status" aria-live="polite"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    document.getElementById('freeze-modal-close').onclick = close;
    document.getElementById('freeze-cancel-btn').onclick  = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('freeze-confirm-btn').onclick = async () => {
      const resultEl = document.getElementById('freeze-result');
      const confirmBtn = document.getElementById('freeze-confirm-btn');
      resultEl.textContent = 'Processing…';
      confirmBtn.disabled = true;
      try {
        const r = await fetch('/api/security/freeze', {
          method:  'POST',
          headers: window.Auth ? Auth.apiHeaders() : { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ identity_id: identityId, reason: 'User initiated freeze' }),
        });
        if (r.status === 401) { handleActionError(401); return; }
        if (r.ok) {
          resultEl.style.color = '#34d399';
          resultEl.textContent = 'Your identity has been frozen.';
          window.HVID?.toast('Identity frozen.', 'success');
          setTimeout(async () => { close(); await refreshState(identityId, session); }, 1200);
        } else {
          const d = await r.json().catch(() => ({}));
          resultEl.style.color = '#f87171';
          resultEl.textContent = d.message || 'Action could not be completed. Try again.';
          confirmBtn.disabled = false;
        }
      } catch {
        resultEl.style.color = '#fbbf24';
        resultEl.textContent = 'Connection error. Action could not be completed.';
        confirmBtn.disabled = false;
      }
    };
  }

  function handleActionError(status) {
    if (status === 401) {
      window.HVID?.toast('Session expired. Signing you out.', 'error');
      setTimeout(() => { if (window.Auth) { Auth.logout(); window.location.href = Auth._loginPath(); } }, 1200);
    } else {
      window.HVID?.toast('Action could not be completed. Try again.', 'error');
    }
  }

  async function refreshState(identityId, session) {
    if (!identityId) return;
    try {
      const [idResult, secResult] = await Promise.allSettled([
        fetchIdentity(identityId),
        fetchSecurity(identityId),
      ]);
      const identity = idResult.status  === 'fulfilled' ? idResult.value  : null;
      const security = secResult.status === 'fulfilled' ? secResult.value : null;
      const verLevel = identity?.verificationLevel ?? session?.verificationLevel ?? 0;
      renderStatusCard(session, security, identity);
      renderSecurityCard(security);
      renderTrustInsights(verLevel, security);
    } catch (err) { console.warn('[HVID] refreshState failed:', err?.message); }
  }

  async function startRecovery(identityId, session) {
    if (window.Auth && !Auth.getToken()) {
      window.HVID?.toast('Sign in required to perform this action.', 'error');
      return;
    }
    const btn = g('db-recover-btn');
    if (btn) { btn.textContent = 'Starting…'; btn.disabled = true; }
    try {
      const r = await fetch('/api/security/recover/start', {
        method:  'POST',
        headers: window.Auth ? Auth.apiHeaders() : { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identity_id: identityId }),
      });
      if (r.status === 401) { handleActionError(401); return; }
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        window.HVID?.toast('Recovery process started.', 'success');
        await refreshState(identityId, session);
        openCompleteRecoveryModal(identityId, session);
      } else { window.HVID?.toast(d.message || 'Recovery unavailable.', 'info'); }
    } catch { window.HVID?.toast('Action could not be completed. Try again.', 'error');
    } finally { if (btn) { btn.textContent = 'Recover Identity'; btn.disabled = false; } }
  }

  function openCompleteRecoveryModal(identityId, session) {
    const overlay = document.createElement('div');
    overlay.className = 'growth-modal-overlay';
    overlay.innerHTML = `
      <div class="growth-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-modal-title" style="max-width:440px">
        <div class="growth-modal-header">
          <div>
            <div class="growth-modal-title" id="recovery-modal-title">Complete Recovery</div>
            <div class="growth-modal-sub">Re-verify your identity to restore full access.</div>
          </div>
          <button class="growth-modal-close" id="recovery-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="growth-modal-body" style="padding:16px 24px 20px">
          <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:20px;line-height:1.7">
            Your identity is now in recovery mode. Click <strong>Complete Recovery</strong> below to finalise.
          </div>
          <div style="display:flex;gap:10px;flex-direction:column">
            <button id="recovery-complete-btn" class="btn btn-primary btn-sm">✓ Complete Recovery</button>
            <a href="/dashboard/verification" class="btn btn-ghost btn-sm" style="text-align:center;text-decoration:none">Re-verify identity →</a>
          </div>
          <div id="recovery-result" style="font-size:12px;margin-top:12px;text-align:center" role="status" aria-live="polite"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    document.getElementById('recovery-modal-close').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('recovery-complete-btn').onclick = async () => {
      const resultEl  = document.getElementById('recovery-result');
      const completeBtn = document.getElementById('recovery-complete-btn');
      resultEl.textContent = 'Processing…';
      completeBtn.disabled = true;
      try {
        const r = await fetch('/api/security/recover/complete', {
          method:  'POST',
          headers: window.Auth ? Auth.apiHeaders() : { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ identity_id: identityId }),
        });
        if (r.status === 401) { handleActionError(401); return; }
        if (r.ok) {
          resultEl.style.color = '#34d399';
          resultEl.textContent = 'Recovery completed. Identity restored.';
          window.HVID?.toast('Identity restored.', 'success');
          setTimeout(async () => { close(); await refreshState(identityId, session); }, 1400);
        } else {
          const d = await r.json().catch(() => ({}));
          resultEl.style.color = '#f87171';
          resultEl.textContent = d.message || 'Action failed.';
          completeBtn.disabled = false;
        }
      } catch {
        resultEl.style.color = '#fbbf24';
        resultEl.textContent = 'Connection error.';
        completeBtn.disabled = false;
      }
    };
  }

  async function init() {
    if (window.Auth && !Auth.isLoggedIn()) {
      window.location.href = Auth._loginPath();
      return;
    }
    const session    = window.Auth && Auth.getSession && Auth.getSession();
    const identityId = session?.identityId || session?.hvid || '';
    showSkeletons();

    let identity = null, security = null, history = null, assets = [];
    if (identityId) {
      const [idR, secR, histR, assetR] = await Promise.allSettled([
        fetchIdentity(identityId),
        fetchSecurity(identityId),
        fetchHistory(identityId),
        fetchAssets(identityId),
      ]);
      identity = idR.status  === 'fulfilled' ? idR.value  : null;
      security = secR.status === 'fulfilled' ? secR.value : null;
      history  = histR.status=== 'fulfilled' ? histR.value: null;
      assets   = assetR.status === 'fulfilled' ? assetR.value : [];
    } else { showDashboardError(); }

    const verLevel = identity?.verificationLevel ?? session?.verificationLevel ?? 0;

    renderStatusCard(session, security, identity);
    renderSecurityCard(security);
    renderTimeline(history);
    renderVerifStatus(verLevel);
    renderMatchActivity(history);
    renderTrustInsights(verLevel, security);
    renderGuidance(assets, verLevel);

    const vmSlot = g('db-verify-me-slot');
    if (vmSlot && window.Growth) Growth.verifyMeBtn(vmSlot, { style: 'background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;color:#34d399;cursor:pointer' });

    const frzBtn = g('db-freeze-btn');
    if (frzBtn && identityId) frzBtn.onclick = () => openFreezeModal(identityId, session);

    const recBtn = g('db-recover-btn');
    if (recBtn && identityId) recBtn.onclick = () => startRecovery(identityId, session);

    const upgBtn = g('db-upgrade-btn');
    if (upgBtn) upgBtn.onclick = () => window.location.href = '/dashboard/verification';

    const upgradeSlot = g('growth-upgrade-slot');
    if (upgradeSlot && window.Growth) Growth.upgradeCta(upgradeSlot, session?.tier || 'BASIC');

    const logoutBtn = g('logout-btn');
    if (logoutBtn && window.Auth) {
      logoutBtn.addEventListener('click', e => { e.preventDefault(); Auth.logout(); window.location.href = Auth._loginPath(); });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.OwnerDashboard = { init };
})();
