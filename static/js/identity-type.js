/**
 * HVID — Identity Type UI Library
 * Single source of truth for identity type display across all pages.
 *
 * Exported as: window.IdentityTypeUI
 */
'use strict';

const IdentityTypeUI = (() => {

  // ── Config ────────────────────────────────────────────────────
  const TYPES = {
    PERSONAL: {
      key:         'PERSONAL',
      title:       'Personal Identity',
      short:       'Personal',
      desc:        'For everyday use',
      guidance:    'Basic trust level. Phone verification required.',
      cta:         null,
      color:       '#818cf8',
      bg:          'rgba(129,140,248,.08)',
      border:      'rgba(129,140,248,.18)',
      icon:        '<svg class="hvid-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      badgeCls:    'itype-personal',
    },
    PROFESSIONAL: {
      key:         'PROFESSIONAL',
      title:       'Professional Identity',
      short:       'Professional',
      desc:        'For work, freelancing, transactions',
      guidance:    'Requires KYC + face verification for higher trust.',
      cta:         { text: 'Complete KYC + Face verification', href: '/dashboard/verification' },
      color:       '#34d399',
      bg:          'rgba(52,211,153,.08)',
      border:      'rgba(52,211,153,.18)',
      icon:        '<svg class="hvid-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
      badgeCls:    'itype-professional',
    },
    BUSINESS: {
      key:         'BUSINESS',
      title:       'Business Identity',
      short:       'Business',
      desc:        'For companies and organizations',
      guidance:    'High-trust, strict verification. KYC required.',
      cta:         { text: 'Submit business verification', href: 'verification.html?type=business' },
      color:       '#fbbf24',
      bg:          'rgba(251,191,36,.07)',
      border:      'rgba(251,191,36,.2)',
      icon:        '<svg class="hvid-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15.01" y2="22"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15.01" y2="6"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15.01" y2="10"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15.01" y2="14"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15.01" y2="18"></line></svg>',
      badgeCls:    'itype-business',
    },
  };

  const DEFAULT = TYPES.PERSONAL;

  function resolve(type) {
    return TYPES[type?.toUpperCase()] || DEFAULT;
  }

  // ── CSS ───────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hvid-itype-styles')) return;
    const s = document.createElement('style');
    s.id = 'hvid-itype-styles';
    s.textContent = `
      .itype-badge {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 700; padding: 3px 9px;
        border-radius: 99px; border: 1px solid; letter-spacing: .03em;
        white-space: nowrap;
      }
      .itype-personal     { color: #818cf8; background: rgba(129,140,248,.08); border-color: rgba(129,140,248,.2); }
      .itype-professional { color: #34d399; background: rgba(52,211,153,.08);  border-color: rgba(52,211,153,.2);  }
      .itype-business     { color: #fbbf24; background: rgba(251,191,36,.07);  border-color: rgba(251,191,36,.22); }

      .itype-card {
        border-radius: 16px; border: 1px solid;
        padding: 20px 22px; cursor: pointer;
        transition: box-shadow .2s, border-color .2s, transform .15s;
        position: relative; user-select: none;
      }
      .itype-card:hover  { transform: translateY(-2px); }
      .itype-card.selected { outline: 2px solid; outline-offset: 2px; }
      .itype-card-icon   { font-size: 28px; margin-bottom: 10px; }
      .itype-card-title  { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
      .itype-card-desc   { font-size: 12px; color: rgba(255,255,255,.5); line-height: 1.5; }
      .itype-card-guidance {
        margin-top: 10px; font-size: 11px; font-weight: 600;
        padding: 5px 9px; border-radius: 8px;
        background: rgba(255,255,255,.04);
      }
      .itype-check {
        position: absolute; top: 14px; right: 14px;
        width: 20px; height: 20px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; border: 2px solid;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Compact badge ────────────────────────────────────────────
  function badge(type) {
    injectStyles();
    const cfg = resolve(type);
    const el = document.createElement('span');
    el.className = `itype-badge ${cfg.badgeCls}`;
    el.innerHTML = `${cfg.icon} <span>${cfg.short}</span>`;
    el.title = cfg.desc;
    return el;
  }

  // ── Selection card (for type-selection screen) ───────────────
  function selectionCard(type, isSelected, onClick) {
    injectStyles();
    const cfg = resolve(type);
    const el  = document.createElement('div');
    el.className = 'itype-card' + (isSelected ? ' selected' : '');
    el.style.cssText = `background:${cfg.bg};border-color:${cfg.border};` +
      (isSelected ? `box-shadow:0 0 0 2px ${cfg.color}22;outline-color:${cfg.color}` : '');
    el.innerHTML = `
      <div class="itype-check" style="border-color:${isSelected ? cfg.color : 'rgba(255,255,255,.15)'};
        background:${isSelected ? cfg.color : 'transparent'};
        color:${isSelected ? '#0f0f0f' : 'transparent'}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      <div class="itype-card-icon">${cfg.icon}</div>
      <div class="itype-card-title" style="color:${cfg.color}">${cfg.title}</div>
      <div class="itype-card-desc">${cfg.desc}</div>
      <div class="itype-card-guidance" style="color:${cfg.color}">${cfg.guidance}</div>`;
    el.addEventListener('click', () => onClick && onClick(type));
    return el;
  }

  // ── Dashboard info block ──────────────────────────────────────
  function dashboardBlock(type, showCta) {
    injectStyles();
    const cfg = resolve(type);
    const ctaHtml = showCta && cfg.cta
      ? `<a href="${cfg.cta.href}" style="display:inline-block;margin-top:12px;font-size:12px;
            font-weight:600;color:${cfg.color};text-decoration:none;
            padding:6px 13px;border:1px solid ${cfg.border};border-radius:8px;
            background:${cfg.bg};transition:opacity .15s"
            onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
            ${cfg.cta.text} →
          </a>`
      : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${ctaHtml ? '4px' : '0'}">
        <span style="font-size:20px">${cfg.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:${cfg.color}">${cfg.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px">${cfg.guidance}</div>
        </div>
      </div>
      ${ctaHtml}`;
  }

  // ── Public profile badge row ──────────────────────────────────
  function profileRow(type) {
    injectStyles();
    const cfg = resolve(type);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:12px 0;
            border-top:1px solid rgba(255,255,255,.05)">
        <span class="itype-badge ${cfg.badgeCls}">${cfg.icon} ${cfg.short}</span>
        <span style="font-size:12px;color:rgba(255,255,255,.4)">${cfg.desc}</span>
      </div>`;
  }

  return { resolve, badge, selectionCard, dashboardBlock, profileRow, TYPES };
})();

window.IdentityTypeUI = IdentityTypeUI;
