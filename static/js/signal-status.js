/**
 * signal-status.js
 *
 * Signal transition UX layer.
 *
 * Responsibilities:
 *   - Poll own trust signal from API
 *   - Detect transitions (prev → new) from sessionStorage cache
 *   - Show "Trust status updated" / "improved" toast + banner
 *   - Render friendly state messages in #db-trust-insight
 *   - Push a friendly timeline entry when signal changes
 *
 * SAFETY RULES (enforced):
 *   - Never display report counts
 *   - Never display internal reasons or rule names
 *   - Never display enforcement levels
 *   - Always neutral, non-accusatory copy
 *
 * Depends on: trust-signal.js (must load first)
 */
'use strict';

(function SignalStatus() {

  const API       = '/api';
  const CACHE_KEY = 'hvid_last_signal';  // sessionStorage — not persisted across tabs

  // ── Signal ordering (for direction detection) ─────────────
  const SIGNAL_LEVEL = {
    STABLE:                0,
    UNDER_REVIEW:          1,
    REQUIRES_REVALIDATION: 2,
    LIMITED:               3,
    SUSPENDED:             4,
  };

  // ── User-facing messages — NO internal logic exposed ────────
  const SIGNAL_MESSAGES = {
    STABLE: {
      summary:     'Your trust status is stable.',
      guidance:    'No action needed. Keep your identity information up to date.',
      icon:        '✅',
      improved:    true,
    },
    UNDER_REVIEW: {
      summary:     'Some activity requires attention.',
      guidance:    'Strengthen your profile by completing or updating your verification.',
      icon:        '⚠️',
      improved:    false,
      action:      { label: 'Go to Verification →', href: '/dashboard/verification' },
    },
    REQUIRES_REVALIDATION: {
      summary:     'Please verify your identity again.',
      guidance:    'Your verification may need to be refreshed. Complete the steps below to restore full access.',
      icon:        '🔁',
      improved:    false,
      action:      { label: 'Start re-verification →', href: '/dashboard/verification' },
    },
    LIMITED: {
      summary:     'Access restricted due to risk signals.',
      guidance:    'Some features are temporarily limited. Verify your identity to begin the review process.',
      icon:        '⛔',
      improved:    false,
      action:      { label: 'Review settings →', href: '/' },
    },
    SUSPENDED: {
      summary:     'Your identity is currently suspended.',
      guidance:    'Please contact support for assistance.',
      icon:        '🚫',
      improved:    false,
      action:      { label: 'Contact support →', href: 'mailto:support@hvid.io' },
    },
  };

  // Transition-specific copy (direction-aware)
  const TRANSITION_COPY = {
    improving: 'Your trust status has improved.',
    worsening: 'Trust status updated.',
    neutral:   'Trust status updated.',
  };

  // ── Auth helpers ──────────────────────────────────────────
  const token = () => localStorage.getItem('hvid_token') || '';
  const session = () => {
    try { return JSON.parse(localStorage.getItem('hvid_session') || '{}'); } catch { return {}; }
  };
  const identityId = () => {
    const s = session();
    return s.identity_id || s.identityId || null;
  };

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, improving) {
    let el = document.getElementById('ss-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ss-toast';
      el.style.cssText = [
        'position:fixed','bottom:28px','left:50%','transform:translateX(-50%) translateY(10px)',
        'padding:11px 20px','border-radius:12px','font-size:13px','font-weight:600',
        'z-index:9000','opacity:0','pointer-events:none',
        'transition:opacity .25s,transform .25s','white-space:nowrap',
        'font-family:Inter,sans-serif','max-width:90vw','text-align:center',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent   = msg;
    el.style.background   = improving ? 'rgba(52,211,153,.18)' : 'rgba(251,191,36,.15)';
    el.style.border       = `1px solid ${improving ? 'rgba(52,211,153,.3)' : 'rgba(251,191,36,.25)'}`;
    el.style.color        = improving ? '#34d399' : '#fbbf24';
    el.style.opacity      = '1';
    el.style.transform    = 'translateX(-50%) translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(-50%) translateY(10px)';
    }, 3800);
  }

  // ── Insight banner ────────────────────────────────────────
  function renderInsight(signal) {
    const el = document.getElementById('db-trust-insight');
    if (!el) return;

    const m     = SIGNAL_MESSAGES[signal] || SIGNAL_MESSAGES.UNDER_REVIEW;
    const color = signal === 'STABLE'     ? '#34d399'
                : signal === 'SUSPENDED'  ? '#f87171'
                : signal === 'LIMITED'    ? '#f87171'
                : signal === 'REQUIRES_REVALIDATION' ? '#fb923c'
                : '#fbbf24';

    const actionHtml = m.action
      ? `<a href="${m.action.href}" style="
          display:inline-block;margin-top:12px;font-size:12px;font-weight:600;
          color:${color};text-decoration:none;padding:6px 14px;
          border:1px solid ${color}33;border-radius:8px;background:${color}11;
          transition:opacity .15s
         " onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
          ${m.action.label}
        </a>` : '';

    el.innerHTML = `
      <div style="
        background:${color}0a;border:1px solid ${color}22;
        border-radius:14px;padding:18px 20px;
      ">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <span style="font-size:22px;flex-shrink:0">${m.icon}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:5px">
              ${m.summary}
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.6">
              ${m.guidance}
            </div>
            ${actionHtml}
          </div>
        </div>
        <div style="
          margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05);
          font-size:11px;color:rgba(255,255,255,.2)
        ">
          Advisory only — not a verdict on your identity.
        </div>
      </div>`;
  }

  // ── Inline dashboard signal label (line next to "db-trust-signal") ──
  function renderSignalLabel(signal) {
    const el = document.getElementById('db-trust-signal');
    if (!el) return;
    const m     = SIGNAL_MESSAGES[signal] || SIGNAL_MESSAGES.UNDER_REVIEW;
    const color = signal === 'STABLE' ? '#34d399'
                : signal === 'SUSPENDED' || signal === 'LIMITED' ? '#f87171'
                : signal === 'REQUIRES_REVALIDATION' ? '#fb923c' : '#fbbf24';
    const label = {
      STABLE:'Stable', UNDER_REVIEW:'Under Review',
      REQUIRES_REVALIDATION:'Revalidation Needed',
      LIMITED:'Limited', SUSPENDED:'Suspended',
    }[signal] || signal;
    el.innerHTML = `<span style="color:${color};font-weight:700;font-size:13px">${m.icon} ${label}</span>`;
  }

  // ── Timeline entry injection ──────────────────────────────
  function pushTimelineEntry(signal, direction) {
    const container = document.getElementById('db-activity-list');
    if (!container) return;
    const copy  = direction === 'improving' ? TRANSITION_COPY.improving : TRANSITION_COPY.worsening;
    const color = direction === 'improving' ? '#34d399' : '#fbbf24';
    const entry = document.createElement('div');
    entry.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)';
    entry.innerHTML = `
      <div style="width:7px;height:7px;border-radius:50%;background:${color};margin-top:5px;flex-shrink:0"></div>
      <div>
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.75)">${copy}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:2px">Just now</div>
      </div>`;
    container.prepend(entry);
  }

  // ── Main: load signal + detect transition ─────────────────
  async function loadAndRender() {
    const iid = identityId();
    if (!iid) return;

    let signal = 'STABLE';
    try {
      const r = await fetch(`${API}/identity/${iid}/signal`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        signal = d.trust_signal || d.signal || signal;
      }
    } catch {
      // Fallback: try enforcement state
      try {
        const r2 = await fetch(`${API}/enforcement/state/${iid}`, {
          headers: token() ? { Authorization: `Bearer ${token()}` } : {},
        });
        if (r2.ok) {
          const d2 = await r2.json().catch(() => ({}));
          signal = d2.signal || signal;
        }
      } catch { /* stay with default */ }
    }

    // Detect transition
    const prev  = sessionStorage.getItem(CACHE_KEY);
    const prevLevel = SIGNAL_LEVEL[prev] ?? -1;
    const newLevel  = SIGNAL_LEVEL[signal] ?? 0;

    let direction = 'neutral';
    if (prev && prev !== signal) {
      direction = newLevel < prevLevel ? 'improving' : 'worsening';
      const msg = TRANSITION_COPY[direction];
      toast(msg, direction === 'improving');
      pushTimelineEntry(signal, direction);
    }

    // Cache new signal
    sessionStorage.setItem(CACHE_KEY, signal);

    // Update UI
    renderSignalLabel(signal);
    renderInsight(signal);

    // Also update full trust card if trust-signal.js is loaded
    if (window.TrustSignalUI) {
      const ts  = window.TrustSignalUI.resolveTrustState(signal);
      const el  = document.getElementById('db-trust-card');
      if (el) el.innerHTML = window.TrustSignalUI.buildTrustCard(ts, new Date().toISOString(), true);
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    loadAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SignalStatus = { reload: loadAndRender };
})();
