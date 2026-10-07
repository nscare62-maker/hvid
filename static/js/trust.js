/* ============================================================
   HVID — Trust Signal & Enforcement Engine
   Defines signals, enforcement levels, and priority resolution.
   No accusations. No scores. System state only.
   ============================================================ */

'use strict';

// ── 5 Trust Signal States (exact labels from spec) ───────────
const TRUST_SIGNALS = {
  STABLE: {
    key:      'STABLE',
    label:    'Verified & consistent',
    icon:     '🟢',
    dot:      '#34D399',
    priority: 1,
    cssClass: 'ts-stable',
  },
  REVIEW: {
    key:      'REVIEW',
    label:    'Recent activity under review',
    icon:     '🟡',
    dot:      '#FBBF24',
    priority: 2,
    cssClass: 'ts-review',
  },
  REVALIDATION: {
    key:      'REVALIDATION',
    label:    'Some claims are being revalidated',
    icon:     '🟠',
    dot:      '#F97316',
    priority: 3,
    cssClass: 'ts-revalidation',
  },
  LIMITED: {
    key:      'LIMITED',
    label:    'Verification temporarily limited',
    icon:     '🔴',
    dot:      '#EF4444',
    priority: 4,
    cssClass: 'ts-limited',
  },
  SUSPENDED: {
    key:      'SUSPENDED',
    label:    'Verification unavailable',
    icon:     '⚫',
    dot:      '#6B7280',
    priority: 5,
    cssClass: 'ts-suspended',
  },
};

// ── Enforcement level → trust signal mapping ─────────────────
// Triggers are NOT shown publicly — only the resulting signal.
const ENFORCEMENT_LEVEL_MAP = {
  0: 'STABLE',
  1: 'REVIEW',
  2: 'REVALIDATION',
  3: 'LIMITED',
  4: 'SUSPENDED',
};

// ── Resolve the highest-priority signal from an array ────────
// (Only one primary signal shown at a time — highest wins)
function resolveTrustSignal(enforcementLevel) {
  const key = ENFORCEMENT_LEVEL_MAP[enforcementLevel] || 'STABLE';
  return TRUST_SIGNALS[key] || TRUST_SIGNALS.STABLE;
}

// ── Render a trust signal badge into a DOM element ───────────
// el: HTMLElement to inject into
// signal: one of TRUST_SIGNALS values
function renderTrustBadge(el, signal) {
  if (!el || !signal) return;
  el.innerHTML = `
    <span class="trust-signal-badge ${signal.cssClass}">
      <span class="ts-dot"></span>
      ${signal.label}
    </span>
  `;
}

// ── Result page override logic ───────────────────────────────
// If enforcementLevel >= 1 on a confirmed record,
// the result state display is overridden per spec.
function applyTrustOverride(rec) {
  // enforcementLevel defaults to 0 if not set
  const level = rec.enforcementLevel || 0;
  if (level === 0) return null; // no override

  const signal = resolveTrustSignal(level);

  // Map enforcement level to result override state
  // Levels 1-2: show "under-review", Levels 3-4: show "limited/suspended"
  if (level >= 3) {
    return {
      overrideState: 'enforcement-limited',
      signal,
    };
  }
  return {
    overrideState: 'under-review',
    signal,
  };
}

// CLEANUP M2: SYSTEM_ALERTS REMOVED.
// Previously contained 3 hardcoded fake alert objects with fabricated timestamps
// ("2 days ago", "5 days ago", "1 week ago") and hardcoded states (REVERIFY_REQUIRED,
// REVIEW, STABLE). These had no connection to real backend data and would mislead
// any UI consuming them as if they were live system events.
//
// const SYSTEM_ALERTS = [ ... ];  // removed

window.TrustEngine = {
  TRUST_SIGNALS,
  ENFORCEMENT_LEVEL_MAP,
  // CLEANUP M2: SYSTEM_ALERTS removed — was hardcoded fake data
  resolveTrustSignal,
  renderTrustBadge,
  applyTrustOverride,
};
