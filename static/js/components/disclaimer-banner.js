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
    icon:   'ℹ',
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
    setTimeout(() => el.remove(), 300);
  }

  // ── Build banner HTML ────────────────────────────────────
  function buildBanner() {
    const wrap = document.createElement('div');
    wrap.id = 'hvid-disclaimer';
    wrap.style.cssText = [
      'box-sizing:border-box',
      'width:100%',
      'background:rgba(129,140,248,.05)',
      'border-top:1px solid rgba(129,140,248,.12)',
      'border-bottom:1px solid rgba(129,140,248,.12)',
      'padding:10px 20px',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'font-family:Inter,system-ui,sans-serif',
      'font-size:12px',
      'color:rgba(255,255,255,.45)',
      'line-height:1.5',
      'overflow:hidden',
      'max-height:80px',
      'transition:max-height .3s,opacity .3s,padding .3s',
      'position:relative',
      'z-index:101',
    ].join(';');

    wrap.innerHTML = `
      <span style="
        font-size:14px;color:rgba(129,140,248,.6);flex-shrink:0;
        font-weight:700;letter-spacing:-.01em
      ">${MESSAGE.icon}</span>
      <span style="flex:1">
        <strong style="color:rgba(255,255,255,.3);font-weight:600;font-size:11px;
          text-transform:uppercase;letter-spacing:.05em;margin-right:8px">
          ${MESSAGE.label}
        </strong>${MESSAGE.text}
      </span>
      <button id="hvid-disclaimer-close" aria-label="Dismiss" style="
        background:none;border:none;cursor:pointer;padding:4px;
        color:rgba(255,255,255,.2);font-size:16px;line-height:1;
        flex-shrink:0;transition:color .15s;font-family:inherit
      " onmouseover="this.style.color='rgba(255,255,255,.5)'"
         onmouseout="this.style.color='rgba(255,255,255,.2)'">×</button>`;

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
