/**
 * disclaimer-banner.js
 *
 * Injects a subtle, professional legal disclaimer banner.
 *
 * Usage:
 *   <script src="js/components/disclaimer-banner.js"></script>
 *   <div id="disclaimer-mount"></div>   ← optional explicit mount
 *
 * If no mount element exists, injects before </body> automatically.
 * Remembers dismissal for 24 hours via localStorage.
 */
'use strict';

(function DisclaimerBanner() {

  const STORAGE_KEY   = 'hvid_disclaimer_dismissed';
  const DISMISS_TTL   = 24 * 60 * 60 * 1000; // 24 hours

  const MESSAGE = {
    text:   'HVID provides identity signals based on available data. ' +
            'It does not determine intent or make accusations. ' +
            'Users should exercise independent judgment.',
    icon:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1b64f2" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    label:  'Advisory',
  };

  // ── Check if dismissed recently ─────────────────────────
  function isDismissed() {
    try {
      const ts = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return ts && (Date.now() - ts) < DISMISS_TTL;
    } catch { return false; }
  }

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    const el = document.getElementById('hvid-disclaimer');
    if (!el) return;
    el.style.maxHeight  = '0';
    el.style.opacity    = '0';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
    el.style.marginBottom  = '0';
    setTimeout(() => el.remove(), 300);
  }

  // ── Build banner HTML ────────────────────────────────────
  function buildBanner() {
    const wrap = document.createElement('div');
    wrap.id = 'hvid-disclaimer';
    wrap.className = 'hvid-advisory-banner';
    wrap.style.cssText = [
      'box-sizing:border-box',
      'width:100%',
      'background:#f0f7ff',
      'border:1px solid #dbeafe',
      'border-radius:12px',
      'padding:12px 18px',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'font-family:inherit',
      'font-size:12.5px',
      'color:#1e3a8a',
      'line-height:1.5',
      'margin-bottom:22px',
      'box-shadow:0 1px 3px rgba(27,100,242,0.04)',
      'overflow:hidden',
      'transition:max-height .3s,opacity .3s,padding .3s,margin-bottom .3s',
      'position:relative',
      'z-index:10',
    ].join(';');

    wrap.innerHTML = `
      <div style="flex-shrink:0;display:flex;align-items:center;line-height:1">${MESSAGE.icon}</div>
      <div style="flex:1;color:#1e293b;font-size:12.5px">
        <strong style="color:#1b64f2;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-right:8px;background:rgba(27,100,242,0.08);padding:2px 7px;border-radius:4px">
          ${MESSAGE.label}
        </strong>${MESSAGE.text}
      </div>
      <button id="hvid-disclaimer-close" aria-label="Dismiss" style="
        background:none;border:none;cursor:pointer;padding:4px;
        color:#94a3b8;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:color .15s;border-radius:4px
      " onmouseover="this.style.color='#1e293b'"
         onmouseout="this.style.color='#94a3b8'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`;

    wrap.querySelector('#hvid-disclaimer-close')
        .addEventListener('click', dismiss);

    return wrap;
  }

  // ── Mount ────────────────────────────────────────────────
  function mount() {
    if (isDismissed()) return;

    const banner = buildBanner();

    // Public navigation is fixed, so keep the banner in normal flow below it.
    if (document.querySelector('.nav')) {
      banner.style.marginTop = 'var(--nav-height)';
    }

    // Prefer explicit mount point
    const mountEl = document.getElementById('disclaimer-mount');
    if (mountEl) {
      mountEl.appendChild(banner);
      return;
    }

    // Fallback: insert at top of <main>, or before </body>
    const main = document.querySelector('main') || document.body;
    main.prepend(banner);
  }

  // ── Init after DOM ready ─────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // ── Public API ───────────────────────────────────────────
  window.HvidDisclaimer = { dismiss, show: mount };

})();
