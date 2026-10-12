/* ============================================================
   HVID — Trust Signal UI System
   Single source of truth for trust state display across:
     - Match result page (match-ui.js)
     - Owner dashboard  (owner-dashboard.js)
     - Public profile   (profile.js)

   Backend values:
     STABLE · UNDER_REVIEW · REQUIRES_REVALIDATION · LIMITED · SUSPENDED

   SAFETY: Never expose score, reports, or internal reasoning.
   ============================================================ */
'use strict';

const TRUST_STATES = {
  STABLE: {
    signal:      'STABLE',
    title:       'Stable Identity',
    desc:        'Identity status available when needed.',
    action:      null,
    actionLabel: null,
    color:       '#10b981',
    bg:          'rgba(16,185,129,.08)',
    border:      'rgba(16,185,129,.18)',
    glow:        'rgba(16,185,129,.10)',
    icon:        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline-block;vertical-align:-1px"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    pulse:       false,
  },
  UNDER_REVIEW: {
    signal:      'UNDER_REVIEW',
    title:       'Under Review',
    desc:        'Some signals require attention. Verification recommended.',
    action:      '/dashboard/verification',
    actionLabel: 'Complete verification →',
    color:       '#f59e0b',
    bg:          'rgba(245,158,11,.07)',
    border:      'rgba(245,158,11,.20)',
    glow:        'rgba(245,158,11,.08)',
    icon:        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block;vertical-align:-1px"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    pulse:       true,
  },
  REQUIRES_REVALIDATION: {
    signal:      'REQUIRES_REVALIDATION',
    title:       'Revalidation Required',
    desc:        'Recent context detected. Verification recommended.',
    action:      '/dashboard/verification',
    actionLabel: 'Re-verify identity →',
    color:       '#fb923c',
    bg:          'rgba(251,146,60,.07)',
    border:      'rgba(251,146,60,.20)',
    glow:        'rgba(251,146,60,.08)',
    icon:        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block;vertical-align:-1px"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
    pulse:       true,
  },
  LIMITED: {
    signal:      'LIMITED',
    title:       'Limited Trust',
    desc:        'Limited trust signal active. Verification step required.',
    action:      '/dashboard',
    actionLabel: 'Check security settings →',
    color:       '#ef4444',
    bg:          'rgba(239,68,68,.07)',
    border:      'rgba(239,68,68,.20)',
    glow:        'rgba(239,68,68,.08)',
    icon:        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block;vertical-align:-1px"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    pulse:       true,
  },
  SUSPENDED: {
    signal:      'SUSPENDED',
    title:       'Suspended Identity',
    desc:        'Trust signal access is currently limited. Contact support.',
    action:      null,
    actionLabel: 'Contact support',
    color:       '#991b1b',
    bg:          'rgba(153,27,27,.10)',
    border:      'rgba(153,27,27,.25)',
    glow:        'rgba(153,27,27,.08)',
    icon:        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block;vertical-align:-1px"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>',
    pulse:       false,
  },
};

// Fallback for any unrecognised value
const TRUST_STATE_FALLBACK = TRUST_STATES.UNDER_REVIEW;

/**
 * Resolve a TrustState config from a backend trust_signal string.
 * Handles both new unified names and legacy STRONG/MODERATE/CAUTION/HIGH_RISK.
 */
function resolveTrustState(signal) {
  if (!signal) return TRUST_STATE_FALLBACK;

  // Direct match (new unified values)
  if (TRUST_STATES[signal]) return TRUST_STATES[signal];

  // Legacy migration map
  const LEGACY = {
    STRONG:       TRUST_STATES.STABLE,
    MODERATE:     TRUST_STATES.UNDER_REVIEW,
    CAUTION:      TRUST_STATES.REQUIRES_REVALIDATION,
    HIGH_RISK:    TRUST_STATES.LIMITED,
    // Old enforcement string names
    STABLE:       TRUST_STATES.STABLE,
    REVIEW:       TRUST_STATES.UNDER_REVIEW,
    REVALIDATION: TRUST_STATES.REQUIRES_REVALIDATION,
  };
  return LEGACY[signal] || TRUST_STATE_FALLBACK;
}

/**
 * Build a trust signal card HTML string.
 *
 * @param {object}  ts        - TrustState from resolveTrustState()
 * @param {string}  [lastAt]  - ISO timestamp of last change (optional)
 * @param {boolean} [showAction] - Show action hint link (false for public profile)
 */
function buildTrustCard(ts, lastAt, showAction) {
  if (ts.signal === 'STABLE' && !showAction) {
    return '';
  }

  const pulseStyle = ts.pulse
    ? 'animation:hvTrustPulse 2.2s ease-in-out infinite'
    : '';

  const timeHtml = lastAt
    ? `<span style="font-size:11px;color:var(--color-text-muted);margin-left:auto">${_trustTimeAgo(lastAt)}</span>`
    : '';

  const actionHtml = showAction && ts.actionLabel
    ? (ts.action
        ? `<a href="${ts.action}" style="display:inline-block;margin-top:12px;font-size:12px;font-weight:600;color:${ts.color};text-decoration:none;padding:6px 14px;border:1px solid ${ts.border};border-radius:8px;background:${ts.bg}">${ts.actionLabel}</a>`
        : `<span style="display:inline-block;margin-top:12px;font-size:12px;color:${ts.color}">${ts.actionLabel}</span>`)
    : '';

  return `
    <div class="hv-trust-card" style="background:${ts.bg};border:1px solid ${ts.border};border-radius:16px;overflow:hidden;box-shadow:0 0 28px ${ts.glow};transition:box-shadow .3s">
      <div style="display:flex;align-items:flex-start;gap:16px;padding:22px 24px 18px">
        <div class="hv-trust-icon" style="width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid ${ts.border};background:${ts.bg};flex-shrink:0;${pulseStyle}">
          ${ts.icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:800;color:${ts.color};margin-bottom:5px;letter-spacing:-.01em">${ts.title}</div>
          <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.55">${ts.desc}</div>
          ${actionHtml}
        </div>
        ${timeHtml}
      </div>
      <div style="padding:10px 24px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px">
        <div style="width:7px;height:7px;border-radius:50%;background:${ts.color};flex-shrink:0"></div>
        <span style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--color-text-secondary)">Trust Signal</span>
        <span style="font-size:10px;color:var(--color-text-secondary);margin-left:auto">Advisory only — not a verdict</span>
      </div>
    </div>`;
}

/** Relative time helper */
function _trustTimeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Inject pulse keyframes once into the document */
(function injectTrustCSS() {
  if (document.getElementById('hv-trust-css')) return;
  const s = document.createElement('style');
  s.id = 'hv-trust-css';
  s.textContent = `
    @keyframes hvTrustPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: .6; }
    }
    .hv-trust-card { transition: box-shadow .3s, border-color .3s; }
    .hv-trust-card:hover { box-shadow: 0 0 0 1px rgba(255,255,255,.06) !important; }
  `;
  document.head.appendChild(s);
})();

window.TrustSignalUI = { TRUST_STATES, resolveTrustState, buildTrustCard };
