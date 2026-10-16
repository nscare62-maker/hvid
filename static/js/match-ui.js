/**
 * HVID — Match UI Engine
 * ─────────────────────────────────────────────────────────────────
 * Trust signal display delegates to TrustSignalUI (trust-signal.js).
 * Supported values: STABLE · UNDER_REVIEW · REQUIRES_REVALIDATION · LIMITED · SUSPENDED
 *
 * Renders into #match-output-container (injected above result-container).
 * If API unavailable: silently falls back — mock UI from result.js remains.
 *
 * UX SAFETY RULES:
 *   - Never accusatory — all messages neutral
 *   - Never show raw score, factors, reports
 *   - Color signals are advisory only
 */
'use strict';

const MatchUI = (() => {

  // ── Signal resolution ─────────────────────────────────────────
  // Delegates to TrustSignalUI (trust-signal.js) — single source of truth.
  // Falls back to a neutral config if trust-signal.js not yet loaded.
  function _sig(signal) {
    if (window.TrustSignalUI) return window.TrustSignalUI.resolveTrustState(signal);
    // Minimal inline fallback (only used if script load order is wrong)
    const FALLBACK = {
      STABLE:                { title: 'Stable Identity',         color: '#34d399', bg: 'rgba(52,211,153,.08)',   border: 'rgba(52,211,153,.18)',   glow: 'rgba(52,211,153,.10)',   icon: '✔', desc: 'No issues detected.' },
      UNDER_REVIEW:          { title: 'Under Review',            color: '#fbbf24', bg: 'rgba(251,191,36,.07)',   border: 'rgba(251,191,36,.2)',    glow: 'rgba(251,191,36,.08)',   icon: '⚠', desc: 'Some signals require attention.' },
      REQUIRES_REVALIDATION: { title: 'Revalidation Required',   color: '#fb923c', bg: 'rgba(251,146,60,.07)',   border: 'rgba(251,146,60,.2)',    glow: 'rgba(251,146,60,.08)',   icon: '🔁', desc: 'Recent changes detected.' },
      LIMITED:               { title: 'Limited Trust',           color: '#f87171', bg: 'rgba(248,113,113,.07)', border: 'rgba(248,113,113,.2)',   glow: 'rgba(248,113,113,.08)', icon: '⛔', desc: 'Usage restricted.' },
      SUSPENDED:             { title: 'Suspended Identity',      color: '#991b1b', bg: 'rgba(153,27,27,.10)',   border: 'rgba(153,27,27,.25)',    glow: 'rgba(153,27,27,.08)',   icon: '🚫', desc: 'This identity is blocked.' },
      // Legacy aliases
      STRONG:    { title: 'Stable Identity',       color: '#34d399', bg: 'rgba(52,211,153,.08)',   border: 'rgba(52,211,153,.18)',   glow: 'rgba(52,211,153,.10)',   icon: '✔', desc: '' },
      MODERATE:  { title: 'Under Review',          color: '#fbbf24', bg: 'rgba(251,191,36,.07)',   border: 'rgba(251,191,36,.2)',    glow: 'rgba(251,191,36,.08)',   icon: '⚠', desc: '' },
      CAUTION:   { title: 'Revalidation Required', color: '#fb923c', bg: 'rgba(251,146,60,.07)',   border: 'rgba(251,146,60,.2)',    glow: 'rgba(251,146,60,.08)',   icon: '🔁', desc: '' },
      HIGH_RISK: { title: 'Limited Trust',         color: '#f87171', bg: 'rgba(248,113,113,.07)', border: 'rgba(248,113,113,.2)',   glow: 'rgba(248,113,113,.08)', icon: '⛔', desc: '' },
    };
    return FALLBACK[signal] || FALLBACK.UNDER_REVIEW;
  }

  const STATUS_LABELS = {
    MATCH_CONFIRMED: 'Match Found',
    NO_MATCH:        'No Match Found',
    PARTIAL_MATCH:   'Possible Match',
    UNDER_REVIEW:    'Under Review',
  };

  // Check if identity_id matches the logged-in user (for challenge button visibility)
  function _isOwnIdentity(id) {
    if (!id || typeof HVID_API === 'undefined') return false;
    const myId = HVID_API.auth.identityId();
    return myId && myId === id;
  }

  const FLAG_LABELS = {
    UNDER_REVIEW:         'Under Review',
    RECENT_ACTIVITY:      'Recent Changes',
    MULTIPLE_IDENTITIES:  'Multiple Identities Linked',
    VERIFICATION_PENDING: 'Verification Pending',
  };

  // ── CSS (injected once) ─────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hvid-matchui-styles')) return;
    const s = document.createElement('style');
    s.id = 'hvid-matchui-styles';
    s.textContent = `
      /* ── Wrapper ──────────────────────────────────────────── */
      #match-output-container { margin-bottom: 20px; }
      .mo-card {
        border-radius: 16px; padding: 0;
        overflow: hidden; border: 1px solid;
        transition: box-shadow .3s;
      }
      .mo-card:hover { box-shadow: 0 0 0 2px var(--color-border-hover); }

      /* ── S1 Status header ─────────────────────────────────── */
      .mo-status-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 20px;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-primary);
        font-size: 13px; font-weight: 700; letter-spacing: .03em;
      }
      .mo-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .mo-confidence {
        margin-left: auto; font-size: 11px; font-weight: 600;
        padding: 2px 8px; border-radius: 99px;
        background: var(--color-accent-soft);
        color: var(--color-text-secondary);
        letter-spacing: .04em;
      }

      /* ── S5 Flags ─────────────────────────────────────────── */
      .mo-flags {
        padding: 12px 24px 16px; display: flex; flex-wrap: wrap; gap: 8px;
        border-top: 1px solid var(--color-border);
      }
      .mo-flag {
        font-size: 11px; font-weight: 600; padding: 3px 9px;
        border-radius: 99px; letter-spacing: .03em;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      /* ── S6 Actions ───────────────────────────────────────── */
      .mo-actions {
        padding: 16px 24px;
        border-top: 1px solid var(--color-border);
        display: flex; gap: 10px; flex-wrap: wrap;
      }
      .mo-btn {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 600; padding: 8px 16px;
        border-radius: 8px; border: 1px solid; cursor: pointer;
        text-decoration: none; transition: opacity .15s, transform .1s;
        white-space: nowrap;
      }
      .mo-btn:hover { opacity: .82; transform: translateY(-1px); }
      .mo-btn-ghost {
        background: var(--color-surface);
        border-color: var(--color-border);
        color: var(--color-text-primary);
      }
      .mo-btn-primary {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
      }

      /* ── S7 Empty state ───────────────────────────────────── */
      .mo-empty { text-align: center; padding: 36px 24px; }
      .mo-empty-icon { font-size: 36px; margin-bottom: 12px; }
      .mo-empty-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
      .mo-empty-desc  { font-size: 13px; color: var(--color-text-secondary); margin-bottom:20px; }

      /* ── Loading ──────────────────────────────────────────── */
      .mo-loading {
        display: flex; align-items: center; gap: 12px;
        padding: 24px; font-size: 13px; color: var(--color-text-secondary);
      }
      .mo-spinner {
        width:18px; height:18px; border-radius:50%;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-primary);
        animation: moSpin .7s linear infinite;
        flex-shrink:0;
      }
      @keyframes moSpin { to { transform: rotate(360deg); } }

      /* ── Explanation Section ─────────────────────────────── */
      .mo-explanation {
        padding: 16px 24px;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
      }
      .mo-explanation-title {
        font-size: 11px; font-weight: 700; color: var(--color-text-secondary);
        text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px;
      }
      .mo-explanation-reason {
        font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 12px;
      }
      .mo-signal-list { display: flex; flex-direction: column; gap: 6px; }
      .mo-signal-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .mo-signal-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 9px; flex-shrink: 0; }
      .mo-signal-icon.match { background: rgba(52,211,153,.1); color: #34d399; border: 1px solid rgba(52,211,153,.2); }
      .mo-signal-icon.mismatch { background: rgba(248,113,113,.1); color: #f87171; border: 1px solid rgba(248,113,113,.2); }

      /* ── Trust Meter ───────────────────────────────────────── */
      .mo-trust-meter { padding: 16px 24px 0; }
      .mo-meter-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .mo-meter-label { font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: .08em; }
      .mo-meter-tooltip { font-size: 10px; color: var(--color-text-secondary); cursor: help; }
      .mo-meter-track { height: 6px; background: var(--color-surface-3); border-radius: 99px; overflow: hidden; }
      .mo-meter-fill { height: 100%; border-radius: 99px; transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1); }

      @media (max-width: 480px) {
        .mo-actions { flex-direction: column; }
        .mo-btn { justify-content: center; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Show loading state ──────────────────────────────────────
  function showLoading(container) {
    container.innerHTML = `
      <div class="mo-card" style="border-color:var(--color-border);background:var(--color-surface)">
        <div class="mo-loading">
          <div class="mo-spinner"></div>
          <span>Analyzing identity…</span>
        </div>
      </div>`;
  }

  // ── Render match output ─────────────────────────────────────
  function render(container, output, query) {
    injectStyles();
    const result = output.result || output.result_type;
    const { signal, verification_level, identity_id, username, flags, matched_signals, mismatch_signals, reason } = output;

    if (result === 'NO_MATCH') {
      renderEmpty(container, query);
      return;
    }

    // result-based colors (overrides signal colors for card container)
    const RESULT_THEME = {
      MATCH_CONFIRMED: { color: '#34d399', bg: 'rgba(52,211,153,.08)', border: 'rgba(52,211,153,.18)', glow: 'rgba(52,211,153,.10)' },
      PARTIAL_MATCH:   { color: '#fbbf24', bg: 'rgba(251,191,36,.07)',  border: 'rgba(251,191,36,.2)',   glow: 'rgba(251,191,36,.08)' },
      UNDER_REVIEW:    { color: '#818cf8', bg: 'rgba(129,140,248,.07)', border: 'rgba(129,140,248,.2)',  glow: 'rgba(129,140,248,.08)' },
    };
    const theme = RESULT_THEME[result] || RESULT_THEME.UNDER_REVIEW;
    
    const ts = _sig(signal);
    const trust_label = output.trust_label || 'LOW';
    const TRUST_DESC = { HIGH: 'Strong evidence', MEDIUM: 'Moderate evidence', LOW: 'Limited evidence' };
    const trust_desc = TRUST_DESC[trust_label] || 'Limited evidence';

    // Disputed warning (Task 2)
    const disputedWarning = output.signals_used?.asset_status === 'CHALLENGED'
      ? `<div style="padding:0 24px 12px;font-size:12px;color:#fbbf24;font-weight:700">⚠️ Ownership under dispute</div>`
      : '';

    // Revocation badge (Task 3)
    const revocationBadge = output.revocation_signal === 'HIGH'
      ? `<div style="padding:0 24px 16px"><span style="font-size:10px;font-weight:800;padding:4px 12px;border-radius:99px;color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2)">🚨 HIGH OWNERSHIP RISK</span></div>`
      : '';

    // Trust Score Visualization (Task 2)
    const scorePct = Math.round((output.trust_score || 0) * 100);
    const meterHtml = `
      <div class="mo-trust-meter">
        <div class="mo-meter-header">
          <span class="mo-meter-label">Confidence</span>
          <span class="mo-meter-tooltip" title="Based on verified ownership signals">ⓘ</span>
        </div>
        <div class="mo-meter-track">
          <div class="mo-meter-fill" style="width: ${scorePct}%; background: ${theme.color}"></div>
        </div>
        <div style="font-size:11px;color:var(--color-text-secondary);margin-top:6px;font-weight:500">${trust_desc}</div>
      </div>
    `;

    // Risk Flags (Task 4) - Limit to 3, with severity colors
    const riskFlags = (output.risk_flags || []).slice(0, 3);
    const flagsHtml = riskFlags.length
      ? `<div style="padding:16px 24px 8px;font-size:10px;font-weight:800;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.1em">Risk signals</div>
         <div class="mo-flags" style="padding-top:0">${riskFlags.map(f => {
          const sev = f.severity || 1;
          const color = sev === 3 ? '#b44038' : (sev === 2 ? '#91601b' : 'var(--color-text-secondary)');
          const label = FLAG_LABELS[f.type] || f.type.replace(/_/g, ' ');
          return `<span class="mo-flag" style="color:${color};border-color:${color}33">● ${label} (S${sev})</span>`;
        }).join('')}</div>`
      : '';

    // Explanation Section (Task 3)
    const explanationHtml = `
      <div class="mo-explanation">
        <div class="mo-explanation-title">Why this result?</div>
        <div class="mo-explanation-reason">${escHtml(reason || 'Analysis of verified signals and identity history.')}</div>
        <div class="mo-signal-list">
          ${(matched_signals || []).map(s => `
            <div class="mo-signal-item">
              <span class="mo-signal-icon match">✓</span>
              <span style="color:var(--color-text-secondary)">${escHtml(s)}</span>
            </div>
          `).join('')}
          ${(mismatch_signals || []).map(s => `
            <div class="mo-signal-item">
              <span class="mo-signal-icon mismatch">!</span>
              <span style="color:#8a3b35">${escHtml(s)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;

    // Trust card
    const trustCardHtml = window.TrustSignalUI
      ? window.TrustSignalUI.buildTrustCard(ts, null, false)
      : `<div style="padding:24px 24px 18px;display:flex;align-items:flex-start;gap:16px">
           <div style="width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid ${ts.border};background:${ts.bg};flex-shrink:0">${ts.icon}</div>
           <div>
             <div style="font-size:16px;font-weight:800;color:${ts.color};margin-bottom:5px">${ts.title}</div>
             <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.55">${ts.desc}</div>
           </div>
         </div>`;

    // Profile link — only shown when identity_id is a real UUID
    const hasProfile = typeof identity_id === 'string' && identity_id.length > 8;
    const profileLinkHtml = hasProfile
      ? `<a href="p.html?id=${encodeURIComponent(identity_id)}"
           class="mo-btn mo-btn-primary"
           id="mo-profile-link"
           title="View this identity's public trust profile">
           🔐 View Identity Profile
         </a>`
      : '';

    // Partial match guidance
    const partialNotice = result === 'PARTIAL_MATCH'
      ? `<div style="padding:0 24px 12px;font-size:12px;color:#fbbf24;font-weight:600">⚠ Some signals match — verify carefully</div>`
      : '';

    container.innerHTML = `
      <div class="mo-card" style="background:${theme.bg};border-color:${theme.border};box-shadow:0 0 32px ${theme.glow}">
        <!-- S1: Status header -->
        <div class="mo-status-bar">
          <div class="mo-status-dot" style="background:${theme.color}"></div>
          <span style="color:${theme.color}">${STATUS_LABELS[result] || result}</span>
          ${username ? `<span style="margin-left:8px;color:var(--color-text-primary);font-weight:600">@${escHtml(username)}</span>` : ''}
          <span class="mo-confidence">${trust_label} TRUST</span>
        </div>

        ${partialNotice}
        ${disputedWarning}
        ${revocationBadge}

        <!-- S2+S3: Trust card (title + description) -->
        ${trustCardHtml}

        <!-- Trust Meter: Task 2 -->
        ${meterHtml}

        <!-- Explanation: Task 3 -->
        ${explanationHtml}

        <!-- S4: Verified assets slot (populated asynchronously if identity_id exists) -->
        <div id="mo-assets-slot"></div>

        <!-- S5: Flags -->
        ${flagsHtml}

        <!-- S6: Actions -->
        <div class="mo-actions">
          ${profileLinkHtml}
          <a href="reports.html?target_identity_id=${hasProfile ? encodeURIComponent(identity_id) : ''}" class="mo-btn mo-btn-ghost">
            ⚑ Report this identity
          </a>
          ${_isOwnIdentity(identity_id) ? '<a href="#" id="mo-challenge-link" class="mo-btn mo-btn-ghost">⚖ Challenge Decision</a>' : ''}
          <a href="/auth/signup" class="mo-btn mo-btn-ghost">
            ✓ Verify your own identity
          </a>
        </div>
      </div>`;

    // Async: wire challenge link to fetch reportId before navigating
    const challengeLink = document.getElementById('mo-challenge-link');
    if (challengeLink && identity_id) {
      challengeLink.onclick = async function (e) {
        e.preventDefault();
        challengeLink.textContent = '⚖ Loading…';
        try {
          const token = localStorage.getItem('hvid_token') || '';
          const res = await fetch(`/api/report/target/${encodeURIComponent(identity_id)}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
          });
          if (res.ok) {
            const reports = await res.json();
            const rId = reports?.[0]?.id || null;
            if (rId) {
              window.location.href = 'challenge.html?reportId=' + encodeURIComponent(rId);
              return;
            }
          }
        } catch (_) {}
        challengeLink.textContent = '⚖ Challenge Decision';
        alert('No report available to challenge.');
      };
    }

    // Async: fetch profile to get verified_assets (OPTIONAL, silent fail)
    // Only runs when we have a real identity_id.
    if (hasProfile) {
      fetchVerifiedAssets(identity_id);
    }
  }

  // ── S7 Empty / NO_MATCH state ───────────────────────────────
  function renderEmpty(container, query) {
    injectStyles();
    const isPhone = /^[+\d\s().*-]+$/.test(query || '');
    const title = isPhone ? 'No account found for this number' : 'No identity found';
    const description = isPhone
      ? 'There is no Individual or Business HVID account for this phone number.'
      : `No verified identity was found for <em>${escHtml(query || 'this input')}</em>.`;
    container.innerHTML = `
      <div class="mo-card" style="background:rgba(248,113,113,.07);border-color:rgba(248,113,113,.2);box-shadow:0 0 32px rgba(248,113,113,.08)">
        <div class="mo-empty">
          <div class="mo-empty-icon" style="color:#f87171">—</div>
          <div class="mo-empty-title" style="color:#f87171">${title}</div>
          <div class="mo-empty-desc">
            ${description}
          </div>
          <a href="/auth/signup" class="mo-btn mo-btn-primary" style="display:inline-flex">
            Create an identity
          </a>
        </div>
      </div>`;
  }

  // ── Async: fetch profile and render verified assets ───────────
  // Called after the main card renders — never delays trust card display.
  // Fetches GET /api/profile/:id which returns verified_assets[].
  // Silent fail: any error leaves #mo-assets-slot empty.
  async function fetchVerifiedAssets(identityId) {
    const slot = document.getElementById('mo-assets-slot');
    if (!slot) return;

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(identityId)}`);
      if (!res.ok) return;
      const profile = await res.json();
      const assets  = Array.isArray(profile.verified_assets) ? profile.verified_assets : [];
      if (assets.length === 0) return;

      const TYPE_META = {
        instagram: { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>', prefix: '@' },
        website:   { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', prefix: '' },
        phone:     { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>', prefix: '' },
        email:     { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',  prefix: '' },
      };

      const rows = assets.map(a => {
        const m   = TYPE_META[a.type] || { icon: '🔗', prefix: '' };
        const val = escHtml(`${m.prefix}${a.value}`);
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;
                            border-bottom:1px solid var(--color-border, #e2e8f0)">
                  <span style="font-size:16px;flex-shrink:0">${m.icon}</span>
                  <span style="font-size:13px;font-weight:600;color:var(--color-text-primary, #0b192c)">${val}</span>
                  <span style="margin-left:auto;font-size:10px;font-weight:700;
                                color:#34d399;background:rgba(52,211,153,.08);
                                border:1px solid rgba(52,211,153,.18);
                                border-radius:99px;padding:2px 8px">Verified</span>
                </div>`;
      }).join('');

      slot.innerHTML = `
        <div style="padding:4px 24px 12px;border-top:1px solid var(--color-border, #e2e8f0)">
          <div style="font-size:10px;font-weight:700;color:var(--color-text-muted, #64748b);
                      text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
            Verified Accounts
          </div>
          <div style="border-top:1px solid var(--color-border, #e2e8f0)">${rows}</div>
        </div>`;
    } catch (_) {
      // Silent fail — never block the result page on a profile fetch error
    }
  }
  
  // ── V6.3: UX Polish (Humanized, Trust-Driven, Viral) ───────────

  function getHumanAction(action) {
    if (action === 'PROCEED') return 'Safe to trust this person';
    if (action === 'VERIFY') return 'Verify before you proceed';
    if (action === 'DO_NOT_PROCEED') return 'Do NOT trust this person';
    return 'Verify before proceeding';
  }

  async function runMultiCheck() {
    const list = document.getElementById('multiClaimInputList');
    const resultSlot = document.getElementById('multiCheckResultSlot');
    const submitBtn = document.getElementById('submitMultiClaims');
    if (!list || !resultSlot || !submitBtn) return;

    const rows = list.querySelectorAll('.claim-row');
    const claims = [];
    rows.forEach(row => {
      const type = row.querySelector('.claim-type-select').value;
      const val  = row.querySelector('.claim-value-input').value.trim();
      if (val) claims.push(`${type}:${val}`);
    });

    if (claims.length < 2) {
      resultSlot.style.display = 'block';
      resultSlot.innerHTML = `<div style="text-align:center; padding:20px; font-size:13px; color:var(--color-text-muted, #64748b); border:1px dashed var(--color-border, #cbd5e1); border-radius:10px">
                                Add at least 2 details to verify identity
                              </div>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Analyzing…';
    resultSlot.style.display = 'block';
    resultSlot.innerHTML = `
      <div style="text-align:center; padding:30px">
        <div class="spinner" style="margin:0 auto 16px"></div>
        <div style="font-size:13px; color:var(--color-text-muted); font-weight:500">Analyzing identity signals…</div>
      </div>`;

    try {
      const resp = await fetch('/api/match/multi-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ claims }),
      });

      if (!resp.ok) throw new Error('API Error');
      const data = await resp.json();
      
      renderV6(resultSlot, data);
    } catch (err) {
      resultSlot.innerHTML = `<div style="color:#f87171;font-size:13px;text-align:center;padding:20px">Unable to complete verification. Please try again.</div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Verify Identity';
    }
  }

  function renderV6(container, data) {
    const riskMap = {
      LOW:     { color: '#34d399', bg: 'rgba(52,211,153,.08)',  border: 'rgba(52,211,153,.2)',   icon: '🛡️', label: 'Low Risk' },
      MEDIUM:  { color: '#fbbf24', bg: 'rgba(251,191,36,.08)',  border: 'rgba(251,191,36,.2)',   icon: '⚠️', label: 'Medium Risk' },
      HIGH:    { color: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.2)',  icon: '🚨', label: 'High Risk' },
      UNKNOWN: { color: 'var(--color-text-muted, #64748b)', bg: 'var(--color-surface-2, #f1f5f9)', border: 'var(--color-border, #e2e8f0)', icon: '❓', label: 'Unknown' },
    };

    const risk = riskMap[data.risk_level] || riskMap.UNKNOWN;
    const actionText = getHumanAction(data.recommended_action);
    const cert = data.certainty || 'UNCERTAIN';

    const explanationHtml = (data.explanation || [])
      .map(e => `<div style="display:flex;gap:8px;font-size:12px;color:var(--color-text-secondary, #475569);margin-bottom:6px">
                   <span style="color:${risk.color}">•</span> ${escHtml(e)}
                 </div>`)
      .join('');

    container.innerHTML = `
      <div style="background:${risk.bg}; border:1px solid ${risk.border}; border-radius:14px; padding:24px; animation:moFadeUp .4s ease-out; position:relative">
        
        <!-- Color Indicator (Top Line) -->
        <div style="height:4px; width:40px; border-radius:99px; background:${risk.color}; margin-bottom:20px"></div>

        <!-- Certainty Badge (Floating Right) -->
        <div style="position:absolute; top:24px; right:24px">
          <span style="font-size:10px; font-weight:800; padding:2px 10px; border-radius:99px; background:${risk.color}; color:#000; letter-spacing:.05em">
            ${cert}
          </span>
        </div>

        <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:24px">
          <div style="width:52px; height:52px; border-radius:14px; background:rgba(0,0,0,.06); border:1px solid ${risk.border}; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0">
            ${risk.icon}
          </div>
          <div style="flex:1">
            <h2 style="font-size:22px; font-weight:800; color:var(--color-text-primary); letter-spacing:-.02em; line-height:1.2; margin-bottom:4px">
              ${escHtml(data.summary)}
            </h2>
            <div style="font-size:15px; font-weight:700; color:${data.recommended_action === 'DO_NOT_PROCEED' ? '#f87171' : (data.recommended_action === 'PROCEED' ? '#34d399' : '#fbbf24')}">
              ${actionText}
            </div>
          </div>
        </div>

        <!-- Trust Note -->
        <p style="font-size:11px; color:var(--color-text-muted, #64748b); margin-bottom:24px; font-weight:500; padding-left:2px">
          🛡️ This check helps prevent scams and impersonation. Signals are advisory.
        </p>

        <!-- Explanations -->
        <div style="border-top:1px solid var(--color-border, #e2e8f0); padding-top:16px; margin-bottom:24px">
          <div style="font-size:10px; font-weight:700; color:var(--color-text-muted, #64748b); text-transform:uppercase; letter-spacing:.08em; margin-bottom:12px">
            Trust Justification
          </div>
          ${explanationHtml}
        </div>

        <!-- Viral Hook (Copy Result) -->
        <button id="copyResultBtn" class="btn btn-ghost btn-sm" style="width:100%; border-color:var(--color-border, #e2e8f0); color:var(--color-text-secondary, #475569)" onclick="copyResult('${escHtml(data.summary)}', '${escHtml(actionText)}')">
          📋 Copy result to clipboard
        </button>

      </div>
    `;
  }

  window.copyResult = (summary, actionText) => {
    const text = `HVID Identity Verification Result:\n\n[Summary] ${summary}\n[Action] ${actionText}\n\nCheck ID at: ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyResultBtn');
      if (btn) {
        const oldText = btn.innerHTML;
        btn.innerHTML = '✓ Copied to clipboard';
        btn.style.color = '#34d399';
        setTimeout(() => { btn.innerHTML = oldText; btn.style.color = ''; }, 2000);
      }
    });
  };

  // Exposed for p.html
  window.toggleMultiClaimForm = () => {
    const el = document.getElementById('multiClaimVerification');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const list = document.getElementById('multiClaimInputList');
      const resultSlot = document.getElementById('multiCheckResultSlot');
      if (list && list.querySelectorAll('.claim-row').length < 2) {
         resultSlot.style.display = 'block';
         resultSlot.innerHTML = `<div style="text-align:center; padding:20px; font-size:13px; color:var(--color-text-muted, #64748b); border:1px dashed var(--color-border, #cbd5e1); border-radius:10px">
                                  Add at least 2 details to verify identity
                                </div>`;
      }
    }
  };

  window.addClaimRow = () => {
    const list = document.getElementById('multiClaimInputList');
    const resultSlot = document.getElementById('multiCheckResultSlot');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'claim-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.innerHTML = `
      <select class="claim-type-select" style="background:var(--color-surface, #ffffff); border:1px solid var(--color-border, #cbd5e1); border-radius:8px; color:var(--color-text-primary); padding:8px 12px; font-size:13px; font-family:inherit; cursor:pointer; outline:none">
        <option value="instagram">Instagram</option>
        <option value="phone">Phone</option>
        <option value="email">Email</option>
        <option value="website">Website</option>
      </select>
      <input type="text" class="claim-value-input" placeholder="Enter value" style="flex:1; background:var(--color-surface, #ffffff); border:1px solid var(--color-border, #cbd5e1); border-radius:8px; color:var(--color-text-primary); padding:8px 14px; font-size:13px; outline:none" />
      <button class="remove-claim-btn" style="background:none; border:none; color:var(--color-text-muted, #94a3b8); cursor:pointer; font-size:18px; padding:0 8px" onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(row);
    
    if (list.querySelectorAll('.claim-row').length >= 2 && resultSlot) {
      if (resultSlot.innerHTML.includes('Add at least 2')) resultSlot.style.display = 'none';
    }
  };

  window.runMultiCheck = runMultiCheck;

  async function init() {
    if (!document.getElementById('result-container')) return;
    injectStyles();

    const resultContainer = document.getElementById('result-container');
    let outputContainer = document.getElementById('match-output-container');
    if (!outputContainer) {
      outputContainer = document.createElement('div');
      outputContainer.id = 'match-output-container';
      resultContainer.parentNode.insertBefore(outputContainer, resultContainer);
    }

    const params = new URLSearchParams(window.location.search);
    const query  = (params.get('q') || '').trim();
    const requestedAccountType = params.get('account_type');
    const accountType = requestedAccountType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL';
    if (!query) return;

    showLoading(outputContainer);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const requestBody = { query };
      if (requestedAccountType) requestBody.account_type = accountType;
      const resp = await fetch('/api/match/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(requestBody),
        signal:  controller.signal,
      });

      if (!resp.ok) {
        let errorMessage = `Unable to process request. (${resp.status})`;
        try {
          const data = await resp.json();
          if (data && data.error) errorMessage = data.error;
        } catch (_) {
          try {
            const text = await resp.text();
            if (text) errorMessage = text;
          } catch (_) {}
        }
        renderError(outputContainer, errorMessage);
        return;
      }

      const output = await resp.json();
      updateAccountTypeSwitcher(output.account_types || []);
      render(outputContainer, output, query);

    } catch (err) {
      console.error('Match check error:', err);
      renderError(outputContainer, err.name === 'AbortError'
        ? 'The search timed out. Please try again.'
        : (err.message || 'Unable to process request. Try again.'));
    } finally {
      clearTimeout(timeout);
    }
  }

  function updateAccountTypeSwitcher(accountTypes) {
    const available = new Set(accountTypes);
    const buttons = document.querySelectorAll('[data-account-type]');
    let activeAvailable = false;
    buttons.forEach(button => {
      const isAvailable = available.has(button.dataset.accountType);
      button.hidden = !isAvailable;
      button.disabled = !isAvailable;
      button.setAttribute('aria-hidden', String(!isAvailable));
      if (isAvailable && button.classList.contains('active')) activeAvailable = true;
    });
    if (!activeAvailable) {
      const fallback = Array.from(buttons).find(button => available.has(button.dataset.accountType));
      if (fallback) {
        buttons.forEach(button => {
          const selected = button === fallback;
          button.classList.toggle('active', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
        window.HVID_SEARCH_ACCOUNT_TYPE = fallback.dataset.accountType;
      }
    }
  }

  function renderError(container, msg) {
    injectStyles();
    container.innerHTML = `
      <div class="mo-card" style="background:var(--color-surface, #ffffff);border-color:var(--color-border, #e2e8f0)">
        <div class="mo-empty">
          <div class="mo-empty-icon" style="font-size:24px;opacity:.3">⚠</div>
          <div class="mo-empty-title" style="font-size:14px">${escHtml(msg)}</div>
          <button onclick="window.location.reload()" class="mo-btn mo-btn-ghost" style="margin-top:12px;border:1px solid var(--color-border, #e2e8f0);background:transparent;cursor:pointer">
            Try again
          </button>
        </div>
      </div>`;
  }

  return {
    init,
    runMultiCheck
  };

})();

document.addEventListener('DOMContentLoaded', MatchUI.init);
window.MatchUI = MatchUI;
