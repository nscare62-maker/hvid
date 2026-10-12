/**
 * HVID Tier UI System
 * ─────────────────────────────────────────────────────────────────
 * Components:
 *   TierUI.badge(tier)          — inline badge element
 *   TierUI.card(tier, target)   — full tier card with CTA
 *   TierUI.progress(tier)       — 3-step progress ladder
 *   TierUI.featureLocks(tier)   — locked feature list
 *   TierUI.compact(tier)        — compact badge for match results
 *
 * Rules:
 *   - Never expose confidence numbers
 *   - Never say "fully verified" — always "level" language
 *   - CTA visible only when upgrade path exists
 */
'use strict';

const TierUI = (() => {

  // ── Tier definitions ────────────────────────────────────────
  const TIERS = {
    BASIC: {
      key:      'BASIC',
      label:    'Basic',
      subtitle: 'Unverified Identity',
      desc:     'Your identity is active but not verified.',
      color:    '#6b7280',
      bg:       'rgba(107,114,128,0.10)',
      border:   'rgba(107,114,128,0.22)',
      dot:      '#6b7280',
      icon:     '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"></circle></svg>',
      order:    0,
    },
    PROFESSIONAL: {
      key:      'PROFESSIONAL',
      label:    'Verified',
      subtitle: 'KYC Verified',
      desc:     'Your identity is verified using official documents.',
      color:    '#60a5fa',
      bg:       'rgba(96,165,250,0.10)',
      border:   'rgba(96,165,250,0.22)',
      dot:      '#60a5fa',
      icon:     '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"></circle></svg>',
      order:    1,
    },
    PREMIUM: {
      key:      'PREMIUM',
      label:    'High Trust',
      subtitle: 'KYC + Face Verified',
      desc:     'Your identity is verified with highest level security.',
      color:    '#a78bfa',
      bg:       'rgba(167,139,250,0.12)',
      border:   'rgba(167,139,250,0.25)',
      dot:      '#a78bfa',
      icon:     '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
      order:    2,
    },
  };

  const FEATURES = [
    { label: 'High-trust interactions', minTier: 'PROFESSIONAL' },
    { label: 'Financial trust badge',   minTier: 'PROFESSIONAL' },
    { label: 'Face-verified credibility', minTier: 'PREMIUM'    },
    { label: 'Priority match results',  minTier: 'PREMIUM'      },
  ];

  const ORDER = { BASIC: 0, PROFESSIONAL: 1, PREMIUM: 2 };

  function tierOrder(t) { return ORDER[t] ?? 0; }

  // ── CSS (injected once) ─────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hvid-tier-styles')) return;
    const s = document.createElement('style');
    s.id = 'hvid-tier-styles';
    s.textContent = `
      /* ── Tier badge ─────────────────────────────────────────── */
      .tier-badge {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 700; letter-spacing: .04em;
        border-radius: 999px; padding: 4px 12px; border: 1px solid;
        white-space: nowrap;
      }
      .tier-badge-dot { width: 7px; height: 7px; border-radius: 50%; }
      .tier-badge-compact {
        font-size: 11px; padding: 2px 8px;
      }

      /* ── Tier card ──────────────────────────────────────────── */
      .tier-card { border-radius: 14px; padding: 24px; }
      .tier-card-header {
        display: flex; align-items: flex-start;
        justify-content: space-between; gap: 12px;
        margin-bottom: 16px;
      }
      .tier-card-title {
        font-size: 12px; font-weight: 700; letter-spacing: .06em;
        text-transform: uppercase; color: var(--color-text-muted, #9ca3af);
        margin-bottom: 6px;
      }
      .tier-card-desc { font-size: 13px; color: var(--color-text-secondary, #d1d5db); line-height: 1.6; }

      /* ── CTA panel ──────────────────────────────────────────── */
      .tier-cta {
        margin-top: 20px; padding: 16px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 10px;
      }
      .tier-cta-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
      .tier-cta-desc  { font-size: 12px; color: var(--color-text-muted,#9ca3af); margin-bottom: 14px; line-height: 1.5; }
      .tier-cta-point {
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; color: var(--color-text-secondary,#d1d5db);
        margin-bottom: 6px;
      }
      .tier-cta-point::before { content: '→'; opacity: .5; }
      .tier-cta-btn {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 14px; padding: 9px 20px; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        border: 1px solid; transition: opacity .15s, transform .1s;
        text-decoration: none;
      }
      .tier-cta-btn:hover { opacity: .85; transform: translateY(-1px); }

      /* ── Progress ladder ────────────────────────────────────── */
      .tier-progress { display: flex; align-items: center; gap: 0; margin-top: 20px; }
      .tier-step {
        display: flex; flex-direction: column; align-items: center;
        gap: 6px; flex: 1; min-width: 0;
      }
      .tier-step-node {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700; border: 2px solid;
        transition: all .2s;
      }
      .tier-step-label { font-size: 11px; font-weight: 600; text-align: center; }
      .tier-connector {
        height: 2px; flex: 1; margin: 0;
        margin-bottom: 24px;  /* align with node centres */
      }

      /* ── Feature locks ──────────────────────────────────────── */
      .tier-feature-list { display: grid; gap: 8px; margin-top: 16px; }
      .tier-feature {
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; padding: 10px 14px; border-radius: 9px;
        border: 1px solid rgba(255,255,255,.06);
      }
      .tier-feature-icon { font-size: 14px; flex-shrink: 0; }
      .tier-feature-label { flex: 1; }
      .tier-feature-tag {
        font-size: 10px; font-weight: 700; letter-spacing: .04em;
        padding: 2px 7px; border-radius: 99px; border: 1px solid;
      }
    `;
    document.head.appendChild(s);
  }

  // ── badge() — inline tier badge ─────────────────────────────
  function badge(tier, compact = false) {
    injectStyles();
    const t = TIERS[tier] || TIERS.BASIC;
    const el = document.createElement('span');
    el.className = 'tier-badge' + (compact ? ' tier-badge-compact' : '');
    el.style.cssText = `background:${t.bg};border-color:${t.border};color:${t.color}`;
    el.innerHTML =
      `<span class="tier-badge-dot" style="background:${t.dot}"></span>` +
      `<span>${t.label}</span>` +
      (compact ? '' : `<span style="font-size:10px;opacity:.7;font-weight:500">${t.subtitle}</span>`);
    return el;
  }

  // ── compact() — small badge for match results ───────────────
  function compact(tier) { return badge(tier, true); }

  // ── progress() — 3-step ladder ──────────────────────────────
  function progress(currentTier) {
    injectStyles();
    const current = tierOrder(currentTier);
    const steps   = [TIERS.BASIC, TIERS.PROFESSIONAL, TIERS.PREMIUM];

    const wrap = document.createElement('div');
    wrap.className = 'tier-progress';

    steps.forEach((step, i) => {
      const isActive  = i <= current;
      const isCurrent = i === current;

      const stepEl = document.createElement('div');
      stepEl.className = 'tier-step';

      const node = document.createElement('div');
      node.className = 'tier-step-node';
      node.innerHTML = step.icon;
      node.style.cssText = isActive
        ? `background:${step.bg};border-color:${step.color};color:${step.color};` +
          (isCurrent ? `box-shadow:0 0 0 3px ${step.bg}` : '')
        : `background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.2)`;

      const label = document.createElement('div');
      label.className = 'tier-step-label';
      label.textContent = step.label;
      label.style.color = isActive ? step.color : 'rgba(255,255,255,.25)';

      stepEl.appendChild(node);
      stepEl.appendChild(label);
      wrap.appendChild(stepEl);

      if (i < steps.length - 1) {
        const conn = document.createElement('div');
        conn.className = 'tier-connector';
        conn.style.background = i < current ? steps[i+1].color : 'rgba(255,255,255,.1)';
        wrap.appendChild(conn);
      }
    });

    return wrap;
  }

  // ── featureLocks() — locked feature list ────────────────────
  function featureLocks(currentTier) {
    injectStyles();
    const current = tierOrder(currentTier);
    const wrap = document.createElement('div');
    wrap.className = 'tier-feature-list';

    FEATURES.forEach(f => {
      const unlocked = current >= tierOrder(f.minTier);
      const reqTier  = TIERS[f.minTier];
      const el = document.createElement('div');
      el.className = 'tier-feature';
      el.style.background = unlocked
        ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.15)';

      const iconHtml = unlocked
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" style="display:inline-block"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="display:inline-block"><circle cx="12" cy="12" r="9"></circle><line x1="5.7" y1="5.7" x2="18.3" y2="18.3"></line></svg>';

      el.innerHTML = `
        <span class="tier-feature-icon">${iconHtml}</span>
        <span class="tier-feature-label" style="color:${unlocked ? 'var(--color-text-primary,#fff)' : 'rgba(255,255,255,.35)'}">
          ${f.label}
        </span>
        ${!unlocked
          ? `<span class="tier-feature-tag" style="color:${reqTier.color};background:${reqTier.bg};border-color:${reqTier.border}">
               ${reqTier.label}
             </span>`
          : `<span class="tier-feature-tag" style="color:#34d399;background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.2)">
               Unlocked
             </span>`}
      `;
      wrap.appendChild(el);
    });
    return wrap;
  }

  // ── card() — full tier card ──────────────────────────────────
  function card(tier, targetEl) {
    injectStyles();
    const t = TIERS[tier] || TIERS.BASIC;
    const current = tierOrder(tier);

    const wrap = document.createElement('div');
    wrap.className = 'tier-card';
    wrap.style.cssText = `background:${t.bg};border:1px solid ${t.border}`;

    // Header
    const header = document.createElement('div');
    header.className = 'tier-card-header';
    header.innerHTML = `
      <div>
        <div class="tier-card-title">Your Trust Level</div>
      </div>
    `;
    header.querySelector('div').appendChild(badge(tier));
    wrap.appendChild(header);

    // Description
    const desc = document.createElement('div');
    desc.className = 'tier-card-desc';
    desc.textContent = t.desc;
    wrap.appendChild(desc);

    // Progress
    wrap.appendChild(progress(tier));

    // CTA
    if (tier === 'BASIC') {
      wrap.appendChild(_buildCta({
        title:   'Upgrade to Verified',
        points:  ['Unlock professional trust', 'Required for high-trust interactions'],
        btnText: 'Start Verification',
        btnHref: '/dashboard/verification#identity-proof-section',
        next:    TIERS.PROFESSIONAL,
      }));
    } else if (tier === 'PROFESSIONAL') {
      wrap.appendChild(_buildCta({
        title:   'Upgrade to High Trust',
        points:  ['Add face verification', 'Strongest identity confidence'],
        btnText: 'Complete Face Verification',
        btnHref: '/dashboard/verification#face-verification-section',
        next:    TIERS.PREMIUM,
      }));
    } else {
      const ach = document.createElement('div');
      ach.className = 'tier-cta';
      ach.innerHTML = `
        <div class="tier-cta-title" style="color:#a78bfa;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Highest trust level achieved</div>
        <div class="tier-cta-desc">
          Your identity has the strongest verification available.
          No further upgrades are required.
        </div>
      `;
      wrap.appendChild(ach);
    }

    // Feature locks
    const fHeader = document.createElement('div');
    fHeader.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-muted,#9ca3af);margin-top:24px;margin-bottom:0';
    fHeader.textContent = 'Features';
    wrap.appendChild(fHeader);
    wrap.appendChild(featureLocks(tier));

    if (targetEl) targetEl.innerHTML = '';
    if (targetEl) targetEl.appendChild(wrap);
    return wrap;
  }

  function _buildCta({ title, points, btnText, btnHref, next }) {
    const el = document.createElement('div');
    el.className = 'tier-cta';
    el.innerHTML = `
      <div class="tier-cta-title" style="color:${next.color}">${title}</div>
      ${points.map(p => `<div class="tier-cta-point">${p}</div>`).join('')}
      <a href="${btnHref}" class="tier-cta-btn"
         style="background:${next.bg};border-color:${next.border};color:${next.color}">
        ${btnText}
      </a>
    `;
    return el;
  }

  // ── Public API ───────────────────────────────────────────────
  return { badge, compact, progress, featureLocks, card, TIERS };
})();

// Make globally available
window.TierUI = TierUI;
